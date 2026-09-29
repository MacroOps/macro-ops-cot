// Community Alpha fixed configuration.
export const SLACK_WORKSPACE_HOST = "comm-center.slack.com";

export interface CaChannel {
  id: string;
  name: string;
  /** #general: only explicit ticker + direction calls. */
  strict: boolean;
}

export const CA_CHANNELS: CaChannel[] = [
  { id: "C6Q4C2WR1", name: "#ideas-equities", strict: false },
  { id: "C71BKN7PW", name: "#ideas-commodities", strict: false },
  { id: "C70L60T6C", name: "#ideas-fx", strict: false },
  { id: "C71DZ6805", name: "#ideas-rates", strict: false },
  { id: "C07U19HEQUS", name: "#big-bet", strict: false },
  { id: "C018EPUKTH6", name: "#emerging-markets", strict: false },
  { id: "C6Q22AT9R", name: "#general", strict: true },
  { id: "C0ABECRNTA8", name: "#hedging", strict: false },
];

/** Macro Ops team — messages removed before AI, counted as team_excluded. */
export const CA_TEAM_IDS: ReadonlySet<string> = new Set([
  "U6PEHV6RW",
  "U03CSJ4QPFS",
  "U6R43TGFQ",
  "U0AR0DT1BSP",
  "U01CP2H2JDQ",
  "UUSBEJG9K",
]);

export const CA_IDEA_TYPES = ["ticker+direction", "thesis"] as const;
export const CA_DIRECTIONS = ["long", "short", "bullish", "bearish", "buy"] as const;
export const CA_MAX_IDEAS_PER_WEEK = 50;
export const CA_ONE_LINER_MAX_WORDS = 25;

export function channelById(id: string): CaChannel | undefined {
  return CA_CHANNELS.find((c) => c.id === id);
}

/**
 * Parse the private exclusion list secret (comma/space/newline separated IDs).
 * Never log or return the result.
 */
export function parsePrivateList(raw: string | undefined | null): ReadonlySet<string> {
  return new Set((raw ?? "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean));
}

/** Credit estimate for anthropic/claude-sonnet-5, calibrated on earlier runs' measured cost. */
export const CA_CREDITS_PER_INPUT_TOKEN = 7.9e-6;
export const CA_CREDITS_PER_OUTPUT_TOKEN = 4.1e-5;
export const CA_CREDIT_CAP_PER_RUN = 3;
export const caCredits = (inTok: number, outTok: number) => inTok * CA_CREDITS_PER_INPUT_TOKEN + outTok * CA_CREDITS_PER_OUTPUT_TOKEN;
