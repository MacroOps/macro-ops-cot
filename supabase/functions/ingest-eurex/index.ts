// Eurex daily product-group statistics ingestion.
// Source: the public "Market statistics (online)" HTML table from eurex.com.
// Endpoint: /ex-en/data/statistics/market-statistics-online/100!onlineStats?viewType=0&busDate=YYYYMMDD
// The table publishes Futures Open Interest + Traded Contracts per product group.
// Per-bond / per-contract data is not exposed in this free feed, so we ingest at the
// product-group granularity (DAX®, Blue Chip, EURO STOXX Sector, Fixed Income, ...).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Map Eurex product-group label (as it appears in the overview table) -> our market symbol.
// Labels are matched case-insensitively, with ® and whitespace normalised.
const LABEL_TO_SYMBOL: Record<string, string> = {
  "dax": "FDAX",
  "blue chip": "FESX",
  "six swiss exchange indexes": "FSMI",
  "broadbased/size indexes": "FSTX",
  "euro stoxx sector index futures": "FESB",
  "stoxx europe 600 sector index futures": "FXXP",
  "volatility index futures": "VSTOXX",
  "vstoxx": "VSTOXX",
  "fixed income derivatives": "FI_AGG",
  "equity index": "EQIDX",
  "euro stoxx 50 options": "SX5E_OPT",
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/®|™/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim();

const parseNum = (s: string) => {
  const n = Number(s.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

function lastBusDate(): string {
  // Eurex publishes after EU close. Use yesterday if before 19:00 UTC, else today.
  const d = new Date();
  if (d.getUTCHours() < 19) d.setUTCDate(d.getUTCDate() - 1);
  // Skip Sat (6) and Sun (0)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function isoFromBus(bus: string): string {
  return `${bus.slice(0, 4)}-${bus.slice(4, 6)}-${bus.slice(6, 8)}`;
}

interface ParsedRow {
  label: string;
  futuresVolume: number | null;
  futuresOI: number | null;
}

function parseStatsHtml(html: string): ParsedRow[] {
  // Decode common entities
  const h = html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Find the data table
  const tblM = h.match(/<table[^>]*dataTable[^>]*>([\s\S]+?)<\/table>/);
  if (!tblM) return [];
  const body = tblM[1];

  // Pull rows
  const rowRe = /<tr[^>]*>([\s\S]+?)<\/tr>/g;
  const stripTags = (s: string) =>
    s
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const out: ParsedRow[] = [];
  let currentLabel: string | null = null;
  let pendingTC: number | null = null;
  let pendingOI: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(body))) {
    const row = m[1];
    const cells = [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((x) =>
      stripTags(x[1]),
    );
    if (cells.length === 0) continue;

    // Label cell (when present) uses rowspan="2"
    const labelM = row.match(/<td[^>]*rowspan="2"[^>]*>([\s\S]*?)<\/td>/);
    if (labelM) {
      // Flush previous label if it had data
      if (currentLabel && (pendingTC !== null || pendingOI !== null)) {
        out.push({ label: currentLabel, futuresVolume: pendingTC, futuresOI: pendingOI });
      }
      currentLabel = stripTags(labelM[1]);
      pendingTC = null;
      pendingOI = null;
    }

    const joined = cells.join(" ");
    const nums = cells.filter((c) => /^[\d,]+$/.test(c));
    // Eurex prints: Call | Put | Call+Put | Futures | Total (5 numbers)
    const futures = nums.length >= 5 ? parseNum(nums[3]) : null;

    if (/Traded contracts/i.test(joined)) pendingTC = futures;
    else if (/Open interest/i.test(joined)) pendingOI = futures;
  }
  // Flush last
  if (currentLabel && (pendingTC !== null || pendingOI !== null)) {
    out.push({ label: currentLabel, futuresVolume: pendingTC, futuresOI: pendingOI });
  }
  return out;
}

async function fetchEurex(bus: string): Promise<string> {
  const url = `https://www.eurex.com/ex-en/data/statistics/market-statistics-online/100!onlineStats?viewType=0&busDate=${bus}`;
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/html",
    },
  });
  if (!r.ok) throw new Error(`eurex ${r.status}`);
  return r.text();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const started = new Date().toISOString();
  let written = 0;

  try {
    const body = await req.json().catch(() => ({}));
    const busDateStr: string = body.busDate ?? lastBusDate();
    const observedOn = isoFromBus(busDateStr);

    const html = await fetchEurex(busDateStr);
    const rows = parseStatsHtml(html);
    console.log(`eurex: parsed ${rows.length} rows for ${observedOn}`);

    const { data: markets, error } = await sb
      .from("markets")
      .select("id,symbol")
      .eq("exchange", "Eurex")
      .eq("is_active", true);
    if (error) throw error;
    const bySymbol = new Map((markets ?? []).map((m) => [m.symbol, m.id]));

    const matched: Array<{ symbol: string; row: ParsedRow }> = [];
    for (const r of rows) {
      const key = norm(r.label);
      const sym = LABEL_TO_SYMBOL[key];
      if (sym && bySymbol.has(sym)) matched.push({ symbol: sym, row: r });
    }
    console.log(`eurex: matched ${matched.length} product groups`);

    for (const { symbol, row } of matched) {
      const marketId = bySymbol.get(symbol)!;
      const { data: prev } = await sb
        .from("eurex_oi_history")
        .select("open_interest")
        .eq("market_id", marketId)
        .lt("observed_on", observedOn)
        .order("observed_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      const oiChange =
        prev?.open_interest != null && row.futuresOI != null
          ? row.futuresOI - Number(prev.open_interest)
          : null;

      const { error: upErr } = await sb.from("eurex_oi_history").upsert(
        {
          market_id: marketId,
          observed_on: observedOn,
          open_interest: row.futuresOI,
          volume: row.futuresVolume,
          oi_change: oiChange,
        },
        { onConflict: "market_id,observed_on" },
      );
      if (upErr) {
        console.error(`eurex ${symbol}: upsert failed`, upErr);
        continue;
      }
      written++;
    }

    await sb.from("ingestion_log").insert({
      source: "eurex",
      status: "ok",
      rows_written: written,
      message: `busDate=${observedOn} parsed=${rows.length} matched=${matched.length}`,
      started_at: started,
      finished_at: new Date().toISOString(),
    });
    return new Response(
      JSON.stringify({ ok: true, rows_written: written, observed_on: observedOn }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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
