// Maps weeks-table rows to the reference dashboard's { generated_at, days } shape.
// Only fields the page renders are exposed (no author_id, posted_at_iso, channel_status).

export type Mode = "live" | "staging";

export function parseMode(v: unknown): Mode | null {
  if (v === undefined || v === null || v === "live") return "live";
  if (v === "staging") return "staging";
  return null;
}

export function tableFor(mode: Mode): string {
  return mode === "staging" ? "community_alpha_weeks_staging" : "community_alpha_weeks";
}

type Row = {
  week_date: string;
  window_start: string;
  window_end: string;
  run_at?: string | null;
  channels_scanned: number | null;
  team_excluded_count: number | null;
  tactical_excluded_count: number | null;
  ideas: unknown;
};

const IDEA_FIELDS = [
  "channel_name", "channel_id", "author_name", "tickers", "direction",
  "label", "one_liner", "idea_type", "technical", "permalink",
] as const;

function pickIdea(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of IDEA_FIELDS) if (k in src) out[k] = src[k];
  out.technical = src.technical === true;
  return out;
}

export function toDays(rows: Row[]) {
  const days = rows
    .map((r) => ({
      date: r.week_date,
      window: { oldest_iso: r.window_start, latest_iso: r.window_end },
      channels_scanned: r.channels_scanned ?? 8,
      team_excluded_count: r.team_excluded_count ?? 0,
      tactical_excluded_count: r.tactical_excluded_count ?? 0,
      ideas: (Array.isArray(r.ideas) ? r.ideas : []).map(pickIdea).filter(Boolean),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const runs = rows.map((r) => r.run_at).filter((x): x is string => !!x).sort();
  return { generated_at: runs.length ? runs[runs.length - 1] : null, days };
}
