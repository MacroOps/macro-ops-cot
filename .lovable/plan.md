# Extremity Score — Implementation Plan

Build a composite "Extremity Score" that flags markets at bullish or bearish extremes, and surface it across the Global Positioning dashboard.

## The score

Single signed score in **[-100, +100]**. Positive = crowded long / euphoric, negative = crowded short / capitulation.

For percentiles, convert `p` (0–100) to a signed deviation: `s(p) = (p - 50) * 2`.

For WoW change, compute a z-score of the latest weekly Δ in net spec contracts versus the trailing 26 weeks of weekly Δs; clamp to ±100 (a 1σ move ≈ 33, 2σ ≈ 66, 3σ ≈ 100). Signed by the direction of the change.

```
Extremity = 0.40 * s(netSpecPct6m)
          + 0.25 * s(netSpecPct3y)
          + 0.20 * z(WoW Δ net spec)
```

Re-normalize the three weights to sum to 1.0 (= 0.471 / 0.294 / 0.235) so the score still maps cleanly to [-100, +100].

## Classification bands

| |score| | Label | Visual |
|---|---|---|
| ≥ 75 | Euphoric / Capitulation | bright pos-long / pos-short, subtle pulse |
| 50–74 | Crowded | solid pos-long / pos-short |
| 25–49 | Leaning | muted token |
| < 25 | Neutral | chart-axis gray |

## UI changes

**1. Header stat tile** on `src/pages/Index.tsx`
- New tile "Extremes" showing count of markets with `|score| ≥ 75`, split as e.g. "3↑ / 1↓" (long / short) in pos-long / pos-short colors.
- Replace the existing "Crowded Long ≥85" and "Crowded Short ≤15" tiles with this single combined tile to avoid redundancy.

**2. Badge on each `MarketCard`** in `src/components/hud/MarketCard.tsx`
- Small top-right badge: signed numeric score + a compact horizontal "fever bar" (mirrors `PercentileGauge` visual language) running -100 → 0 → +100 with a current-position marker.
- Color by band. Top band gets a subtle pulse animation (CSS keyframe, low intensity).

**3. New "Extremes" filter chip** in the sector toolbar on `src/pages/Index.tsx`
- Added next to "All" + sector chips.
- When selected: filters to markets with `|score| ≥ 50` and sorts descending by `|score|`, ignoring sector filter.

## Technical changes

**`src/hooks/useDashboardData.ts`**
- Add per-market computation:
  - `weeklyDeltas`: differences between consecutive `netSpec` values in the existing `specSeries`.
  - `wowZ`: latest delta divided by stddev of the trailing 26 deltas, signed, clamped to ±100 (* 33.3 scaling so 3σ ≈ 100). Guard against zero stddev.
  - `extremityScore`: weighted sum per the formula above, rounded to integer.
  - `extremityBand`: `"euphoric" | "capitulation" | "crowded-long" | "crowded-short" | "leaning-long" | "leaning-short" | "neutral"`.
- Extend `MarketSnapshot` in `src/lib/mockData.ts` with `extremityScore: number` and `extremityBand: string`.

**`src/pages/Index.tsx`**
- Replace the two crowded tiles with one Extremes tile.
- Add "Extremes" chip to the sector strip; route filtering + sorting through a new mode flag rather than the existing `sector` state (keep both independent — selecting Extremes overrides sector).

**`src/components/hud/MarketCard.tsx`**
- Add the badge component (small, top-right). New file `src/components/hud/ExtremityBadge.tsx` keeps it isolated and reusable.

**`src/index.css`**
- Add a `@keyframes extremity-pulse` and `.animate-extremity-pulse` utility (subtle opacity/box-shadow pulse using existing pos-long / pos-short HSL tokens).

## Out of scope

- OI is not included in the score per your decision.
- Score breakdown on `AssetDetail` page — can follow in a later pass if you want the per-component transparency there.
- User-adjustable weights — locked to the proposed values.
