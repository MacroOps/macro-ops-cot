// Check active markets for missing/stale CoT and price data.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: markets, error } = await sb
    .from("markets")
    .select("id,symbol,name,sector,cftc_code,yahoo_symbol,is_active")
    .eq("is_active", true)
    .order("sector").order("symbol");
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const staleCutoff = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const issues: Record<string, unknown>[] = [];

  for (const m of markets ?? []) {
    const [{ count: cotCount }, { data: lastCot }, { count: pxCount }, { data: lastPx }] = await Promise.all([
      sb.from("cot_reports").select("id", { count: "exact", head: true }).eq("market_id", m.id),
      sb.from("cot_reports").select("report_date").eq("market_id", m.id).order("report_date", { ascending: false }).limit(1).maybeSingle(),
      sb.from("price_history").select("id", { count: "exact", head: true }).eq("market_id", m.id),
      sb.from("price_history").select("observed_on").eq("market_id", m.id).order("observed_on", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const probs: string[] = [];
    if (!m.cftc_code) probs.push("missing_cftc_code");
    if (!m.yahoo_symbol) probs.push("missing_yahoo_symbol");
    if ((cotCount ?? 0) === 0) probs.push("no_cot_reports");
    else if (lastCot && lastCot.report_date < staleCutoff) probs.push(`stale_cot:${lastCot.report_date}`);
    if ((pxCount ?? 0) === 0) probs.push("no_price_history");
    else if (lastPx && lastPx.observed_on < staleCutoff) probs.push(`stale_price:${lastPx.observed_on}`);

    if (probs.length) {
      issues.push({
        symbol: m.symbol, name: m.name, sector: m.sector,
        cot_count: cotCount ?? 0, last_cot: lastCot?.report_date ?? null,
        price_count: pxCount ?? 0, last_price: lastPx?.observed_on ?? null,
        problems: probs,
      });
    }
  }

  return new Response(JSON.stringify({
    ok: true, total_markets: markets?.length ?? 0, issue_count: issues.length, issues,
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
