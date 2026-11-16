// Daily Dual Trend returns job. Reads /v1/prices (split_adjusted) for every
// symbol in the six Dual Trend universes and saves return + net vs the S&P 500
// per symbol + start date + as-of date into dual_trend_returns.
// POST {action:"tick"}  -> (cron) start today's run if new data, or resume a stalled one.
// POST {action:"chunk"} -> process the next CHUNK symbols, then call itself until done.
// Throttled to PER_MINUTE requests/min (the API's 100/min is shared with the app).
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildWorkList, computeReturn, epochDaysToIso, makeThrottle, type PriceRow } from "../_shared/dual-trend/returns-math.ts";

const TOKEN_SHA256 = "ff30f2d47b2289038f3d6de6f40ba75d018b95abad363e2433879b7bb5b1a3e2";
const PER_MINUTE = 40;
const CHUNK = 40;
const KEEP_DAYS = 15; // ~10 trading days
const STALE_MS = 5 * 60_000;
const SELF = `${Deno.env.get("SUPABASE_URL")}/functions/v1/dual-trend-returns-job`;
const BASE = Deno.env.get("MACRO_OPS_API_URL") ?? "";
const KEY = Deno.env.get("MACRO_OPS_API_KEY") ?? "";
const INDEXES = ["SPX", "MID", "SML"];
const LISTS = [
  "CUSTOM:ETF_SECTOR", "CUSTOM:ETF_INDUSTRY", "CUSTOM:ETF_THEMATIC", "CUSTOM:ETF_GLOBAL",
  "CUSTOM:ETF_INDEX_STYLE_FACTOR", "CUSTOM:ETF_COMMODITY_CRYPTO",
  "CUSTOM:STOCKS_GOLD_SILVER_MINERS", "CUSTOM:STOCKS_THEMATICS",
];

const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const throttle = makeThrottle(PER_MINUTE);
let requests = 0;

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function api(path: string, params: Record<string, string | number>): Promise<any> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle();
    requests++;
    const r = await fetch(`${BASE}${path}?${qs}`, { headers: { "X-API-Key": KEY } });
    if (r.status === 429) {
      const wait = Number(r.headers.get("retry-after") ?? 30);
      await r.body?.cancel();
      await new Promise((res) => setTimeout(res, Math.min(wait, 60) * 1000));
      continue;
    }
    if (!r.ok) { await r.body?.cancel(); throw new Error(`${path} ${r.status}`); }
    return r.json();
  }
  throw new Error(`${path} rate limited`);
}

async function signalAll(key: string, date: string) {
  const out: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const j = await api("/v1/signal", { key, date, entity_type: "symbol", limit: 1000, offset });
    const page = j?.data ?? [];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function prices(entity: string, start: string, end: string, extra: Record<string, string> = {}): Promise<PriceRow[]> {
  const out: PriceRow[] = [];
  let offset = 0;
  for (;;) {
    const j = await api("/v1/prices", { entity, date_start: start, date_end: end, limit: 1000, offset, ...extra });
    for (const r of j?.data ?? []) out.push({ date: r.date, close: Number(r.close) });
    if (j?.next_offset == null) break;
    offset = j.next_offset;
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const minus = (iso: string, days: number) =>
  new Date(Date.parse(iso + "T00:00:00Z") - days * 86_400_000).toISOString().slice(0, 10);

async function latestDate(): Promise<string> {
  const j = await api("/v1/signal", { key: "trend_rel_lt_state", entity: "AAPL", limit: 1 });
  return j?.data?.[0]?.date ?? "";
}

async function buildList(asOf: string) {
  const entries: { symbol: string; starts: string[] }[] = [];
  const [lt, st] = [await signalAll("trend_rel_lt_start", asOf), await signalAll("trend_rel_st_start", asOf)];
  const startOf = new Map<string, string[]>();
  for (const r of [...lt, ...st]) {
    const d = epochDaysToIso(r.value);
    if (!d) continue;
    const k = String(r.entity).toUpperCase();
    startOf.set(k, [...(startOf.get(k) ?? []), d]);
  }
  for (const idx of INDEXES) {
    const j = await api("/v1/members", { parent: idx, date: asOf });
    for (const s of j?.data ?? []) entries.push({ symbol: s, starts: startOf.get(String(s).toUpperCase()) ?? [] });
  }
  for (const id of LISTS) {
    const j = await api("/v1/custom-list-signals", { list_id: id, date: asOf });
    const p = j?.data ?? j ?? {};
    const inst = p.instruments ?? {};
    const members: string[] = p.memberships?.length ? p.memberships.map((m: any) => m.entity_a) : Object.keys(inst);
    for (const s of members) {
      const v = inst[s]?.values ?? {};
      entries.push({ symbol: s, starts: [epochDaysToIso(v.trend_rel_lt_start), epochDaysToIso(v.trend_rel_st_start)] });
    }
  }
  return buildWorkList(entries).filter((e) => e.starts.length);
}

function kick(token: string) {
  return fetch(SELF, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-dt-token": token },
    body: JSON.stringify({ action: "chunk" }),
  }).then((r) => r.body?.cancel()).catch((e) => console.error("[dt-returns] kick failed", String(e)));
}

async function tick(token: string) {
  const sb = db();
  const asOf = await latestDate();
  if (!asOf) return { status: "no_date" };
  const { data: run } = await sb.from("dual_trend_return_runs").select("*").eq("as_of", asOf).maybeSingle();
  if (run?.status === "done") return { status: "already_done", asOf };
  if (run && run.status === "running" && Date.now() - Date.parse(run.heartbeat_at) < STALE_MS) {
    return { status: "in_progress", asOf };
  }
  if (!run) {
    const items = await buildList(asOf);
    const earliest = items.reduce((m, i) => (i.starts[0] < m ? i.starts[0] : m), asOf);
    const spx = await prices("SPX", minus(earliest, 10), asOf, { entity_type: "index" });
    await sb.from("dual_trend_return_runs").insert({
      as_of: asOf, status: "running", cursor: 0, symbols: { items, spx },
      symbols_total: items.length, requests,
    });
  } else {
    await sb.from("dual_trend_return_runs").update({ status: "running", error: null, heartbeat_at: new Date().toISOString() }).eq("as_of", asOf);
  }
  EdgeRuntime.waitUntil(kick(token));
  return { status: run ? "resumed" : "started", asOf };
}

async function chunk(token: string) {
  const sb = db();
  const { data: run } = await sb.from("dual_trend_return_runs").select("*").eq("status", "running")
    .order("as_of", { ascending: false }).limit(1).maybeSingle();
  if (!run) return { status: "idle" };
  const asOf: string = run.as_of;
  const { items, spx } = run.symbols as { items: { symbol: string; starts: string[] }[]; spx: PriceRow[] };
  const slice = items.slice(run.cursor, run.cursor + CHUNK);
  try {
    const rows: any[] = [];
    for (const it of slice) {
      let series: PriceRow[] = [];
      try { series = await prices(it.symbol, minus(it.starts[0], 10), asOf, { basis: "split_adjusted" }); }
      catch (e) { console.error("[dt-returns]", it.symbol, String(e)); }
      for (const start of it.starts) {
        const r = computeReturn(series, spx, start, asOf);
        rows.push({ symbol: it.symbol, start_date: start, as_of: asOf, ret: r.ret, net: r.net, computed_at: new Date().toISOString() });
      }
    }
    if (rows.length) {
      const { error } = await sb.from("dual_trend_returns").upsert(rows, { onConflict: "symbol,start_date,as_of" });
      if (error) throw error;
    }
    const cursor = run.cursor + slice.length;
    const done = cursor >= items.length;
    await sb.from("dual_trend_return_runs").update({
      cursor, symbols_done: cursor, requests: run.requests + requests,
      heartbeat_at: new Date().toISOString(),
      ...(done ? { status: "done", finished_at: new Date().toISOString() } : {}),
    }).eq("as_of", asOf);
    if (done) {
      await sb.from("dual_trend_returns").delete().lt("as_of", minus(asOf, KEEP_DAYS));
    } else {
      EdgeRuntime.waitUntil(kick(token));
    }
    return { status: done ? "done" : "continuing", cursor, total: items.length };
  } catch (e) {
    await sb.from("dual_trend_return_runs").update({ status: "failed", error: String(e) }).eq("as_of", asOf);
    return { status: "failed", error: String(e) };
  }
}

Deno.serve(async (req) => {
  const token = req.headers.get("x-dt-token") ?? "";
  if (!token || (await sha256(token)) !== TOKEN_SHA256) return new Response("unauthorized", { status: 401 });
  if (!BASE || !KEY) return new Response("api not configured", { status: 500 });
  const b = await req.json().catch(() => ({}));
  const out = b?.action === "chunk" ? await chunk(token) : await tick(token);
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
