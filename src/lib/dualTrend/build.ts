// Pure row builders for the shared Dual Trend table. Values are used exactly as
// the API returns them: value1/value2 are already 0-100, days and start come
// from trend_rel_*_days / trend_rel_*_start (start = Unix epoch days).

export type DtSignal = "Bullish" | "Bearish" | "Neutral";

export interface DtHorizon {
  trend: number | null;
  relative: number | null;
  signal: DtSignal;
  days: number | null;
  start: string; // ISO date, "" when unknown
}

export interface DualTrendRow {
  symbol: string;
  name: string;
  group: string;     // sector (indexes) or category (custom lists)
  subGroup: string;  // sub-industry (indexes) or list category (custom lists)
  lt: DtHorizon;
  st: DtHorizon;
}

export const DT_KEYS = [
  "trend_rel_lt_value1", "trend_rel_lt_value2", "trend_rel_lt_state", "trend_rel_lt_days", "trend_rel_lt_start",
  "trend_rel_st_value1", "trend_rel_st_value2", "trend_rel_st_state", "trend_rel_st_days", "trend_rel_st_start",
] as const;
export type DtKey = (typeof DT_KEYS)[number];
export type DtValues = Partial<Record<DtKey, number | null>>;

const num = (v: unknown): number | null =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v);

export function epochDaysToIso(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return new Date(v * 86_400_000).toISOString().slice(0, 10);
}

export const signalOf = (state: number | null | undefined): DtSignal =>
  state === null || state === undefined || state === 0 ? "Neutral" : state > 0 ? "Bullish" : "Bearish";

export function horizon(v: DtValues, h: "lt" | "st"): DtHorizon {
  return {
    trend: num(v[`trend_rel_${h}_value1`]),
    relative: num(v[`trend_rel_${h}_value2`]),
    signal: signalOf(num(v[`trend_rel_${h}_state`])),
    days: num(v[`trend_rel_${h}_days`]),
    start: epochDaysToIso(num(v[`trend_rel_${h}_start`])),
  };
}

/**
 * Index universes: membership comes only from `members` (the API). `meta` (e.g.
 * SPX_UNIVERSE) only fills names and sub-industries and never adds or drops rows.
 */
export function buildMemberRows(
  members: string[],
  maps: Record<DtKey, Map<string, number>>,
  sectorOf: Map<string, string>,
  meta: Record<string, [name: string, sector: string, subIndustry: string]>,
): DualTrendRow[] {
  return [...new Set(members)]
    .map((symbol) => {
      const v: DtValues = {};
      for (const k of DT_KEYS) v[k] = maps[k]?.get(symbol) ?? null;
      const m = meta[symbol];
      return {
        symbol,
        name: m?.[0] ?? "",
        group: sectorOf.get(symbol) ?? "",
        subGroup: m?.[2] ?? "",
        lt: horizon(v, "lt"),
        st: horizon(v, "st"),
      };
    })
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export interface CustomListPayload {
  day?: string;
  instruments?: Record<string, { values?: DtValues }>;
  memberships?: {
    entity_a: string;
    canonical_name?: string;
    metadata?: { categories?: string[]; display_names?: string[] };
  }[];
}

/** Custom lists: every member of the list is a row; category tags the list. */
export function buildListRows(payload: CustomListPayload, category: string): DualTrendRow[] {
  const inst = payload.instruments ?? {};
  const members = payload.memberships?.length
    ? payload.memberships
    : Object.keys(inst).map((s) => ({ entity_a: s }) as NonNullable<CustomListPayload["memberships"]>[number]);
  return members.map((m) => {
    const v = inst[m.entity_a]?.values ?? {};
    return {
      symbol: m.entity_a,
      name: m.metadata?.display_names?.[0] ?? m.canonical_name ?? "",
      group: category,
      subGroup: m.metadata?.categories?.join(", ") ?? "",
      lt: horizon(v, "lt"),
      st: horizon(v, "st"),
    };
  });
}
