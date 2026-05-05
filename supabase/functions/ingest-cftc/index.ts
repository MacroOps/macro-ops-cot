// CFTC Commitments of Traders ingestion
// Pulls Legacy (6dca-aqww) + Disaggregated (72hh-3qpy) reports from the public
// Socrata API for every active market and upserts cot_reports + positioning_snapshots.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SOCRATA_LEGACY = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";
const SOCRATA_DISAGG = "https://publicreporting.cftc.gov/resource/72hh-3qpy.json";

interface Market { id: string; symbol: string; cftc_code: string | null }

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

async function fetchSocrata(base: string, code: string, sinceISO: string, untilISO?: string) {
  const url = new URL(base);
  url.searchParams.set("cftc_contract_market_code", code);
  const where = untilISO
    ? `report_date_as_yyyy_mm_dd >= '${sinceISO}' AND report_date_as_yyyy_mm_dd < '${untilISO}'`
    : `report_date_as_yyyy_mm_dd >= '${sinceISO}'`;
  url.searchParams.set("$where", where);
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd DESC");
  url.searchParams.set("$limit", "600");
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`Socrata ${r.status} ${url}`);
  return r.json() as Promise<Record<string, string>[]>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const started = new Date().toISOString();
  let written = 0;

  try {
    const body = await req.json().catch(() => ({}));
    const yearsBack = Number(body.years ?? 10);
    const symbolFilter: string | undefined = body.symbol;
    const formatFilter: "legacy" | "disaggregated" | undefined = body.format;
    const sinceOverride: string | undefined = body.since;
    const untilOverride: string | undefined = body.until;
    const since = new Date();
    since.setFullYear(since.getFullYear() - yearsBack);
    const sinceISO = sinceOverride ?? since.toISOString().slice(0, 10);

    let q = sb.from("markets").select("id,symbol,cftc_code")
      .eq("is_active", true).not("cftc_code", "is", null);
    if (symbolFilter) q = q.eq("symbol", symbolFilter);
    const { data: markets, error: mErr } = await q;
    if (mErr) throw mErr;

    for (const m of (markets ?? []) as Market[]) {
      if (!m.cftc_code) continue;
      try {
        const legacy = formatFilter === "disaggregated" ? [] : await fetchSocrata(SOCRATA_LEGACY, m.cftc_code, sinceISO, untilOverride);
        const disagg = formatFilter === "legacy" ? [] : await fetchSocrata(SOCRATA_DISAGG, m.cftc_code, sinceISO, untilOverride);

        // ---- Legacy ----
        for (const row of legacy) {
          const reportDate = String(row.report_date_as_yyyy_mm_dd ?? "").slice(0, 10);
          if (!reportDate) continue;
          const oi = num(row.open_interest_all);
          const { data: rep, error: rErr } = await sb
            .from("cot_reports")
            .upsert({ market_id: m.id, report_date: reportDate, format: "legacy", open_interest: oi },
                    { onConflict: "market_id,report_date,format" })
            .select("id").single();
          if (rErr) throw rErr;

          const ncL = num(row.noncomm_positions_long_all);
          const ncS = num(row.noncomm_positions_short_all);
          const ncSp = num(row.noncomm_postions_spread_all ?? row.noncomm_positions_spread);
          const cL = num(row.comm_positions_long_all);
          const cS = num(row.comm_positions_short_all);
          const nrL = num(row.nonrept_positions_long_all);
          const nrS = num(row.nonrept_positions_short_all);

          const snapshots = [
            { category: "non_commercial", long_contracts: ncL, short_contracts: ncS, spread_contracts: ncSp, pct_of_oi: oi ? (ncL - ncS) / oi * 100 : null },
            { category: "commercial",     long_contracts: cL,  short_contracts: cS,  spread_contracts: 0,    pct_of_oi: oi ? (cL - cS) / oi * 100 : null },
            { category: "non_reportable", long_contracts: nrL, short_contracts: nrS, spread_contracts: 0,    pct_of_oi: oi ? (nrL - nrS) / oi * 100 : null },
          ].map(s => ({ ...s, report_id: rep.id }));
          const { error: sErr } = await sb.from("positioning_snapshots")
            .upsert(snapshots, { onConflict: "report_id,category" });
          if (sErr) throw sErr;
          written += snapshots.length;
        }

        // ---- Disaggregated ----
        for (const row of disagg) {
          const reportDate = String(row.report_date_as_yyyy_mm_dd ?? "").slice(0, 10);
          if (!reportDate) continue;
          const oi = num(row.open_interest_all);
          const { data: rep, error: rErr } = await sb
            .from("cot_reports")
            .upsert({ market_id: m.id, report_date: reportDate, format: "disaggregated", open_interest: oi },
                    { onConflict: "market_id,report_date,format" })
            .select("id").single();
          if (rErr) throw rErr;

          const pmL = num(row.prod_merc_positions_long);
          const pmS = num(row.prod_merc_positions_short);
          const swL = num(row.swap_positions_long_all);
          const swS = num(row.swap__positions_short_all);
          const swSp = num(row.swap__positions_spread_all);
          const mmL = num(row.m_money_positions_long_all);
          const mmS = num(row.m_money_positions_short_all);
          const mmSp = num(row.m_money_positions_spread);
          const orL = num(row.other_rept_positions_long);
          const orS = num(row.other_rept_positions_short);
          const orSp = num(row.other_rept_positions_spread);

          const snapshots = [
            { category: "producer_merchant", long_contracts: pmL, short_contracts: pmS, spread_contracts: 0,   pct_of_oi: oi ? (pmL - pmS) / oi * 100 : null },
            { category: "swap_dealer",       long_contracts: swL, short_contracts: swS, spread_contracts: swSp, pct_of_oi: oi ? (swL - swS) / oi * 100 : null },
            { category: "managed_money",     long_contracts: mmL, short_contracts: mmS, spread_contracts: mmSp, pct_of_oi: oi ? (mmL - mmS) / oi * 100 : null },
            { category: "other_reportable",  long_contracts: orL, short_contracts: orS, spread_contracts: orSp, pct_of_oi: oi ? (orL - orS) / oi * 100 : null },
            { category: "leveraged_fund",    long_contracts: mmL, short_contracts: mmS, spread_contracts: mmSp, pct_of_oi: oi ? (mmL - mmS) / oi * 100 : null },
          ].map(s => ({ ...s, report_id: rep.id }));
          const { error: sErr } = await sb.from("positioning_snapshots")
            .upsert(snapshots, { onConflict: "report_id,category" });
          if (sErr) throw sErr;
          written += snapshots.length;
        }
        console.log(`cftc ${m.symbol}: legacy=${legacy.length} disagg=${disagg.length}`);
      } catch (e) {
        console.error(`cftc ${m.symbol} failed`, e);
      }
    }

    await sb.from("ingestion_log").insert({
      source: "cftc", status: "ok", rows_written: written,
      started_at: started, finished_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ ok: true, rows_written: written }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("ingestion_log").insert({
      source: "cftc", status: "error", rows_written: written, message: msg,
      started_at: started, finished_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
