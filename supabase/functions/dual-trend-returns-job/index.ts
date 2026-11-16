// Daily Dual Trend job. Phases per as-of date, each in its own invocation:
//   members  -> dual_trend_members (SPX/MID/SML, their 33 sector groups, 8 custom lists)
//   keys     -> dual_trend_signals (10 trend_rel lt/st keys); marks the day ready
//   backfill -> lt/st state for the 5 prior trading days if not saved (5-day breadth change)
//   returns  -> /v1/prices (split_adjusted) per symbol, start dates read from SAVED signals.
// POST {action:"tick"}  -> (cron) start today's run if new data, or resume a stalled one.
// POST {action:"chunk"} -> process the next CHUNK symbols, then call itself until done.
// Throttled to PER_MINUTE requests/min (the API's 100/min is shared with the app).
import { createClient } from "npm:@supabase/supabase-js@2";
import { backfillDates, computeReturn, DT_KEYS, makeThrottle, mergeSnapshots, workListFromSaved, type PriceRow } from "../_shared/dual-trend/returns-math.ts";

const TOKEN_SHA256 = "ff30f2d47b2289038f3d6de6f40ba75d018b95abad363e2433879b7bb5b1a3e2";
const PER_MINUTE = 40;
const CHUNK = 40;
const KEEP_DAYS = 15; // ~10 trading days
const STALE_MS = 5 * 60_000;
const SELF = `${Deno.env.get("SUPABASE_URL")}/functions/v1/dual-trend-returns-job`;
const BASE = Deno.env.get("MACRO_OPS_API_URL") ?? "";
const KEY = Deno.env.get("MACRO_OPS_API_KEY") ?? "";
const INDEXES = ["SPX", "MID", "SML"];
const GICS = ["10","15","20","25","30","35","40","45","50","55","60"];
const SPX_GROUPS = ["S5ENRS","S5MATR","S5INDU","S5COND","S5CONS","S5HLTH","S5FINL","S5INFT","S5TELS","S5UTIL","S5RLST"];
const GROUPS = [...SPX_GROUPS, ...["MID", "SML"].flatMap((i) => GICS.map((c) => `${i}/sector/${c}`))];
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

async function upsertChunks(sb: any, table: string, rows: any[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function readAll(q: () => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

async function phaseMembers(sb: any, asOf: string) {
  const rows: any[] = [];
  for (const u of [...INDEXES, ...GROUPS]) {
    const j = await api("/v1/members", { parent: u, date: asOf });
    for (const s of new Set<string>(j?.data ?? [])) rows.push({ as_of: asOf, universe: u, symbol: s });
  }
  const listVals: any[] = [];
  for (const id of LISTS) {
    const j = await api("/v1/custom-list-signals", { list_id: id, date: asOf });
    const p = j?.data ?? j ?? {};
    const inst = p.instruments ?? {};
    const members: any[] = p.memberships?.length ? p.memberships : Object.keys(inst).map((s) => ({ entity_a: s }));
    const seen = new Set<string>();
    for (const m of members) {
      if (seen.has(m.entity_a)) continue;
      seen.add(m.entity_a);
      rows.push({
        as_of: asOf, universe: id, symbol: m.entity_a,
        name: m.metadata?.display_names?.[0] ?? m.canonical_name ?? null,
        sub_group: m.metadata?.categories?.join(", ") ?? null,
      });
      const v = inst[m.entity_a]?.values;
      if (v) listVals.push({ as_of: asOf, symbol: String(m.entity_a).toUpperCase(), vals: v });
    }
  }
  await upsertChunks(sb, "dual_trend_members", rows, "as_of,universe,symbol");
  // List values are a fallback; the keys phase overwrites symbols it covers.
  const uniq = [...new Map(listVals.map((r) => [r.symbol, r])).values()];
  await upsertChunks(sb, "dual_trend_signals", uniq, "as_of,symbol");
}

async function phaseKeys(sb: any, asOf: string) {
  const snaps: Record<string, any[]> = {};
  for (const k of DT_KEYS) snaps[k] = await signalAll(k, asOf);
  const merged = mergeSnapshots(snaps);
  await upsertChunks(sb, "dual_trend_signals", [...merged].map(([symbol, vals]) => ({ as_of: asOf, symbol, vals })), "as_of,symbol");
  const { error } = await sb.from("dual_trend_signal_days").upsert({ as_of: asOf, kind: "full", ready_at: new Date().toISOString() }, { onConflict: "as_of" });
  if (error) throw error;
}

async function phaseBackfill(sb: any, asOf: string) {
  const { data: saved } = await sb.from("dual_trend_signal_days").select("as_of").lt("as_of", asOf).gte("as_of", minus(asOf, KEEP_DAYS));
  const j = await api("/v1/signal", { key: "trend_rel_lt_state", entity: "AAPL", from_date: minus(asOf, 25), limit: 100 });
  const dates = backfillDates((j?.data ?? []).map((r: any) => r.date), (saved ?? []).map((r: any) => r.as_of), asOf);
  for (const d of dates) {
    const merged = mergeSnapshots({
      trend_rel_lt_state: await signalAll("trend_rel_lt_state", d),
      trend_rel_st_state: await signalAll("trend_rel_st_state", d),
    });
    await upsertChunks(sb, "dual_trend_signals", [...merged].map(([symbol, vals]) => ({ as_of: d, symbol, vals })), "as_of,symbol");
    await sb.from("dual_trend_signal_days").upsert({ as_of: d, kind: "states" }, { onConflict: "as_of" });
  }
  return dates;
}

async function buildList(sb: any, asOf: string) {
  const members = await readAll(() => sb.from("dual_trend_members").select("symbol").eq("as_of", asOf).in("universe", [...INDEXES, ...LISTS]).order("symbol"));
  const sigs = await readAll(() => sb.from("dual_trend_signals").select("symbol,vals").eq("as_of", asOf).order("symbol"));
  const vals = new Map<string, Record<string, number>>(sigs.map((r: any) => [String(r.symbol).toUpperCase(), r.vals ?? {}]));
  return workListFromSaved(members.map((m: any) => m.symbol), vals);
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
    await sb.from("dual_trend_return_runs").insert({
      as_of: asOf, status: "running", phase: "members", cursor: 0, symbols: { items: [], spx: [] }, requests,
    });
  } else {
    await sb.from("dual_trend_return_runs").update({ status: "running", error: null, heartbeat_at: new Date().toISOString() }).eq("as_of", asOf);
  }
  // @ts-ignore EdgeRuntime is provided by the runtime
  EdgeRuntime.waitUntil(kick(token));
  return { status: run ? "resumed" : "started", asOf };
}

async function chunk(token: string) {
  const sb = db();
  const { data: run } = await sb.from("dual_trend_return_runs").select("*").eq("status", "running")
    .order("as_of", { ascending: false }).limit(1).maybeSingle();
  if (!run) return { status: "idle" };
  const asOf: string = run.as_of;
  if (run.phase !== "returns") {
    try {
      const beat = { heartbeat_at: new Date().toISOString() };
      if (run.phase === "members") {
        await phaseMembers(sb, asOf);
        await sb.from("dual_trend_return_runs").update({ ...beat, phase: "keys", requests: run.requests + requests }).eq("as_of", asOf);
      } else if (run.phase === "keys") {
        await phaseKeys(sb, asOf);
        await sb.from("dual_trend_return_runs").update({ ...beat, phase: "backfill", signals_ready_at: new Date().toISOString(), requests: run.requests + requests }).eq("as_of", asOf);
      } else {
        await phaseBackfill(sb, asOf);
        // Returns work list comes from the signals saved above.
        const items = await buildList(sb, asOf);
        const earliest = items.reduce((m, i) => (i.starts[0] < m ? i.starts[0] : m), asOf);
        const spx = await prices("SPX", minus(earliest, 10), asOf, { entity_type: "index" });
        await sb.from("dual_trend_return_runs").update({
          ...beat, phase: "returns", cursor: 0, symbols_done: 0, symbols: { items, spx }, symbols_total: items.length, requests: run.requests + requests,
        }).eq("as_of", asOf);
      }
      // @ts-ignore EdgeRuntime is provided by the runtime
      EdgeRuntime.waitUntil(kick(token));
      return { status: "phase_done", phase: run.phase };
    } catch (e) {
      await sb.from("dual_trend_return_runs").update({ status: "failed", error: `${run.phase}: ${e instanceof Error ? e.message : JSON.stringify(e)}` }).eq("as_of", asOf);
      return { status: "failed", error: String(e) };
    }
  }
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
      const cut = minus(asOf, KEEP_DAYS);
      await sb.from("dual_trend_returns").delete().lt("as_of", cut);
      await sb.from("dual_trend_signals").delete().lt("as_of", cut);
      await sb.from("dual_trend_members").delete().lt("as_of", cut);
      await sb.from("dual_trend_signal_days").delete().lt("as_of", cut);
    } else {
      // @ts-ignore EdgeRuntime is provided by the runtime
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
  requests = 0;
  const b = await req.json().catch(() => ({}));
  const out = b?.action === "chunk" ? await chunk(token) : await tick(token);
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
