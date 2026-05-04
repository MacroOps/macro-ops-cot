// Daily price ingestion via Yahoo Finance chart API (no key required).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Market { id: string; symbol: string; yahoo_symbol: string | null }

async function fetchYahoo(sym: string, range = "10y") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${range}`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 LovableBot" } });
  if (!r.ok) throw new Error(`Yahoo ${r.status} ${sym}`);
  const json = await r.json();
  const result = json?.chart?.result?.[0];
  const ts: number[] = result?.timestamp ?? [];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
  return ts.map((t, i) => ({ ts: t, close: closes[i] })).filter(p => p.close != null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const started = new Date().toISOString();
  let written = 0;

  try {
    const body = await req.json().catch(() => ({}));
    const range = (body.range as string) ?? "10y";

    const { data: markets, error: mErr } = await sb
      .from("markets").select("id,symbol,yahoo_symbol")
      .eq("is_active", true).not("yahoo_symbol", "is", null);
    if (mErr) throw mErr;

    for (const m of (markets ?? []) as Market[]) {
      if (!m.yahoo_symbol) continue;
      try {
        const points = await fetchYahoo(m.yahoo_symbol, range);
        // Chunk to keep request payloads reasonable
        for (let i = 0; i < points.length; i += 500) {
          const chunk = points.slice(i, i + 500).map(p => ({
            market_id: m.id,
            observed_on: new Date(p.ts * 1000).toISOString().slice(0, 10),
            close: p.close,
          }));
          const { error: pErr } = await sb.from("price_history")
            .upsert(chunk, { onConflict: "market_id,observed_on" });
          if (pErr) throw pErr;
          written += chunk.length;
        }
        console.log(`prices ${m.symbol} (${m.yahoo_symbol}): ${points.length}`);
      } catch (e) {
        console.error(`prices ${m.symbol} failed`, e);
      }
    }

    await sb.from("ingestion_log").insert({
      source: "prices", status: "ok", rows_written: written,
      started_at: started, finished_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ ok: true, rows_written: written }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("ingestion_log").insert({
      source: "prices", status: "error", rows_written: written, message: msg,
      started_at: started, finished_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
