// Returns since-signal-date performance for a symbol, plus net (excess vs S&P 500).
// Source: Yahoo daily adjusted closes. Public endpoint (read-only market data).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Per-isolate cache of Yahoo series (1h) so batches share the S&P 500 benchmark
// and repeat symbols.
const SERIES_TTL = 60 * 60_000;
const seriesCache = new Map<string, { at: number; p: Promise<Record<string, number>> }>();
function cachedSeries(sym: string): Promise<Record<string, number>> {
  const hit = seriesCache.get(sym);
  if (hit && Date.now() - hit.at < SERIES_TTL) return hit.p;
  const p = series(sym);
  p.catch(() => seriesCache.delete(sym));
  seriesCache.set(sym, { at: Date.now(), p });
  return p;
}

type Ret = { ret: number | null; net: number | null };
function compute(sym: Record<string, number>, spx: Record<string, number>, dates: string[]): Record<string, Ret> {
  const symLast = last(sym);
  const spxLast = last(spx);
  const out: Record<string, Ret> = {};
  for (const d of dates) {
    const s0 = at(sym, d);
    const b0 = at(spx, d);
    const ret = s0 && symLast ? (symLast / s0 - 1) * 100 : null;
    const bench = b0 && spxLast ? (spxLast / b0 - 1) * 100 : null;
    out[d] = { ret, net: ret !== null && bench !== null ? ret - bench : null };
  }
  return out;
}

const MAX_BATCH = 50;
const CONCURRENCY = 8;

async function series(sym: string): Promise<Record<string, number>> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2y`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 LovableBot" } });
  if (!r.ok) throw new Error(`yahoo ${sym} ${r.status}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res) return {};
  const ts: number[] = res.timestamp ?? [];
  const cl: (number | null)[] =
    res.indicators?.adjclose?.[0]?.adjclose ?? res.indicators?.quote?.[0]?.close ?? [];
  const out: Record<string, number> = {};
  ts.forEach((t, i) => {
    const v = cl[i];
    if (typeof v === "number") out[new Date(t * 1000).toISOString().slice(0, 10)] = v;
  });
  return out;
}

// closest close on or after the given date
function at(s: Record<string, number>, date: string): number | null {
  const keys = Object.keys(s).sort();
  const k = keys.find((d) => d >= date);
  return k ? s[k] : null;
}
function last(s: Record<string, number>): number | null {
  const keys = Object.keys(s).sort();
  return keys.length ? s[keys[keys.length - 1]] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    // Batch: POST { items: [{ symbol, dates: [ISO...] }] } -> { results: { SYM: { date: {ret, net} } } }
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      const items: { symbol: string; dates: string[] }[] = Array.isArray(b?.items) ? b.items.slice(0, MAX_BATCH) : [];
      const spx = await cachedSeries("^GSPC");
      const results: Record<string, Record<string, Ret>> = {};
      let i = 0;
      const worker = async () => {
        while (i < items.length) {
          const it = items[i++];
          const symbol = String(it?.symbol ?? "").toUpperCase();
          const dates = (it?.dates ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
          if (!symbol || !dates.length) continue;
          try {
            results[symbol] = compute(await cachedSeries(symbol.replace(".", "-")), spx, dates);
          } catch {
            results[symbol] = Object.fromEntries(dates.map((d) => [d, { ret: null, net: null }]));
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      return new Response(JSON.stringify({ results }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const symbol = (url.searchParams.get("symbol") ?? "").toUpperCase();
    const dates = (url.searchParams.get("dates") ?? "").split(",").filter(Boolean);
    if (!symbol || !dates.length) {
      return new Response(JSON.stringify({ error: "symbol and dates required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const [sym, spx] = await Promise.all([cachedSeries(symbol.replace(".", "-")), cachedSeries("^GSPC")]);
    const out = compute(sym, spx, dates);
    return new Response(JSON.stringify({ symbol, returns: out }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
