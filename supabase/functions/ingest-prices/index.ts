// Daily price ingestion via Yahoo Finance chart API (no key required).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Market { id: string; symbol: string; yahoo_symbol: string | null }

async function fetchYahoo(sym: string, range = "20y") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${range}`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 LovableBot" } });
  if (!r.ok) throw new Error(`Yahoo ${r.status} ${sym}`);
  const json = await r.json();
  const result = json?.chart?.result?.[0];
  const ts: number[] = result?.timestamp ?? [];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
  // Raw points, non-null.
  const raw = ts.map((t, i) => ({ ts: t, close: closes[i] as number }))
    .filter(p => p.close != null && Number.isFinite(p.close) && p.close > 0);
  // Sanity filter: Yahoo occasionally returns first-of-month bars off by ~100x
  // (unit/scaling glitches, esp. Rough Rice). Drop any point whose close differs
  // from the local median (±5 neighbors) by more than 5x.
  const out: { ts: number; close: number }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const lo = Math.max(0, i - 5);
    const hi = Math.min(raw.length, i + 6);
    const neighbors = raw.slice(lo, hi).map(p => p.close).sort((a, b) => a - b);
    const med = neighbors[Math.floor(neighbors.length / 2)];
    const c = raw[i].close;
    if (med > 0 && (c / med > 5 || med / c > 5)) continue;
    out.push(raw[i]);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const started = new Date().toISOString();
  let written = 0;

  try {
    const body = await req.json().catch(() => ({}));
    const range = (body.range as string) ?? "20y";
    const symbols = Array.isArray(body.symbols)
      ? body.symbols.map((s: unknown) => String(s).toUpperCase())
      : null;

    let marketQuery = sb
      .from("markets").select("id,symbol,yahoo_symbol")
      .eq("is_active", true).not("yahoo_symbol", "is", null);
    if (symbols?.length) marketQuery = marketQuery.in("symbol", symbols);
    const { data: markets, error: mErr } = await marketQuery;
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
