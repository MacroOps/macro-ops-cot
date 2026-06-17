import { useMemo } from "react";
import { useTpBreadth } from "@/hooks/tp/useTp";
import { useBreadthSector } from "@/components/hud/BreadthSectorContext";
import type { TpBreadthRow } from "@/lib/tp/types";

export interface BreadthPoint {
  t: string;        // YYYY-MM-DD
  v: number;        // metric value
  spx: number;      // sector close price (overlay)
}

export type BreadthField = Exclude<keyof TpBreadthRow, "date" | "sector">;

const ONE_YEAR_DAYS = 365;
const TWO_YEARS_DAYS = 730;

export function useBreadthRows(rangeDays = TWO_YEARS_DAYS) {
  const { sector } = useBreadthSector();
  const today = new Date();
  const start = new Date(today.getTime() - rangeDays * 86_400_000).toISOString().slice(0, 10);
  const end = today.toISOString().slice(0, 10);
  const q = useTpBreadth({ sector, start_date: start, end_date: end, limit: 2000 });
  const sorted = useMemo(
    () => [...(q.data ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [q.data],
  );
  return { ...q, rows: sorted, sector };
}

/** Pull a single metric series, paired with the underlying close price for overlay. */
export function useBreadthSeries(
  field: BreadthField,
  opts?: { rangeDays?: number; transform?: (row: TpBreadthRow) => number | null },
) {
  const { rows, isLoading, error, sector } = useBreadthRows(opts?.rangeDays ?? ONE_YEAR_DAYS);
  const data: BreadthPoint[] = useMemo(() => {
    const out: BreadthPoint[] = [];
    for (const r of rows) {
      const raw = opts?.transform ? opts.transform(r) : (r[field] as number | null);
      if (raw == null) continue;
      const spx = r.close_price;
      if (spx == null) continue;
      out.push({ t: r.date, v: Number(raw), spx: Number(spx) });
    }
    return out;
  }, [rows, field, opts]);
  return { data, isLoading, error, sector };
}
