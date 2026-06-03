// Generates (and caches) a daily AI market briefing.
// GET  -> returns today's briefing (404 if none)
// POST -> generates & upserts today's briefing (force=true to regenerate)
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// ---- Indicator snapshot (mirrors src/lib/backtest/registry.ts) ----
type Ind = { key: string; label: string; category: string; seed: number; min: number; max: number; drift?: number; vol?: number; unit?: string; hi?: number; lo?: number };
const INDICATORS: Ind[] = [
  { key: "tf-score",        label: "Trend Fragility",          category: "Trend",     seed: 101, min: 0,  max: 100, hi: 75, lo: 25 },
  { key: "tf-zscore",       label: "Fragility Z-Score",        category: "Trend",     seed: 102, min: -3, max: 3,   hi: 2,  lo: -2, unit: "σ" },
  { key: "rc-risk-on",      label: "Risk-On Composite",        category: "Risk",      seed: 201, min: 0,  max: 100, hi: 80, lo: 20 },
  { key: "rc-vol-of-vol",   label: "Vol-of-Vol",               category: "Risk",      seed: 202, min: 0,  max: 100, hi: 75 },
  { key: "rc-credit-stress",label: "Credit Stress",            category: "Risk",      seed: 203, min: 0,  max: 100, hi: 70 },
  { key: "br-pct-200dma",   label: "% > 200DMA",               category: "Breadth",   seed: 301, min: 0,  max: 100, hi: 80, lo: 20, unit: "%" },
  { key: "br-thrust",       label: "Breadth Thrust",           category: "Breadth",   seed: 302, min: 0,  max: 100, hi: 85 },
  { key: "br-capitulation", label: "Capitulation Trigger",     category: "Breadth",   seed: 303, min: 0,  max: 100, hi: 90 },
  { key: "mi-ad-line",      label: "A/D Momentum",             category: "Internals", seed: 401, min: -100, max: 100, hi: 60, lo: -60 },
  { key: "mi-nhnl",         label: "New Highs − Lows",         category: "Internals", seed: 402, min: -100, max: 100, hi: 50, lo: -50 },
  { key: "mc-liquidity",    label: "Liquidity Pulse",          category: "Macro",     seed: 601, min: 0,  max: 100, hi: 70, lo: 30 },
  { key: "mc-inflation",    label: "Inflation Surprise",       category: "Macro",     seed: 602, min: -100, max: 100, hi: 50, lo: -50 },
  { key: "mc-recession",    label: "Recession Probability",    category: "Macro",     seed: 603, min: 0,  max: 100, hi: 60, unit: "%" },
];

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

function series(seed: number, min: number, max: number, points = 78, drift = 0, vol = 0.18) {
  const rand = mulberry32(seed);
  const range = max - min;
  let v = min + range * (0.35 + rand() * 0.3);
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    v = v + (rand() - 0.5) * range * vol + (drift * range) / points;
    if (v < min) v = min + (min - v) * 0.5;
    if (v > max) v = max - (v - max) * 0.5;
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

function percentileRank(arr: number[], v: number) {
  const sorted = [...arr].sort((a, b) => a - b);
  let lo = 0;
  for (let i = 0; i < sorted.length; i++) if (sorted[i] <= v) lo = i + 1;
  return Math.round((lo / sorted.length) * 100);
}

interface SnapshotRow {
  key: string;
  label: string;
  category: string;
  value: number;
  prev_week: number;
  delta_1w: number;
  percentile: number;
  unit: string;
  threshold_hi?: number;
  threshold_lo?: number;
  flag: "extreme-hi" | "extreme-lo" | "elevated" | "depressed" | "neutral";
  crossed_hi?: boolean;
  crossed_lo?: boolean;
}

function buildSnapshot(): SnapshotRow[] {
  return INDICATORS.map((ind) => {
    const s = series(ind.seed, ind.min, ind.max, 78, ind.drift ?? 0, ind.vol ?? 0.18);
    const value = s[s.length - 1];
    const prev_week = s[s.length - 2] ?? value;
    const pct = percentileRank(s, value);
    let flag: SnapshotRow["flag"] = "neutral";
    if (ind.hi != null && value >= ind.hi) flag = "extreme-hi";
    else if (ind.lo != null && value <= ind.lo) flag = "extreme-lo";
    else if (pct >= 80) flag = "elevated";
    else if (pct <= 20) flag = "depressed";
    const crossed_hi = ind.hi != null && prev_week < ind.hi && value >= ind.hi;
    const crossed_lo = ind.lo != null && prev_week > ind.lo && value <= ind.lo;
    return {
      key: ind.key,
      label: ind.label,
      category: ind.category,
      value,
      prev_week,
      delta_1w: Math.round((value - prev_week) * 100) / 100,
      percentile: pct,
      unit: ind.unit ?? "",
      threshold_hi: ind.hi,
      threshold_lo: ind.lo,
      flag,
      crossed_hi: crossed_hi || undefined,
      crossed_lo: crossed_lo || undefined,
    };
  });
}

const ROUTE_FOR_CATEGORY: Record<string, string> = {
  Trend: "/trend-fragility",
  Risk: "/risk-cycle",
  Breadth: "/breadth/overview",
  Internals: "/market-internals",
  Macro: "/macro/mo-indicators",
};

async function generateBriefing(snapshot: SnapshotRow[]) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const highlights = snapshot
    .filter((r) => r.flag !== "neutral" || r.crossed_hi || r.crossed_lo)
    .sort((a, b) => Math.abs(b.percentile - 50) - Math.abs(a.percentile - 50));

  const sys = `You are the Macro HUD morning briefing engine. Generate a concise, institutional-grade markdown briefing for active prop traders. Style: terse, scannable, numerical, no fluff, no apologies, no preamble.

Format (strict):
## Tape at a Glance
2-3 sentence executive read of the current regime.

## What Changed Overnight
Bulleted list of indicators that crossed thresholds or moved meaningfully (>1 std). Cite the value and percentile inline like: **Trend Fragility 82.3 (94th %)**.

## Asymmetric Setups
2-4 bullets calling out crowding, divergences, or extremes worth a trade idea. Be specific about direction.

## Watch List
1-2 sentences on what to monitor today.

Reference indicator labels exactly as given. Do not invent values.`;

  const userPrompt = `Date: ${new Date().toISOString().slice(0, 10)}

CURRENT INDICATOR SNAPSHOT (value, 1w delta, percentile rank, flag):
${snapshot.map((r) => `- ${r.label} [${r.category}]: ${r.value}${r.unit} | Δ1w ${r.delta_1w >= 0 ? "+" : ""}${r.delta_1w} | ${r.percentile}th %ile | ${r.flag}${r.crossed_hi ? " | ⚠ crossed HI" : ""}${r.crossed_lo ? " | ⚠ crossed LO" : ""}`).join("\n")}

KEY HIGHLIGHTS:
${highlights.slice(0, 8).map((r) => `- ${r.label}: ${r.value}${r.unit} @ ${r.percentile}th, flag=${r.flag}`).join("\n")}

Generate the briefing.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, { role: "user", content: userPrompt }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    if (resp.status === 429) throw new Error("Rate limit exceeded. Try again shortly.");
    if (resp.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    throw new Error(`AI gateway error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const markdown = data.choices?.[0]?.message?.content ?? "_(no content)_";
  return { markdown, model: "google/gemini-2.5-flash", highlights: highlights.slice(0, 8) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date().toISOString().slice(0, 10);

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("daily_briefings")
        .select("*")
        .eq("briefing_date", today)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify(data ?? null), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: generate
    let force = false;
    try {
      const body = await req.json();
      force = !!body?.force;
    } catch { /* empty body ok */ }

    if (!force) {
      const { data: existing } = await supabase
        .from("daily_briefings")
        .select("*")
        .eq("briefing_date", today)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify(existing), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const snapshot = buildSnapshot();
    const { markdown, model, highlights } = await generateBriefing(snapshot);

    const { data: row, error: upsertErr } = await supabase
      .from("daily_briefings")
      .upsert(
        { briefing_date: today, markdown, snapshot, highlights, model },
        { onConflict: "briefing_date" },
      )
      .select()
      .single();
    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify(row), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
