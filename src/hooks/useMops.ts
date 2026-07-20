// React Query hooks over the Macro Ops Signal API.
// All requests go through the `macro-ops-proxy` edge function.
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { mopsGet, mopsPipe, type MopsParams } from "@/lib/mops/client";
import type {
  MopsSignalRow, MopsRankRow, MopsChangeRow, MopsTransitionRow,
  MopsPercentileResult, MopsDistribution, MopsExtremes, MopsStreak,
  MopsGroup, MopsEntityMeta,
} from "@/lib/mops/types";

type Opts<T> = Omit<UseQueryOptions<T, Error, T, unknown[]>, "queryKey" | "queryFn">;

const defaults = { staleTime: 5 * 60_000, gcTime: 30 * 60_000, refetchOnWindowFocus: false };

// --- signal keys / catalog ------------------------------------------------
export const useSignalKeys = () =>
  useQuery({ queryKey: ["mops", "signal-keys"], queryFn: () => mopsGet<string[]>("/v1/signal-keys"), ...defaults, staleTime: 60 * 60_000 });

export const useMopsGroups = () =>
  useQuery({ queryKey: ["mops", "groups"], queryFn: () => mopsGet<MopsGroup[]>("/v1/groups"), ...defaults, staleTime: 60 * 60_000 });

export const useMopsEndpoints = () =>
  useQuery({ queryKey: ["mops", "endpoints"], queryFn: () => mopsGet<unknown>("/v1/endpoints"), ...defaults, staleTime: 60 * 60_000 });

// --- entities / members / enrich -----------------------------------------
export const useMopsEntities = (params: { entity_type?: string; parent?: string } = {}, opts: Opts<string[]> = {}) =>
  useQuery({
    queryKey: ["mops", "entities", params],
    queryFn: () => mopsGet<string[]>("/v1/entities", params as unknown as MopsParams),
    ...defaults,
    ...opts,
  });

export const useMopsMembers = (parent: string | undefined, date?: string) =>
  useQuery({
    queryKey: ["mops", "members", parent, date],
    queryFn: () => mopsGet<string[]>("/v1/members", { parent: parent!, date }),
    enabled: !!parent,
    ...defaults,
  });

export const useMopsEnrich = (entities: string[], include?: string[]) =>
  useQuery({
    queryKey: ["mops", "enrich", entities, include],
    queryFn: () => mopsGet<MopsEntityMeta[]>("/v1/enrich", { entities, include } as MopsParams),
    enabled: entities.length > 0,
    ...defaults,
  });

// --- signals --------------------------------------------------------------
export interface UseSignalParams {
  key: string;
  entity?: string;
  entities?: string[];
  date?: string;
  from_date?: string;
  to_date?: string;
  entity_type?: string;
  limit?: number;
  offset?: number;
}
export const useMopsSignal = (params: UseSignalParams, opts: Opts<MopsSignalRow[]> = {}) =>
  useQuery({
    queryKey: ["mops", "signal", params],
    queryFn: () => mopsGet<MopsSignalRow[]>("/v1/signal", params as unknown as MopsParams),
    enabled: !!params.key,
    ...defaults,
    ...opts,
  });

export const useMopsSignals = (params: { keys: string[]; entity: string; date?: string }) =>
  useQuery({
    queryKey: ["mops", "signals", params],
    queryFn: () => mopsGet<Record<string, unknown>>("/v1/signals", params as unknown as MopsParams),
    enabled: !!params.entity && params.keys.length > 0,
    ...defaults,
  });

// --- scan / rank / where -------------------------------------------------
export interface UseScanParams {
  conditions: string[]; // e.g. ["pct_above_sma_50>60", "risk_lt_state=Risk-Off"]
  entity_type?: string;
  logic?: "and" | "or";
  date?: string;
  limit?: number;
}
export const useMopsScan = (params: UseScanParams, opts: Opts<MopsSignalRow[]> = {}) =>
  useQuery({
    queryKey: ["mops", "scan", params],
    queryFn: () => mopsGet<MopsSignalRow[]>("/v1/scan", params as unknown as MopsParams),
    enabled: params.conditions.length > 0,
    ...defaults,
    ...opts,
  });

export interface UseRankParams {
  key: string;
  entities?: string[];
  entity_type?: string;
  date?: string;
  order?: "asc" | "desc";
  limit?: number;
}
export const useMopsRank = (params: UseRankParams, opts: Opts<MopsRankRow[]> = {}) =>
  useQuery({
    queryKey: ["mops", "rank", params],
    queryFn: () => mopsGet<MopsRankRow[]>("/v1/rank", params as unknown as MopsParams),
    enabled: !!params.key,
    ...defaults,
    ...opts,
  });

export const useMopsWhere = (params: { key: string; predicate: string; date?: string; entity_type?: string; limit?: number }) =>
  useQuery({
    queryKey: ["mops", "where", params],
    queryFn: () => mopsGet<MopsSignalRow[]>("/v1/signal/where", params as unknown as MopsParams),
    enabled: !!params.key && !!params.predicate,
    ...defaults,
  });

// --- changes / transitions / streak / extremes ---------------------------
export const useMopsChanges = (params: { key: string; date?: string; entity_type?: string; direction?: string; limit?: number }) =>
  useQuery({
    queryKey: ["mops", "changes", params],
    queryFn: () => mopsGet<MopsChangeRow[]>("/v1/changes", params as unknown as MopsParams),
    enabled: !!params.key,
    ...defaults,
  });

export const useMopsTransitions = (params: { key: string; entity: string; from_date: string; to_date?: string }) =>
  useQuery({
    queryKey: ["mops", "transitions", params],
    queryFn: () => mopsGet<MopsTransitionRow[]>("/v1/transitions", params as unknown as MopsParams),
    enabled: !!params.key && !!params.entity && !!params.from_date,
    ...defaults,
  });

export const useMopsStreak = (params: { key: string; entity: string; condition: string; date?: string }) =>
  useQuery({
    queryKey: ["mops", "streak", params],
    queryFn: () => mopsGet<MopsStreak>("/v1/streak", params as unknown as MopsParams),
    enabled: !!params.key && !!params.entity && !!params.condition,
    ...defaults,
  });

export const useMopsExtremes = (params: { key: string; entity: string; lookback?: number; date?: string }) =>
  useQuery({
    queryKey: ["mops", "extremes", params],
    queryFn: () => mopsGet<MopsExtremes>("/v1/extremes", params as unknown as MopsParams),
    enabled: !!params.key && !!params.entity,
    ...defaults,
  });

// --- percentile / aggregate / distribution -------------------------------
export const useMopsPercentile = (params: { key: string; entity: string; group?: string; date?: string }) =>
  useQuery({
    queryKey: ["mops", "percentile", params],
    queryFn: () => mopsGet<MopsPercentileResult>("/v1/percentile", params as unknown as MopsParams),
    enabled: !!params.key && !!params.entity,
    ...defaults,
  });

export const useMopsAggregate = (params: { key: string; group: string; func?: "mean" | "median" | "sum" | "count" | "min" | "max"; date?: string }) =>
  useQuery({
    queryKey: ["mops", "aggregate", params],
    queryFn: () => mopsGet<unknown>("/v1/aggregate", params as unknown as MopsParams),
    enabled: !!params.key && !!params.group,
    ...defaults,
  });

export const useMopsDistribution = (params: { key: string; entity_type?: string; group?: string; date?: string }) =>
  useQuery({
    queryKey: ["mops", "distribution", params],
    queryFn: () => mopsGet<MopsDistribution>("/v1/distribution", params as unknown as MopsParams),
    enabled: !!params.key,
    ...defaults,
  });

// --- pipeline -------------------------------------------------------------
export const useMopsPipe = <T = unknown>(steps: Array<Record<string, unknown>>, date?: string, opts: Opts<T> = {}) =>
  useQuery({
    queryKey: ["mops", "pipe", steps, date],
    queryFn: () => mopsPipe<T>(steps, date),
    enabled: steps.length > 0,
    ...defaults,
    ...opts,
  });
