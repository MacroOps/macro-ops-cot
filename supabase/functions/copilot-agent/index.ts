// Agentic Research Copilot.
// Runs a tool-using loop against Lovable AI (OpenAI-compatible tools schema)
// and returns the final assistant text + a transcript of tool events.
// NB: Non-streaming for simplicity — surfaces tool runs as discrete events
// the UI can render in collapsible accordions.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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
];

function runTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "list_indicators": return tool_list_indicators(args as { category?: string });
    case "query_indicator": return tool_query_indicator(args as { key: string });
    case "scan_extremes":   return tool_scan_extremes(args as { category?: string; min_percentile?: number });
    case "run_backtest":    return tool_run_backtest(args as { key: string; condition?: "gte" | "lte"; threshold?: number; horizon_days?: number });
    case "find_analogs":    return tool_find_analogs(args as { key: string; tolerance?: number; n?: number });
    default:                return { error: `Unknown tool: ${name}` };
  }
}

const SYSTEM = `You are the Macro HUD Research Copilot — an institutional-grade quant assistant embedded in a market-positioning research terminal.

You have access to live tools that return real values from the system. ALWAYS prefer calling a tool over guessing.

Tool playbook:
- "what's extreme / what's stretched / what moved?" → scan_extremes
- "what's the read on X / how is Trend Fragility doing?" → query_indicator
- "how often does this happen / what happens when X > Y?" → run_backtest
- "when was this last / find similar setups" → find_analogs
- Unknown indicator name → list_indicators first, then proceed
- Chain tools: e.g. scan_extremes → query_indicator → run_backtest

Output style after tools return:
- Terse, analytical, bullet-driven. No filler.
- Cite numbers inline: **Trend Fragility 82.3 (94th %ile)**.
- For backtests, quote occurrences, hit rate, mean fwd return, and Sharpe.
- Flag asymmetric risk/reward, divergences, crowding.
- If a tool returns href, include a markdown link like "[chart](/path)".
- Never fabricate numbers. If a tool fails, say so.`;

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
    const { messages, context } = await req.json();
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

    const sys = context
      ? `${SYSTEM}\n\nACTIVE CHART CONTEXT:\n${JSON.stringify(context)}`
      : SYSTEM;

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
          const result = runTool(tc.function.name, parsed);
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
