// News ingestion via Marketaux. Pulls headlines per market keyword, classifies
// expected_direction from sentiment, joins to next-day price return to flag divergences.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MARKETAUX_API_KEY = Deno.env.get("MARKETAUX_API_KEY");

interface Market { id: string; symbol: string; news_keywords: string | null }
interface MxArticle {
  uuid: string; title: string; url: string; published_at: string;
  source: string; description?: string;
  entities?: { sentiment_score?: number }[];
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchMarketaux(search: string): Promise<MxArticle[]> {
  const url = new URL("https://api.marketaux.com/v1/news/all");
  url.searchParams.set("api_token", MARKETAUX_API_KEY!);
  url.searchParams.set("search", search);
  url.searchParams.set("language", "en");
  url.searchParams.set("filter_entities", "true");
  url.searchParams.set("limit", "3");
  const r = await fetch(url.toString());
  if (r.status === 429) { await sleep(1500); return fetchMarketaux(search); }
  if (!r.ok) throw new Error(`Marketaux ${r.status}`);
  const json = await r.json();
  return (json?.data ?? []) as MxArticle[];
}

function avgSentiment(a: MxArticle): number {
  const ents = a.entities ?? [];
  if (!ents.length) return 0;
  const s = ents.map(e => e.sentiment_score ?? 0);
  return s.reduce((x, y) => x + y, 0) / s.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!MARKETAUX_API_KEY) {
    return new Response(JSON.stringify({ error: "MARKETAUX_API_KEY missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const started = new Date().toISOString();
  let written = 0;

  try {
    const { data: markets, error: mErr } = await sb
      .from("markets").select("id,symbol,news_keywords")
      .eq("is_active", true).not("news_keywords", "is", null);
    if (mErr) throw mErr;

    for (const m of (markets ?? []) as Market[]) {
      if (!m.news_keywords) continue;
      try {
        // Marketaux free tier: take the first keyword to keep request count low
        const kw = m.news_keywords.split(",")[0].trim();
        const articles = await fetchMarketaux(kw);
        await sleep(1100); // free tier ~ 1 req/sec

        // Pull latest 30 daily closes to compute observed 1d return
        const { data: prices } = await sb.from("price_history")
          .select("observed_on,close").eq("market_id", m.id)
          .order("observed_on", { ascending: false }).limit(60);
        const priceByDate = new Map<string, number>();
        for (const p of prices ?? []) priceByDate.set(p.observed_on, Number(p.close));
        const sortedDates = (prices ?? []).map(p => p.observed_on).sort();

        for (const a of articles) {
          const sent = avgSentiment(a);
          const dir = sent > 0.05 ? 1 : sent < -0.05 ? -1 : 0;
          const day = a.published_at.slice(0, 10);
          // Find next trading day's close vs that day's close
          let ret1d: number | null = null;
          const idx = sortedDates.indexOf(day);
          if (idx >= 0 && idx + 1 < sortedDates.length) {
            const c0 = priceByDate.get(sortedDates[idx]);
            const c1 = priceByDate.get(sortedDates[idx + 1]);
            if (c0 && c1) ret1d = ((c1 - c0) / c0) * 100;
          }
          const isDiv = dir !== 0 && ret1d != null && Math.sign(ret1d) !== Math.sign(dir) && Math.abs(ret1d) > 0.5;

          const { error: nErr } = await sb.from("news_events")
            .upsert({
              market_id: m.id,
              headline: a.title,
              source: a.source,
              url: a.url,
              published_at: a.published_at,
              expected_direction: dir,
              observed_return_1d: ret1d,
              is_divergence: isDiv,
              divergence_note: isDiv ? `${dir > 0 ? "Bullish" : "Bearish"} headline, tape moved ${ret1d?.toFixed(2)}%` : null,
            }, { onConflict: "market_id,url" });
          if (nErr) throw nErr;
          written += 1;
        }
        console.log(`news ${m.symbol} "${kw}": ${articles.length}`);
      } catch (e) {
        console.error(`news ${m.symbol} failed`, e);
      }
    }

    await sb.from("ingestion_log").insert({
      source: "news", status: "ok", rows_written: written,
      started_at: started, finished_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ ok: true, rows_written: written }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("ingestion_log").insert({
      source: "news", status: "error", rows_written: written, message: msg,
      started_at: started, finished_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
