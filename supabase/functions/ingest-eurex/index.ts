// Eurex futures daily open interest + volume ingestion.
// Eurex does NOT publish a CoT-style trader-category breakdown publicly.
// We capture a daily snapshot of OI/volume per liquid Eurex contract using
// Yahoo Finance's quote endpoint (the only reliable public source that
// exposes openInterest + volume per futures symbol). Over time this builds
// a history in eurex_oi_history that we can chart and rank.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Map our internal symbol -> Yahoo continuous-future symbol(s).
// We try each in order; first that returns OI > 0 wins.
const YAHOO_MAP: Record<string, string[]> = {
  FESX: ["FESX=F", "STXE=F"],
  FDAX: ["FDAX=F", "DY=F"],
  FDXM: ["MFX=F", "FDXM=F"],
  FSMI: ["FSMI=F"],
  FSTX: ["FSTX=F"],
  FESB: ["FESB=F"],
  FXXP: ["FXXP=F"],
  FGBL: ["GG=F", "FGBL=F"],
  FGBM: ["FGBM=F"],
  FGBS: ["FGBS=F"],
  FGBX: ["FGBX=F"],
  FOAT: ["FOAT=F"],
  FBTP: ["FBTP=F"],
  FBTS: ["FBTS=F"],
  CONF: ["CONF=F"],
};

interface Market { id: string; symbol: string }

async function fetchYahooQuote(syms: string[]) {
  const url =
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
    encodeURIComponent(syms.join(","));
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "application/json",
    },
  });
  if (!r.ok) throw new Error(`yahoo ${r.status}`);
  const j = await r.json();
  return (j?.quoteResponse?.result ?? []) as Array<{
    symbol: string;
    openInterest?: number;
    regularMarketVolume?: number;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const started = new Date().toISOString();
  let written = 0;

  try {
    const body = await req.json().catch(() => ({}));
    const symbolFilter: string | undefined = body.symbol;

    let q = sb.from("markets").select("id,symbol").eq("exchange", "Eurex").eq("is_active", true);
    if (symbolFilter) q = q.eq("symbol", symbolFilter);
    const { data: markets, error } = await q;
    if (error) throw error;

    const today = new Date().toISOString().slice(0, 10);

    for (const m of (markets ?? []) as Market[]) {
      const candidates = YAHOO_MAP[m.symbol];
      if (!candidates?.length) {
        console.log(`eurex ${m.symbol}: no yahoo mapping`);
        continue;
      }
      try {
        const results = await fetchYahooQuote(candidates);
        let oi = 0;
        let vol = 0;
        for (const r of results) {
          if ((r.openInterest ?? 0) > oi) oi = r.openInterest ?? 0;
          if ((r.regularMarketVolume ?? 0) > vol) vol = r.regularMarketVolume ?? 0;
        }
        if (!oi && !vol) {
          console.log(`eurex ${m.symbol}: empty quote`);
          continue;
        }

        // previous OI for delta
        const { data: prev } = await sb
          .from("eurex_oi_history")
          .select("open_interest")
          .eq("market_id", m.id)
          .lt("observed_on", today)
          .order("observed_on", { ascending: false })
          .limit(1)
          .maybeSingle();
        const oiChange = prev?.open_interest != null ? oi - Number(prev.open_interest) : null;

        const { error: upErr } = await sb.from("eurex_oi_history").upsert(
          {
            market_id: m.id,
            observed_on: today,
            open_interest: oi || null,
            volume: vol || null,
            oi_change: oiChange,
          },
          { onConflict: "market_id,observed_on" },
        );
        if (upErr) throw upErr;
        written++;
        console.log(`eurex ${m.symbol}: oi=${oi} vol=${vol}`);
      } catch (e) {
        console.error(`eurex ${m.symbol} failed`, e);
      }
    }

    await sb.from("ingestion_log").insert({
      source: "eurex",
      status: "ok",
      rows_written: written,
      started_at: started,
      finished_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ ok: true, rows_written: written }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("ingestion_log").insert({
      source: "eurex",
      status: "error",
      rows_written: written,
      message: msg,
      started_at: started,
      finished_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
