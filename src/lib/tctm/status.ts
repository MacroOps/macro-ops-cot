import { TCTM as E } from "./engine.js";

export type TctmStatusState = "bull" | "bear" | "neutral";

export interface TctmStatusRow {
  id: string;
  name: string;
  /** -1 for Risk-Off (bearish composite), +1 for the rest. */
  dir: number;
  state: TctmStatusState;
  /** ISO date of the latest composite signal, or null if it never fired. */
  signalDate: string | null;
  /** Components active on the last session. */
  count: number;
  total: number;
}

export interface TctmStatus {
  /** ISO date of the last session in the sheet. */
  asOf: string;
  rows: TctmStatusRow[];
}

/**
 * One row per TCTM composite as of the last session, read the same way the TCTM Live
 * "Model summary" table reads it: the composite is Triggered while its latest signal is
 * inside the 42-session window, and the count is the components active on that day.
 */
export function summarizeTctm(ds: ReturnType<typeof E.buildDataset>): TctmStatus {
  const T = ds.n - 1;
  const rows = ds.models.map((m): TctmStatusRow => {
    const st = E.sourceStatus(ds, E.compositeSource(ds, m));
    return {
      id: m.id,
      name: m.name,
      dir: m.dir,
      state: st.state as TctmStatusState,
      signalDate: st.lastIdx !== null ? ds.dates[st.lastIdx] : null,
      count: m.count[T],
      total: m.comps.length,
    };
  });
  return { asOf: ds.dates[T], rows };
}

/** "2026-04-22" -> "04/22/26". */
export function formatShortDate(iso: string | null | undefined): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[2]}/${m[3]}/${m[1].slice(2)}` : "—";
}
