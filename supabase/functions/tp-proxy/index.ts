// Proxy to api.tpmarketresearch.com. Keeps TPMR_API_KEY server-side.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TPMR_API_KEY = Deno.env.get("TPMR_API_KEY");
const TPMR_BASE = "https://api.tpmarketresearch.com";

const ALLOWED_TABLES = new Set([
  "calculated_breadth_full",
  "custom_indexes",
  "index_constituents",
  "risk_composite_history",
  "sector_trend_timeseries",
  "symbol_metadata",
  "symbol_trend_relative_signals",
  "trend_relative_signals",
  "trend_signals",
]);

const ALLOWED_PARAMS = new Set([
  "start_date", "end_date", "sector", "sector_code", "symbol",
  "index_symbol", "index_code", "timeframe", "signal_state",
  "composite_type", "industry", "sub_industry", "category", "exchange",
  "limit", "offset",
]);

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!TPMR_API_KEY) {
    return json({ error: "TPMR_API_KEY not configured" }, 500);
  }

  let table: string | undefined;
  let params: Record<string, unknown> = {};

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      table = body?.table;
      params = body?.params ?? {};
    } else {
      const url = new URL(req.url);
      table = url.searchParams.get("table") ?? undefined;
      for (const [k, v] of url.searchParams.entries()) {
        if (k !== "table") params[k] = v;
      }
    }
  } catch (e) {
    return json({ error: "invalid request body", detail: String(e) }, 400);
  }

  if (!table || !ALLOWED_TABLES.has(table)) {
    return json({ error: "unknown or missing table", table }, 400);
  }

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (!ALLOWED_PARAMS.has(k)) continue;
    qs.append(k, String(v));
  }

  const upstream = `${TPMR_BASE}/${table}${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(upstream, { headers: { "X-API-Key": TPMR_API_KEY } });
  const text = await res.text();

  if (!res.ok) {
    return json({ error: "upstream_error", status: res.status, body: text.slice(0, 500) }, res.status);
  }

  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }

  return json(data, 200, { "Cache-Control": "private, max-age=300" });
});
