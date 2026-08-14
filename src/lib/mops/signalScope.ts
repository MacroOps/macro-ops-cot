// Signal scope helpers.
//
// Breadth signals (pct_* and *_count) are computed by the upstream API only over
// a GROUP of symbols — the result is stored under the sector/index code as the
// entity (e.g. entity=S5INFT). There is no per-symbol version by design: a
// percentage across one symbol is meaningless. Querying them with
// entity_type=symbol returns an empty set, which looks like a data gap but isn't.
//
// The per-symbol equivalents are the boolean signals below.

export const isBreadthKey = (key: string) =>
  key.startsWith("pct_") || key.endsWith("_count");

const SYMBOL_EQUIVALENT: Record<string, string> = {
  pct_above_sma_50: "above_sma_50",
  pct_above_sma_150: "above_sma_150",
  pct_above_sma_200: "above_sma_200",
  pct_outperforming_63d: "outperforming_spx_63d",
  pct_ma_50_above_150: "ma_50_above_150",
};

/** Boolean symbol-level signal that corresponds to a group breadth key, if any. */
export const symbolEquivalent = (key: string): string | undefined => SYMBOL_EQUIVALENT[key];

/** Warning copy when a breadth key is paired with entity_type=symbol. */
export const breadthScopeWarning = (key: string): string | null => {
  if (!isBreadthKey(key)) return null;
  const alt = symbolEquivalent(key);
  return `${key} is a group breadth metric — it only exists for sector / index entities.${
    alt ? ` For symbol-level data use ${alt} (boolean).` : ""
  }`;
};
