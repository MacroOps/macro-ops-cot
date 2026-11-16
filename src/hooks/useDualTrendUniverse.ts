// Shared Dual Trend loader: one row shape for every section; only the universe
// differs (index members or custom lists). See src/lib/dualTrend/config.ts.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SPX_UNIVERSE } from "@/lib/spxUniverse";
import { MIDSML_UNIVERSE } from "@/lib/midSmlUniverse";
import { sectorGroups, type DualTrendUniverseSpec, type IndexCode } from "@/lib/dualTrend/config";
import {
  buildListRows, buildMemberRows, DT_KEYS, type CustomListPayload, type DualTrendRow,
} from "@/lib/dualTrend/build";
import { latestFullDay, readMembers, readSignalDays, readSignals } from "@/lib/dualTrend/saved";
import { getCachedReturn, loadReturns, returnsAsOf, type Ret } from "@/lib/dualTrend/returns";

export interface DualTrendData { asOf: string; rows: DualTrendRow[] }

/** Newest fully saved day; falls back to the last saved day until today's run finishes. */
export async function savedAsOf(): Promise<string> {
  return latestFullDay(await readSignalDays());
}

async function sectorMap(asOf: string, index: IndexCode): Promise<Map<string, string>> {
  const groups = sectorGroups(index);
  const name = new Map(groups.map((g) => [g.group, g.name]));
  const rows = await readMembers(asOf, groups.map((g) => g.group));
  return new Map(rows.map((r) => [r.symbol.toUpperCase(), name.get(r.universe) ?? ""]));
}

async function fetchMembers(index: IndexCode): Promise<DualTrendData> {
  const asOf = await savedAsOf();
  if (!asOf) return { asOf, rows: [] };
  const [members, sectors, maps] = await Promise.all([readMembers(asOf, [index]), sectorMap(asOf, index), readSignals(asOf)]);
  return { asOf, rows: buildMemberRows(members.map((m) => m.symbol.toUpperCase()), maps, sectors, index === "SPX" ? SPX_UNIVERSE : MIDSML_UNIVERSE) };
}

async function fetchLists(lists: { id: string; category: string }[]): Promise<DualTrendData> {
  const asOf = await savedAsOf();
  if (!asOf) return { asOf, rows: [] };
  const [members, maps] = await Promise.all([readMembers(asOf, lists.map((l) => l.id)), readSignals(asOf)]);
  const rows = lists.flatMap((l) => {
    const mine = members.filter((m) => m.universe === l.id);
    const payload: CustomListPayload = {
      memberships: mine.map((m) => ({
        entity_a: m.symbol,
        canonical_name: m.name ?? "",
        metadata: { categories: m.sub_group ? m.sub_group.split(", ") : [] },
      })),
      instruments: Object.fromEntries(mine.map((m) => {
        const values: Record<string, number | null> = {};
        for (const k of DT_KEYS) values[k] = maps[k].get(m.symbol.toUpperCase()) ?? null;
        return [m.symbol, { values }];
      })),
    };
    return buildListRows(payload, l.category);
  });
  return { asOf, rows };
}

export function useDualTrendUniverse(spec: DualTrendUniverseSpec) {
  const id = spec.kind === "members" ? spec.index : spec.lists.map((l) => l.id).join(",");
  return useQuery({
    queryKey: ["saved", "dual-trend", spec.kind, id],
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
