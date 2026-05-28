// Deterministic mock series generator for scaffold pages.
// Same seed + length => same data. No external deps.

export type SeriesPoint = { t: string; v: number };

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

export interface MockOptions {
  seed?: number;
  points?: number;
  min?: number;
  max?: number;
  drift?: number;       // -1..1 long-run direction
  volatility?: number;  // 0..1
  startISO?: string;    // first timestamp; default 18 months ago
  stepDays?: number;    // spacing
}

export function mockSeries(opts: MockOptions = {}): SeriesPoint[] {
  const {
    seed = 1,
    points = 78, // ~1.5y weekly
    min = 0,
    max = 100,
    drift = 0,
    volatility = 0.18,
    stepDays = 7,
  } = opts;
  const rand = mulberry32(seed);
  const start = opts.startISO
    ? new Date(opts.startISO).getTime()
    : Date.now() - stepDays * 86_400_000 * points;
  const range = max - min;
  let v = min + range * (0.35 + rand() * 0.3);
  const out: SeriesPoint[] = [];
  for (let i = 0; i < points; i++) {
    const noise = (rand() - 0.5) * range * volatility;
    const trend = (drift * range) / points;
    v = v + noise + trend;
    if (v < min) v = min + (min - v) * 0.5;
    if (v > max) v = max - (v - max) * 0.5;
    const ts = new Date(start + i * stepDays * 86_400_000);
    out.push({ t: ts.toISOString().slice(0, 10), v: Math.round(v * 100) / 100 });
  }
  return out;
}

export function lastValue(s: SeriesPoint[]) {
  return s.length ? s[s.length - 1].v : 0;
}
