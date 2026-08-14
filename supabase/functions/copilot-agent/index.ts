// Agentic Research Copilot.
// Runs a tool-using loop against Lovable AI (OpenAI-compatible tools schema)
// and returns the final assistant text + a transcript of tool events.
// NB: Non-streaming for simplicity — surfaces tool runs as discrete events
// the UI can render in collapsible accordions.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

// ---- Real CoT tools (DB-backed) -------------------------------------------
async function tool_list_markets(args: { query?: string; sector?: string }) {
  let q = sb.from("markets").select("id,symbol,name,sector").order("symbol").limit(40);
  if (args.sector) q = q.ilike("sector", `%${args.sector}%`);
  if (args.query) {
    const term = args.query.replace(/[%_]/g, "");
    q = q.or(`symbol.ilike.%${term}%,name.ilike.%${term}%`);
  }
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, markets: data ?? [] };
}

async function resolveMarket(symbolOrName: string) {
  const term = symbolOrName.trim();
  const { data: bySym } = await sb.from("markets").select("id,symbol,name,sector")
    .ilike("symbol", term).maybeSingle();
  if (bySym) return bySym;
  const safe = term.replace(/[%_]/g, "");
  const { data: matches } = await sb.from("markets").select("id,symbol,name,sector")
    .or(`symbol.ilike.%${safe}%,name.ilike.%${safe}%`).limit(5);
  return matches?.[0] ?? null;
}

const CAT_LABELS: Record<string, string> = {
  commercial: "Commercials",
  non_commercial: "Large Specs (Non-Comm)",
  non_reportable: "Small Specs",
  managed_money: "Managed Money",
  leveraged_fund: "Leveraged Funds",
  asset_manager: "Asset Managers",
  dealer_intermediary: "Dealers",
  producer_merchant: "Producer/Merchant",
  swap_dealer: "Swap Dealers",
  other_reportable: "Other Reportable",
};

const CAT_ALIASES: Record<string, string> = {
  commercial: "commercial", commercials: "commercial", comms: "commercial", hedger: "commercial", hedgers: "commercial",
  non_commercial: "non_commercial", "non-commercial": "non_commercial", noncommercial: "non_commercial",
  large_specs: "non_commercial", "large specs": "non_commercial", large_speculator: "non_commercial",
  large_speculators: "non_commercial", "large speculators": "non_commercial", specs: "non_commercial",
  speculators: "non_commercial", spec: "non_commercial",
  non_reportable: "non_reportable", nonreportable: "non_reportable", small_specs: "non_reportable",
  "small specs": "non_reportable", small_traders: "non_reportable", retail: "non_reportable",
  managed_money: "managed_money", mm: "managed_money", "managed money": "managed_money", funds: "managed_money",
  leveraged_fund: "leveraged_fund", leveraged_funds: "leveraged_fund", "leveraged funds": "leveraged_fund",
  lev_funds: "leveraged_fund", levfunds: "leveraged_fund", hedge_funds: "leveraged_fund",
  asset_manager: "asset_manager", asset_managers: "asset_manager", "asset managers": "asset_manager",
  institutional: "asset_manager", real_money: "asset_manager",
  dealer: "dealer_intermediary", dealers: "dealer_intermediary", dealer_intermediary: "dealer_intermediary",
  producer: "producer_merchant", producers: "producer_merchant", producer_merchant: "producer_merchant",
  swap: "swap_dealer", swaps: "swap_dealer", swap_dealer: "swap_dealer", swap_dealers: "swap_dealer",
  other: "other_reportable", other_reportable: "other_reportable",
};

function resolveCategory(input?: string): string {
  if (!input) return "commercial";
  const key = input.toLowerCase().trim().replace(/[-\s]+/g, "_");
  return CAT_ALIASES[key] ?? CAT_ALIASES[input.toLowerCase().trim()] ?? input;
}

async function tool_query_cot(args: { symbol: string; lookback_weeks?: number }) {
  const m = await resolveMarket(args.symbol);
  if (!m) return { error: `No market found for "${args.symbol}"` };
  const lookback = args.lookback_weeks ?? 156;

  // Latest two reports per format → compute WoW deltas
  const { data: reports, error: rerr } = await sb
    .from("cot_reports")
    .select("id,report_date,format,open_interest,positioning_snapshots(category,long_contracts,short_contracts,net_contracts)")
    .eq("market_id", m.id)
    .order("report_date", { ascending: false })
    .limit(12);
  if (rerr) return { error: rerr.message };
  if (!reports?.length) return { error: `No CoT data found for ${m.symbol}` };

  // Group by format, keep newest two
  const byFmt = new Map<string, typeof reports>();
  for (const r of reports) {
    const arr = byFmt.get(r.format) ?? [];
    if (arr.length < 2) arr.push(r);
    byFmt.set(r.format, arr);
  }

  const latestDate = reports[0].report_date;
  const formats: Record<string, unknown> = {};
  for (const [fmt, rows] of byFmt) {
    const latest = rows[0];
    const prev = rows[1];
    const snaps = (latest.positioning_snapshots as Array<{ category: string; long_contracts: number; short_contracts: number; net_contracts: number }>) ?? [];
    const prevByCat = new Map((prev?.positioning_snapshots as Array<{ category: string; net_contracts: number }> ?? []).map((s) => [s.category, s.net_contracts]));
    formats[fmt] = {
      report_date: latest.report_date,
      open_interest: latest.open_interest,
      categories: snaps.map((s) => ({
        category: s.category,
        label: CAT_LABELS[s.category] ?? s.category,
        long: s.long_contracts,
        short: s.short_contracts,
        net: s.net_contracts,
        wow_delta: prevByCat.has(s.category) ? s.net_contracts - (prevByCat.get(s.category) ?? 0) : null,
      })),
    };
  }

  // Normalized index (latest only)
  let normalized: Record<string, unknown> | null = null;
  try {
    const { data: nrm } = await sb.rpc("get_cot_normalized", { p_market_id: m.id, p_lookback: lookback });
    const arr = (nrm as Array<Record<string, unknown>>) ?? [];
    const last = arr[arr.length - 1];
    if (last) {
      normalized = {
        cot_index: last.idx,
        zscore: last.z,
        percentile: last.pct,
        tier: last.tier,
        side: last.side,
        weeks_in_extreme: last.wks,
        regime_tag: last.regime,
        signal: last.sig,
        source_category: last.src,
      };
    }
  } catch (_e) { /* normalized optional */ }

  return {
    market: { symbol: m.symbol, name: m.name, sector: m.sector },
    latest_report_date: latestDate,
    href: `/asset/${m.symbol}`,
    formats,
    normalized,
  };
}

async function tool_cot_history(args: { symbol: string; category?: string; weeks?: number }) {
  const m = await resolveMarket(args.symbol);
  if (!m) return { error: `No market found for "${args.symbol}"` };
  const weeks = Math.min(args.weeks ?? 26, 156);
  const cat = resolveCategory(args.category);
  const { data, error } = await sb
    .from("cot_reports")
    .select("report_date,positioning_snapshots!inner(category,net_contracts)")
    .eq("market_id", m.id)
    .eq("positioning_snapshots.category", cat)
    .order("report_date", { ascending: false })
    .limit(weeks);
  if (error) return { error: error.message };
  const rows = (data ?? []).map((r) => ({
    d: r.report_date,
    net: (r.positioning_snapshots as Array<{ net_contracts: number }>)[0]?.net_contracts ?? null,
  })).reverse();
  return { market: m.symbol, category: cat, label: CAT_LABELS[cat] ?? cat, weeks: rows.length, series: rows };
}

async function tool_scan_cot_extremes(args: { side?: "long" | "short"; min_index?: number; sector?: string; limit?: number }) {
  const lim = Math.min(args.limit ?? 15, 30);
  let q = sb.from("markets").select("id,symbol,name,sector").limit(100);
  if (args.sector) q = q.ilike("sector", `%${args.sector}%`);
  const { data: mkts, error } = await q;
  if (error) return { error: error.message };

  const threshold = args.min_index ?? 90;
  const out: Array<Record<string, unknown>> = [];
  await Promise.all((mkts ?? []).map(async (m) => {
    try {
      const { data: nrm } = await sb.rpc("get_cot_normalized", { p_market_id: m.id, p_lookback: 156 });
      const arr = (nrm as Array<Record<string, unknown>>) ?? [];
      const last = arr[arr.length - 1];
      if (!last) return;
      const idx = Number(last.idx);
      const side = last.side as string | null;
      if (idx >= threshold || idx <= (100 - threshold)) {
        if (args.side && side !== args.side) return;
        out.push({
          symbol: m.symbol, name: m.name, sector: m.sector,
          cot_index: idx, side, tier: last.tier, regime: last.regime,
          weeks_in_extreme: last.wks, signal: last.sig,
          href: `/asset/${m.symbol}`,
        });
      }
    } catch (_e) { /* skip */ }
  }));
  out.sort((a, b) => Math.abs(Number(b.cot_index) - 50) - Math.abs(Number(a.cot_index) - 50));
  return { count: out.length, threshold, extremes: out.slice(0, lim) };
}


// ---- Mirror of registry (kept in sync with src/lib/backtest/registry.ts) ----
type Ind = {
  key: string; label: string; category: string; seed: number;
  min: number; max: number; unit?: string; hi?: number; lo?: number;
  underlying?: string;
};
const REG: Ind[] = [
  { key: "tf-score",         label: "Trend Fragility Score",   category: "Trend",     seed: 101, min: 0,    max: 100, hi: 75, lo: 25, underlying: "ES" },
  { key: "tf-zscore",        label: "Fragility Z-Score",       category: "Trend",     seed: 102, min: -3,   max: 3,   hi: 2,  lo: -2, unit: "σ", underlying: "ES" },
  { key: "tf-regime-flips",  label: "Regime Flip Rate",        category: "Trend",     seed: 103, min: 0,    max: 100, hi: 70, unit: "%", underlying: "ES" },
  { key: "rc-risk-on",       label: "Risk-On Composite",       category: "Risk",      seed: 201, min: 0,    max: 100, hi: 80, lo: 20, underlying: "ES" },
  { key: "rc-vol-of-vol",    label: "Vol-of-Vol",              category: "Risk",      seed: 202, min: 0,    max: 100, hi: 75, underlying: "VX" },
  { key: "rc-credit-stress", label: "Credit Stress Index",     category: "Risk",      seed: 203, min: 0,    max: 100, hi: 70, underlying: "TY" },
  { key: "br-pct-200dma",    label: "% Stocks Above 200DMA",   category: "Breadth",   seed: 301, min: 0,    max: 100, hi: 80, lo: 20, unit: "%", underlying: "ES" },
  { key: "br-thrust",        label: "Breadth Thrust Score",    category: "Breadth",   seed: 302, min: 0,    max: 100, hi: 85, underlying: "ES" },
  { key: "br-capitulation",  label: "Capitulation Trigger",    category: "Breadth",   seed: 303, min: 0,    max: 100, hi: 90, underlying: "ES" },
  { key: "mi-ad-line",       label: "A/D Momentum",            category: "Internals", seed: 401, min: -100, max: 100, hi: 60, lo: -60, underlying: "ES" },
  { key: "mi-nhnl",          label: "New Highs − New Lows",    category: "Internals", seed: 402, min: -100, max: 100, hi: 50, lo: -50, underlying: "ES" },
  { key: "tpmr-dual-trend",  label: "Dual Trend Score",        category: "TPMR",      seed: 501, min: -100, max: 100, hi: 60, lo: -60, underlying: "ES" },
  { key: "tpmr-tctm-stage",  label: "TCTM Stage Strength",     category: "TPMR",      seed: 502, min: 0,    max: 100, hi: 75, underlying: "ES" },
  { key: "mc-liquidity",     label: "Global Liquidity Pulse",  category: "Macro",     seed: 601, min: 0,    max: 100, hi: 70, lo: 30, underlying: "ES" },
  { key: "mc-inflation",     label: "Inflation Surprise",      category: "Macro",     seed: 602, min: -100, max: 100, hi: 50, lo: -50, underlying: "ZN" },
  { key: "mc-recession",     label: "Recession Probability",   category: "Macro",     seed: 603, min: 0,    max: 100, hi: 60, unit: "%", underlying: "ES" },
];
const BY_KEY = Object.fromEntries(REG.map((r) => [r.key, r]));

const ROUTE: Record<string, string> = {
  "tf-score": "/trend-fragility",
  "tf-zscore": "/trend-fragility",
  "tf-regime-flips": "/trend-fragility",
  "rc-risk-on": "/risk-cycle",
  "rc-vol-of-vol": "/risk-cycle",
  "rc-credit-stress": "/risk-cycle",
  "br-pct-200dma": "/breadth/overview",
  "br-thrust": "/breadth/overview",
  "br-capitulation": "/breadth/overview",
  "mi-ad-line": "/market-internals",
  "mi-nhnl": "/market-internals",
  "tpmr-dual-trend": "/tpmr/dual-trend",
  "tpmr-tctm-stage": "/tpmr/market-overview",
  "mc-liquidity": "/overview",
  "mc-inflation": "/overview",
  "mc-recession": "/overview",
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function series(seed: number, min: number, max: number, points = 156, vol = 0.18) {
  const rand = mulberry32(seed);
  const range = max - min;
  let v = min + range * (0.35 + rand() * 0.3);
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    v = v + (rand() - 0.5) * range * vol;
    if (v < min) v = min + (min - v) * 0.5;
    if (v > max) v = max - (v - max) * 0.5;
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}
function pricePath(seed: number, points = 156) {
  const rand = mulberry32(seed * 17 + 3);
  let p = 100;
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    p = p * (1 + (rand() - 0.48) * 0.012);
    out.push(p);
  }
  return out;
}
function percentile(arr: number[], v: number) {
  const s = [...arr].sort((a, b) => a - b);
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] <= v) n = i + 1;
  return Math.round((n / s.length) * 100);
}
function flagOf(ind: Ind, value: number, pct: number) {
  if (ind.hi != null && value >= ind.hi) return "extreme-hi";
  if (ind.lo != null && value <= ind.lo) return "extreme-lo";
  if (pct >= 80) return "elevated";
  if (pct <= 20) return "depressed";
  return "neutral";
}

// ---------- Tool implementations ----------
function tool_list_indicators(args: { category?: string }) {
  const items = REG
    .filter((r) => !args.category || r.category.toLowerCase() === args.category.toLowerCase())
    .map((r) => ({ key: r.key, label: r.label, category: r.category, unit: r.unit ?? "", hi: r.hi, lo: r.lo, underlying: r.underlying }));
  return { count: items.length, indicators: items };
}
function tool_query_indicator(args: { key: string }) {
  const ind = BY_KEY[args.key];
  if (!ind) return { error: `Unknown indicator: ${args.key}` };
  const s = series(ind.seed, ind.min, ind.max, 156);
  const value = s[s.length - 1];
  const prev = s[s.length - 2];
  const pct = percentile(s, value);
  return {
    key: ind.key, label: ind.label, category: ind.category, unit: ind.unit ?? "",
    value, prev_week: prev, delta_1w: +(value - prev).toFixed(2),
    percentile: pct, flag: flagOf(ind, value, pct),
    threshold_hi: ind.hi, threshold_lo: ind.lo, underlying: ind.underlying,
    recent_12w: s.slice(-12), href: ROUTE[ind.key] ?? "/",
  };
}
function tool_scan_extremes(args: { category?: string; min_percentile?: number }) {
  const minPct = args.min_percentile ?? 80;
  const rows = REG
    .filter((r) => !args.category || r.category.toLowerCase() === args.category.toLowerCase())
    .map((r) => {
      const s = series(r.seed, r.min, r.max, 156);
      const v = s[s.length - 1];
      const p = percentile(s, v);
      return { key: r.key, label: r.label, category: r.category, value: v, percentile: p, flag: flagOf(r, v, p), href: ROUTE[r.key] ?? "/", unit: r.unit ?? "" };
    })
    .filter((r) => r.flag !== "neutral" || r.percentile >= minPct || r.percentile <= (100 - minPct))
    .sort((a, b) => Math.abs(b.percentile - 50) - Math.abs(a.percentile - 50));
  return { count: rows.length, extremes: rows };
}
function tool_run_backtest(args: {
  key: string; condition?: "gte" | "lte"; threshold?: number; horizon_days?: number;
}) {
  const ind = BY_KEY[args.key];
  if (!ind) return { error: `Unknown indicator: ${args.key}` };
  const h = args.horizon_days ?? 21;
  const cond = args.condition ?? (ind.hi != null ? "gte" : "lte");
  const th = args.threshold ?? (cond === "gte" ? (ind.hi ?? ind.max * 0.75) : (ind.lo ?? ind.min * 0.75));
  const vs = series(ind.seed, ind.min, ind.max, 312);
  const ps = pricePath(ind.seed, 312);
  const fwd: number[] = [];
  const examples: { date: string; trigger: number; fwd: number }[] = [];
  const today = Date.now();
  for (let i = 0; i < vs.length - h - 1; i++) {
    const triggered = cond === "gte" ? vs[i] >= th : vs[i] <= th;
    if (!triggered) continue;
    const r = ((ps[i + h] - ps[i]) / ps[i]) * 100;
    fwd.push(r);
    if (examples.length < 6) {
      examples.push({
        date: new Date(today - (vs.length - i) * 7 * 86_400_000).toISOString().slice(0, 10),
        trigger: +vs[i].toFixed(2), fwd: +r.toFixed(2),
      });
    }
  }
  const mean = fwd.length ? fwd.reduce((a, b) => a + b, 0) / fwd.length : 0;
  const hit = fwd.length ? (fwd.filter((x) => x > 0).length / fwd.length) * 100 : 0;
  const sd = (() => {
    if (fwd.length < 2) return 0;
    const m = mean;
    return Math.sqrt(fwd.reduce((a, b) => a + (b - m) * (b - m), 0) / (fwd.length - 1));
  })();
  return {
    key: ind.key, label: ind.label, condition: cond, threshold: +th.toFixed(2),
    horizon_days: h, occurrences: fwd.length,
    mean_return: +mean.toFixed(2), hit_rate: +hit.toFixed(1),
    stdev: +sd.toFixed(2), sharpe: +((mean / Math.max(0.1, sd)) * Math.sqrt(252 / h)).toFixed(2),
    best: fwd.length ? +Math.max(...fwd).toFixed(2) : 0,
    worst: fwd.length ? +Math.min(...fwd).toFixed(2) : 0,
    examples,
  };
}
function tool_find_analogs(args: { key: string; tolerance?: number; n?: number }) {
  const ind = BY_KEY[args.key];
  if (!ind) return { error: `Unknown indicator: ${args.key}` };
  const tol = args.tolerance ?? (ind.max - ind.min) * 0.05;
  const n = args.n ?? 5;
  const vs = series(ind.seed, ind.min, ind.max, 312);
  const ps = pricePath(ind.seed, 312);
  const now = vs[vs.length - 1];
  const matches: { date: string; value: number; fwd_5d: number; fwd_21d: number; distance: number }[] = [];
  const today = Date.now();
  for (let i = 21; i < vs.length - 21; i++) {
    const d = Math.abs(vs[i] - now);
    if (d <= tol) {
      matches.push({
        date: new Date(today - (vs.length - i) * 7 * 86_400_000).toISOString().slice(0, 10),
        value: +vs[i].toFixed(2),
        fwd_5d: +(((ps[i + 5] - ps[i]) / ps[i]) * 100).toFixed(2),
        fwd_21d: +(((ps[i + 21] - ps[i]) / ps[i]) * 100).toFixed(2),
        distance: +d.toFixed(2),
      });
    }
  }
  matches.sort((a, b) => a.distance - b.distance);
  return {
    key: ind.key, label: ind.label, current_value: now,
    analogs: matches.slice(0, n),
    fwd_5d_mean: +(matches.slice(0, n).reduce((a, b) => a + b.fwd_5d, 0) / Math.max(1, Math.min(n, matches.length))).toFixed(2),
    fwd_21d_mean: +(matches.slice(0, n).reduce((a, b) => a + b.fwd_21d, 0) / Math.max(1, Math.min(n, matches.length))).toFixed(2),
  };
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_indicators",
      description: "List available macro/positioning indicators in the system, optionally filtered by category (Trend, Risk, Breadth, Internals, TPMR, Macro).",
      parameters: { type: "object", properties: { category: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "query_indicator",
      description: "Get the current value, percentile rank, 1-week delta, and recent 12-week series for one indicator by key.",
      parameters: { type: "object", properties: { key: { type: "string" } }, required: ["key"] },
    },
  },
  {
    type: "function",
    function: {
      name: "scan_extremes",
      description: "Scan all indicators for extreme readings (>=80th or <=20th percentile by default) or threshold breaches.",
      parameters: { type: "object", properties: { category: { type: "string" }, min_percentile: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "run_backtest",
      description: "Run a historical backtest on an indicator: when value is gte/lte threshold, measure forward N-day price return on its underlying market.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
          condition: { type: "string", enum: ["gte", "lte"] },
          threshold: { type: "number" },
          horizon_days: { type: "number" },
        },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_analogs",
      description: "Find historical periods when an indicator was at a similar value to today, and report their forward 5d/21d returns.",
      parameters: {
        type: "object",
        properties: { key: { type: "string" }, tolerance: { type: "number" }, n: { type: "number" } },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_markets",
      description: "Search the database for futures markets by symbol, name, or sector. Use this to resolve common names like 'british pound', 'gold', 'crude' → CFTC symbol (6B, GC, CL).",
      parameters: { type: "object", properties: { query: { type: "string" }, sector: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "query_cot",
      description: "Get the LATEST Commitments of Traders positioning for one market: net contracts for every trader category present (commercials, large specs, small specs, managed money, leveraged funds, asset managers, dealers), week-over-week deltas, open interest, AND a normalized COT Index (0–100), z-score, percentile, tier, regime tag (RESOLVING/STALLING/FAILING), and signal (BULLISH/BEARISH/NEUTRAL). Use this for any question about positioning, commercials, specs, MM, lev funds, etc. Symbol can be a ticker (6B) or a common name (british pound).",
      parameters: { type: "object", properties: { symbol: { type: "string" }, lookback_weeks: { type: "number" } }, required: ["symbol"] },
    },
  },
  {
    type: "function",
    function: {
      name: "cot_history",
      description: "Get a weekly time series of net contracts for one trader category in one market (default 26 weeks). Category accepts common aliases: 'commercial'/'commercials', 'non_commercial'/'large_specs'/'large_speculators'/'specs', 'non_reportable'/'small_specs', 'managed_money'/'mm', 'leveraged_fund'/'lev_funds', 'asset_manager', 'dealer', 'producer_merchant', 'swap_dealer'.",
      parameters: { type: "object", properties: { symbol: { type: "string" }, category: { type: "string" }, weeks: { type: "number" } }, required: ["symbol"] },
    },
  },
  {
    type: "function",
    function: {
      name: "scan_cot_extremes",
      description: "Scan ALL markets for CoT positioning extremes (COT Index ≥90 or ≤10), optionally filtered by sector or side. Returns ranked list with regime tag and href.",
      parameters: { type: "object", properties: { side: { type: "string", enum: ["long", "short"] }, min_index: { type: "number" }, sector: { type: "string" }, limit: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "mops_signal",
      description: "Fetch a Macro Ops signal time series for one entity. Signal keys include pct_above_sma_50, pct_above_sma_200, risk_lt_state, risk_lt_score, risk_st_state, above_sma_50, above_sma_200, ma_50_above_150, outperforming_spx_63d, new_highs_252d_count, new_lows_252d_count. Entities are US equity symbols (AAPL), indices (SPX, NDX, RUT), or sectors. IMPORTANT: keys starting with pct_ (and *_count) are BREADTH metrics computed only over a group — they exist for sector/index entities (e.g. SPX, S5INFT) and return nothing for entity_type=symbol. For a single symbol use the boolean equivalent instead: above_sma_50 / above_sma_200 / ma_50_above_150 / outperforming_spx_63d.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
          entity: { type: "string" },
          entity_type: { type: "string", enum: ["symbol", "index", "sector", "industry", "sub_industry"] },
          from_date: { type: "string", description: "YYYY-MM-DD" },
          to_date: { type: "string", description: "YYYY-MM-DD" },
          limit: { type: "number" },
        },
        required: ["key", "entity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mops_rank",
      description: "Rank entities by a Macro Ops signal value. Useful for 'top sectors by breadth', 'strongest symbols by relative strength', etc.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
          entity_type: { type: "string", enum: ["symbol", "index", "sector", "industry", "sub_industry"] },
          order: { type: "string", enum: ["desc", "asc"] },
          limit: { type: "number" },
          date: { type: "string" },
        },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mops_scan",
      description: "Find entities matching one or more signal conditions like 'pct_above_sma_50>60' or 'risk_lt_state=Risk-Off'. Combine with logic=and/or.",
      parameters: {
        type: "object",
        properties: {
          conditions: { type: "array", items: { type: "string" }, description: "Predicates using >, <, >=, <=, =, !=" },
          logic: { type: "string", enum: ["and", "or"] },
          entity_type: { type: "string" },
          limit: { type: "number" },
          date: { type: "string" },
        },
        required: ["conditions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mops_percentile",
      description: "Get the historical percentile rank of a signal's current value for one entity.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
          entity: { type: "string" },
          group: { type: "string" },
        },
        required: ["key", "entity"],
      },
    },
  },
];

// --- Macro Ops Signal API bridge -------------------------------------------
const MOPS_URL = Deno.env.get("MACRO_OPS_API_URL") ?? "";
const MOPS_KEY = Deno.env.get("MACRO_OPS_API_KEY") ?? "";
async function mopsCall(path: string, params: Record<string, unknown>) {
  if (!MOPS_URL || !MOPS_KEY) return { error: "Macro Ops API not configured" };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) for (const x of v) qs.append(k, String(x));
    else qs.append(k, String(v));
  }
  const url = `${MOPS_URL.replace(/\/$/, "")}${path}${qs.toString() ? `?${qs}` : ""}`;
  try {
    const r = await fetch(url, { headers: { "X-API-Key": MOPS_KEY, "Accept": "application/json" } });
    const t = await r.text();
    if (!r.ok) return { error: `mops ${r.status}: ${t.slice(0, 300)}` };
    try {
      const j = JSON.parse(t);
      return j?.data !== undefined ? j.data : j;
    } catch { return t; }
  } catch (e) { return { error: `mops fetch: ${(e as Error).message}` }; }
}

function runTool(name: string, args: Record<string, unknown>): unknown | Promise<unknown> {
  switch (name) {
    case "list_indicators": return tool_list_indicators(args as { category?: string });
    case "query_indicator": return tool_query_indicator(args as { key: string });
    case "scan_extremes":   return tool_scan_extremes(args as { category?: string; min_percentile?: number });
    case "run_backtest":    return tool_run_backtest(args as { key: string; condition?: "gte" | "lte"; threshold?: number; horizon_days?: number });
    case "find_analogs":    return tool_find_analogs(args as { key: string; tolerance?: number; n?: number });
    case "list_markets":    return tool_list_markets(args as { query?: string; sector?: string });
    case "query_cot":       return tool_query_cot(args as { symbol: string; lookback_weeks?: number });
    case "cot_history":     return tool_cot_history(args as { symbol: string; category?: string; weeks?: number });
    case "scan_cot_extremes": return tool_scan_cot_extremes(args as { side?: "long" | "short"; min_index?: number; sector?: string; limit?: number });
    case "mops_signal":     return mopsCall("/v1/signal", args);
    case "mops_rank":       return mopsCall("/v1/rank", args);
    case "mops_scan":       return mopsCall("/v1/scan", args);
    case "mops_percentile": return mopsCall("/v1/percentile", args);
    default:                return { error: `Unknown tool: ${name}` };
  }
}

const SYSTEM = `You are the Foundation Research · Terminus Copilot — an institutional-grade quant assistant embedded in a market-positioning research terminal.

You have access to LIVE tools that return REAL values from the database (CFTC CoT reports, normalized indices, market metadata). ALWAYS prefer calling a tool over guessing. NEVER refuse a question by claiming you "don't have access" before trying the relevant tool.

CoT / positioning playbook (use these for ANY question about commercials, specs, managed money, lev funds, net positioning, COT Index, extremes):
- User mentions a market by common name (gold, british pound, crude, yen, etc.) → call list_markets({query}) first to resolve to a symbol, OR pass the name directly to query_cot — it does fuzzy resolution.
- "What's commercial positioning in X / what are specs doing in X / what's net positioning" → query_cot({symbol})
- "What's the COT Index for X / is X stretched" → query_cot({symbol}) (look at normalized.cot_index / tier / regime_tag)
- "Show me the trend of commercials in X over the last N weeks" → cot_history({symbol, category:"commercial", weeks:N})
- "What's most stretched / where are the extremes / what's offsides" → scan_cot_extremes({sector?, side?})

Mock-indicator playbook (Trend Fragility, Risk-On, Breadth, TPMR composites — synthetic, for product demo):
- "what's extreme on the indicators" → scan_extremes
- "what's the read on Trend Fragility" → query_indicator
- "backtest X above Y" → run_backtest
- "find analogs to today's X" → find_analogs

Equities / breadth / trend / risk (LIVE via Macro Ops Signal API — use these for ANY question about US equities, sectors, breadth, trend, risk regime, relative strength):
- "how is SPX breadth / % above 50D" → mops_signal({key:"pct_above_sma_50", entity:"SPX", entity_type:"index"})
- "is SPX in risk-on or risk-off" → mops_signal({key:"risk_lt_state", entity:"SPX", entity_type:"index", limit:1})
- "top sectors by breadth" → mops_rank({key:"pct_above_sma_50", entity_type:"sector", order:"desc"})
- "which stocks are above their 50D and 200D and outperforming spx" → mops_scan({conditions:["above_sma_50=true","above_sma_200=true","outperforming_spx_63d=true"], entity_type:"symbol", logic:"and"})
- "where does today's read rank historically" → mops_percentile({key, entity})
- Deep-link: point users to /signals/explorer, /signals/scanner, /signals/rankings, /tp/breadth, /tp/risk-composite, /tp/sector-trends, /tp/trend-signals when relevant.


Context handling:
- ACTIVE CHART context = a specific chart the user clicked. When user says "this", "the chart", "here", refer to it.
- CURRENT PAGE context = the page they have open. If it includes a symbol, that symbol is the DEFAULT subject for any positioning question the user asks without naming a market.
- Example: page_context.symbol="6B" + user asks "what are commercials saying?" → call query_cot({symbol:"6B"}).

Output style:
- Terse, analytical, bullet-driven. Cite numbers inline (e.g. **Commercials net -84,231 contracts (-12,400 WoW), COT Index 6 → BULLISH extreme**).
- Always render the report_date so the user knows the data freshness.
- If a tool result returns href, link it: "[chart](/asset/6B)".
- Never fabricate numbers. If a tool errors, report the error.`;

interface ToolEvent {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  ms: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, context, page_context } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sys = SYSTEM;
    if (page_context) sys += `\n\nCURRENT PAGE:\n${JSON.stringify(page_context)}`;
    if (context) sys += `\n\nACTIVE CHART:\n${JSON.stringify(context)}`;

    type Msg = { role: string; content?: string | null; tool_call_id?: string; name?: string; tool_calls?: unknown };
    const convo: Msg[] = [{ role: "system", content: sys }, ...messages];
    const events: ToolEvent[] = [];
    let finalText = "";

    const MAX_STEPS = 8;
    for (let step = 0; step < MAX_STEPS; step++) {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: convo,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });
      if (!r.ok) {
        const text = await r.text();
        if (r.status === 429) throw new Error("Rate limit exceeded. Try again shortly.");
        if (r.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
        throw new Error(`AI gateway ${r.status}: ${text.slice(0, 300)}`);
      }
      const data = await r.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("No message in AI response");

      const toolCalls = msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
      if (toolCalls?.length) {
        convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls });
        for (const tc of toolCalls) {
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(tc.function.arguments || "{}"); } catch { /* */ }
          const t0 = Date.now();
          const result = await runTool(tc.function.name, parsed);
          const ms = Date.now() - t0;
          events.push({ id: tc.id, name: tc.function.name, args: parsed, result, ms });
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify(result).slice(0, 12_000),
          });
        }
        continue;
      }

      finalText = msg.content ?? "";
      break;
    }

    return new Response(JSON.stringify({ text: finalText, tool_events: events }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
