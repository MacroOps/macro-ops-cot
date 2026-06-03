// Evaluates every active alert against the latest registry snapshot.
// Designed to be cron-invoked (e.g., every 15 minutes). Inserts a row into
// alert_events when an alert triggers and the cooldown has elapsed.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

type Ind = { key: string; label: string; seed: number; min: number; max: number; hi?: number; lo?: number };
const REG: Ind[] = [
  { key: "tf-score",        label: "Trend Fragility Score",  seed: 101, min: 0,    max: 100, hi: 75, lo: 25 },
  { key: "tf-zscore",       label: "Fragility Z-Score",      seed: 102, min: -3,   max: 3,   hi: 2,  lo: -2 },
  { key: "tf-regime-flips", label: "Regime Flip Rate",       seed: 103, min: 0,    max: 100, hi: 70 },
  { key: "rc-risk-on",      label: "Risk-On Composite",      seed: 201, min: 0,    max: 100, hi: 80, lo: 20 },
  { key: "rc-vol-of-vol",   label: "Vol-of-Vol",             seed: 202, min: 0,    max: 100, hi: 75 },
  { key: "rc-credit-stress",label: "Credit Stress Index",    seed: 203, min: 0,    max: 100, hi: 70 },
  { key: "br-pct-200dma",   label: "% Stocks Above 200DMA",  seed: 301, min: 0,    max: 100, hi: 80, lo: 20 },
  { key: "br-thrust",       label: "Breadth Thrust Score",   seed: 302, min: 0,    max: 100, hi: 85 },
  { key: "br-capitulation", label: "Capitulation Trigger",   seed: 303, min: 0,    max: 100, hi: 90 },
  { key: "mi-ad-line",      label: "A/D Momentum",           seed: 401, min: -100, max: 100, hi: 60, lo: -60 },
  { key: "mi-nhnl",         label: "New Highs − New Lows",   seed: 402, min: -100, max: 100, hi: 50, lo: -50 },
  { key: "tpmr-dual-trend", label: "Dual Trend Score",       seed: 501, min: -100, max: 100, hi: 60, lo: -60 },
  { key: "tpmr-tctm-stage", label: "TCTM Stage Strength",    seed: 502, min: 0,    max: 100, hi: 75 },
  { key: "mc-liquidity",    label: "Global Liquidity Pulse", seed: 601, min: 0,    max: 100, hi: 70, lo: 30 },
  { key: "mc-inflation",    label: "Inflation Surprise",     seed: 602, min: -100, max: 100, hi: 50, lo: -50 },
  { key: "mc-recession",    label: "Recession Probability",  seed: 603, min: 0,    max: 100, hi: 60 },
];
const BY_KEY = Object.fromEntries(REG.map((r) => [r.key, r]));

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
function percentile(arr: number[], v: number) {
  const s = [...arr].sort((a, b) => a - b);
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] <= v) n = i + 1;
  return Math.round((n / s.length) * 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, key);

  try {
    // Build current snapshot
    const snap: Record<string, { value: number; prev: number; percentile: number }> = {};
    for (const ind of REG) {
      const s = series(ind.seed, ind.min, ind.max, 156);
      const v = s[s.length - 1];
      const prev = s[s.length - 2];
      snap[ind.key] = { value: v, prev, percentile: percentile(s, v) };
    }

    const { data: alerts, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("active", true);
    if (error) throw error;

    const events: Array<Record<string, unknown>> = [];
    const updates: Array<{ id: string; last_fired_at: string; last_value: number }> = [];
    const now = Date.now();

    for (const a of alerts ?? []) {
      const ind = BY_KEY[a.indicator_key];
      if (!ind) continue;
      const s = snap[a.indicator_key];
      if (!s) continue;
      const th = Number(a.threshold);
      let triggered = false;
      switch (a.operator) {
        case "gte": triggered = s.value >= th; break;
        case "lte": triggered = s.value <= th; break;
        case "crosses_above": triggered = s.prev < th && s.value >= th; break;
        case "crosses_below": triggered = s.prev > th && s.value <= th; break;
      }
      if (!triggered) continue;

      // Cooldown
      if (a.last_fired_at) {
        const since = now - new Date(a.last_fired_at).getTime();
        if (since < (a.cooldown_minutes ?? 360) * 60_000) continue;
      }

      const message = `${ind.label} ${a.operator.replace("_", " ")} ${th} → now ${s.value} (${s.percentile}th %ile)`;
      events.push({
        alert_id: a.id,
        user_id: a.user_id,
        indicator_value: s.value,
        percentile: s.percentile,
        message,
      });
      updates.push({ id: a.id, last_fired_at: new Date().toISOString(), last_value: s.value });
    }

    if (events.length) {
      const { error: insErr } = await supabase.from("alert_events").insert(events);
      if (insErr) throw insErr;
    }
    for (const u of updates) {
      await supabase
        .from("alerts")
        .update({ last_fired_at: u.last_fired_at, last_value: u.last_value })
        .eq("id", u.id);
    }

    return new Response(JSON.stringify({ evaluated: alerts?.length ?? 0, fired: events.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
