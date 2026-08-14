// Returns since-signal-date performance for a symbol, plus net (excess vs S&P 500).
// Source: Yahoo daily adjusted closes. Public endpoint (read-only market data).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const url = new URL(req.url);
    const symbol = (url.searchParams.get("symbol") ?? "").toUpperCase();
    const dates = (url.searchParams.get("dates") ?? "").split(",").filter(Boolean);
    if (!symbol || !dates.length) {
      return new Response(JSON.stringify({ error: "symbol and dates required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const [sym, spx] = await Promise.all([series(symbol.replace(".", "-")), series("^GSPC")]);
    const symLast = last(sym);
    const spxLast = last(spx);
    const out: Record<string, { ret: number | null; net: number | null }> = {};
    for (const d of dates) {
      const s0 = at(sym, d);
      const b0 = at(spx, d);
      const ret = s0 && symLast ? (symLast / s0 - 1) * 100 : null;
      const bench = b0 && spxLast ? (spxLast / b0 - 1) * 100 : null;
      out[d] = { ret, net: ret !== null && bench !== null ? ret - bench : null };
    }
    return new Response(JSON.stringify({ symbol, returns: out }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
