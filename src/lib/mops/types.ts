// Types for the Macro Ops Signal API. Kept loose since upstream payloads vary
// slightly per endpoint; the client normalizes envelopes into arrays or scalars.

export type MopsEntityType = "symbol" | "sector" | "index" | "industry" | "sub_industry" | string;

export interface MopsSignalRow {
  entity: string;
  entity_type?: MopsEntityType;
  date: string;
  value: number | string | boolean | null;
  key?: string;
}

export interface MopsRankRow {
  entity: string;
  entity_type?: MopsEntityType;
  value: number | string | null;
  rank: number;
  date?: string;
}

export interface MopsChangeRow {
  entity: string;
  entity_type?: MopsEntityType;
  from: unknown;
  to: unknown;
  date?: string;
}

export interface MopsTransitionRow {
  date: string;
  from: unknown;
  to: unknown;
}

export interface MopsPercentileResult {
  entity: string;
  key: string;
  value: number | null;
  percentile: number | null;
  group?: string;
  date?: string;
  count?: number;
}

export interface MopsDistribution {
  key: string;
  date?: string;
  count?: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stdev?: number;
  p05?: number; p10?: number; p25?: number; p75?: number; p90?: number; p95?: number;
  histogram?: Array<{ bin: number | string; count: number }>;
  states?: Array<{ state: string; count: number; pct?: number }>;
}

export interface MopsExtremes {
  key: string;
  entity: string;
  lookback: number;
  min?: number;
  max?: number;
  mean?: number;
  latest?: number;
  min_date?: string;
  max_date?: string;
}

export interface MopsStreak {
  key: string;
  entity: string;
  condition: string;
  streak: number;
  since?: string;
}

export interface MopsGroup {
  parent: string;
  member_count: number;
  entity_type?: string;
}

export interface MopsEntityMeta {
  entity: string;
  entity_type?: string;
  name?: string;
  sector?: string;
  industry?: string;
  sub_industry?: string;
  exchange?: string;
  [k: string]: unknown;
}

export type MopsPath =
  | "/v1/signal-keys"
  | "/v1/signal"
  | "/v1/signals"
  | "/v1/signal/where"
  | "/v1/scan"
  | "/v1/rank"
  | "/v1/changes"
  | "/v1/transitions"
  | "/v1/streak"
  | "/v1/extremes"
  | "/v1/percentile"
  | "/v1/aggregate"
  | "/v1/distribution"
  | "/v1/members"
  | "/v1/groups"
  | "/v1/entities"
  | "/v1/enrich"
  | "/v1/pipe"
  | "/v1/endpoints"
  | "/health";
