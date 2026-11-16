// Shared Dual Trend loader: one row shape for every section; only the universe
// differs (index members or custom lists). See src/lib/dualTrend/config.ts.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mopsGet } from "@/lib/mops/client";
import type { MopsSignalRow } from "@/lib/mops/types";
import { signalSnapshot, toValueMap } from "@/lib/mops/paginate";
import { SPX_UNIVERSE } from "@/lib/spxUniverse";
import { sectorGroups, type DualTrendUniverseSpec, type IndexCode } from "@/lib/dualTrend/config";
import {
  buildListRows, buildMemberRows, DT_KEYS, type CustomListPayload, type DtKey, type DualTrendRow,
} from "@/lib/dualTrend/build";
import { getCachedReturn, loadReturns, returnsAsOf, type Ret } from "@/lib/dualTrend/returns";

export interface DualTrendData { asOf: string; rows: DualTrendRow[] }

/** Latest stored trading date (AAPL is in every daily run). */
export async function latestSignalDate(): Promise<string> {
  const r = await mopsGet<MopsSignalRow[]>("/v1/signal", { key: "trend_rel_lt_state", entity: "AAPL", limit: 1 });
  return r[0]?.date ?? "";
}

export async function sectorMap(index: IndexCode): Promise<Map<string, string>> {
  const groups = sectorGroups(index);
  const lists = await Promise.all(groups.map((g) => mopsGet<string[]>("/v1/members", { parent: g.group })));
  const m = new Map<string, string>();
  groups.forEach((g, i) => (lists[i] ?? []).forEach((s) => m.set(s, g.name)));
  return m;
}

async function fetchMembers(index: IndexCode): Promise<DualTrendData> {
  const asOf = await latestSignalDate();
  const [members, sectors, ...snaps] = await Promise.all([
    mopsGet<string[]>("/v1/members", { parent: index }),
    sectorMap(index),
    ...DT_KEYS.map((k) => signalSnapshot(k, asOf)),
  ]);
  const maps = Object.fromEntries(DT_KEYS.map((k, i) => [k, toValueMap(snaps[i] as MopsSignalRow[])])) as Record<DtKey, Map<string, number>>;
  return { asOf, rows: buildMemberRows(members ?? [], maps, sectors, SPX_UNIVERSE) };
}

async function fetchLists(lists: { id: string; category: string }[]): Promise<DualTrendData> {
  const asOf = await latestSignalDate();
  const payloads = await Promise.all(
    lists.map((l) => mopsGet<CustomListPayload>("/v1/custom-list-signals", { list_id: l.id, date: asOf })),
  );
  const rows = payloads.flatMap((p, i) => buildListRows(p ?? {}, lists[i].category));
  return { asOf, rows };
}

export function useDualTrendUniverse(spec: DualTrendUniverseSpec) {
  const id = spec.kind === "members" ? spec.index : spec.lists.map((l) => l.id).join(",");
  return useQuery({
    queryKey: ["mops", "dual-trend", spec.kind, id],
    queryFn: () => (spec.kind === "members" ? fetchMembers(spec.index) : fetchLists(spec.lists)),
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Returns for every row (LT + ST), loaded in batches and cached. */
export function useDualTrendReturns(data: DualTrendData | undefined) {
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!data?.asOf || !data.rows.length) return;
    let cancelled = false;
    const reqs = data.rows.flatMap((r) => [
      { symbol: r.symbol, start: r.lt.start },
      { symbol: r.symbol, start: r.st.start },
    ]);
    setLoading(true);
    loadReturns(reqs, data.asOf, () => !cancelled && setTick((t) => t + 1)).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [data]);

  return useMemo(() => {
    const get = (symbol: string, start: string): Ret | undefined =>
      data?.asOf && start ? getCachedReturn(symbol, start, data.asOf) : undefined;
    const reqs = data?.rows.flatMap((r) => [{ symbol: r.symbol, start: r.lt.start }, { symbol: r.symbol, start: r.st.start }]) ?? [];
    const asOf = data?.asOf ? returnsAsOf(reqs, data.asOf) : "";
    return { get, loading, tick, asOf };
  }, [data, loading, tick]);
}
