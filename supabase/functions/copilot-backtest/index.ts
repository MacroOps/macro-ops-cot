// Deterministic synthetic backtest engine for the Copilot.
// Given (seed, threshold, direction, horizonDays) produces realistic-looking stats.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const {
    seed = 42,
    title = "Indicator",
    threshold = 75,
    direction = "above", // "above" | "below"
    horizons = [5, 21, 63],
    years = 12,
  } = body as {
    seed?: number; title?: string; threshold?: number;
    direction?: "above" | "below"; horizons?: number[]; years?: number;
  };

  const rand = mulberry32(seed + Math.round(threshold) * 7);
  const occurrences = Math.max(8, Math.round(8 + rand() * 60));

  const horizonStats = horizons.map((h) => {
    // bias by direction & threshold extremity
    const extremity = Math.min(1, Math.abs(threshold - 50) / 50);
    const bias = (direction === "above" ? -1 : 1) * extremity * (0.4 + rand() * 0.6);
    const meanRet = +(bias * (h / 21) * (1.2 + rand() * 1.4)).toFixed(2);
    const median = +(meanRet * (0.6 + rand() * 0.6)).toFixed(2);
    const hitRate = Math.round(50 + bias * 18 + (rand() - 0.5) * 8);
    const stdev = +(2 + rand() * 4 + h * 0.04).toFixed(2);
    const maxDD = +(-(2 + rand() * 8 + h * 0.05)).toFixed(2);
    const sharpe = +((meanRet / Math.max(0.1, stdev)) * Math.sqrt(252 / h)).toFixed(2);
    return { horizonDays: h, meanRet, median, hitRate, stdev, maxDD, sharpe };
  });

  // Recent example occurrences
  const today = Date.now();
  const examples = Array.from({ length: 6 }).map((_, i) => {
    const daysAgo = Math.round(30 + rand() * 1200);
    const r21 = +(((rand() - 0.5) * 6) + (horizonStats[1]?.meanRet ?? 0)).toFixed(2);
    return {
      date: new Date(today - daysAgo * 86_400_000).toISOString().slice(0, 10),
      triggerValue: +(threshold + (rand() - 0.5) * 10).toFixed(1),
      fwd21d: r21,
    };
  }).sort((a, b) => (a.date < b.date ? 1 : -1));

  const regimeNote =
    direction === "above"
      ? `When ${title} prints above ${threshold}, fwd returns skew negative — historically a contrarian fade signal.`
      : `When ${title} prints below ${threshold}, fwd returns skew positive — historically a contrarian buy signal.`;

  return new Response(
    JSON.stringify({
      title,
      threshold,
      direction,
      windowYears: years,
      occurrences,
      horizonStats,
      examples,
      regimeNote,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
