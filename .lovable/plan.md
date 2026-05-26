## Backtests Lab: remove direction flip + add market baseline

### 1. Replace Long/Short with a threshold condition

**`src/hooks/useBacktest.ts`**
- `BtParams.direction: "long"|"short"` → `condition: "gte"|"lte"`
- In `runBacktest`, remove all sign-flipping. `returnPct`, `rawReturnPct`, and every `path[k]` value are raw forward returns of the underlying (positive = market up).
- Trigger logic: `condition === "gte" ? v >= threshold : v <= threshold`.

**`src/pages/Backtests.tsx`**
- Rename the toggle to "Threshold" with options `≥` / `≤`.
- Drop the sign-flip side-effect in `flipDirection`; keep only the threshold preset (≥ → ~85th pct of range, ≤ → ~15th).
- Narration: *"When {indicator} {≥|≤} {threshold}, here's what {symbol} did over the next {N} weeks."*
- Histogram coloring already keys off `lo >= 0`, so it now correctly shows up-weeks vs down-weeks.

### 2. Add a "blind market" baseline for significance

The point: tell the user whether the filtered cohort is meaningfully different from what the market does on any random N-week window.

**Computation** (in `runBacktest`, returned as `baseline` on `BtResult`):
- Walk every index `i` from 0 to `series.length - horizon - 1` (every week, no filter, overlapping is fine for a baseline distribution — more samples = stabler reference).
- Compute raw forward return `(series[i+H].price - series[i].price) / series[i].price * 100`.
- Aggregate: `count`, `meanReturn`, `medianReturn`, `pctPositive`, `stdDev`.

**Display** — two changes to the stats panel:

a. **Each KPI shows the baseline underneath in small mono text**, e.g.:
   ```
   % POSITIVE
   62%
   baseline 54%
   ```
   Applied to: % Positive, Mean Return, Median Return. (Best/Worst/Samples/Horizon/Indicator don't get a baseline.)

b. **New "Edge vs Baseline" KPI** (replaces one of the less-useful cells, e.g. the "Indicator" tile):
   - Value: `meanReturn - baseline.meanReturn` shown as `+X.XX% vs market`
   - Tone: green if positive, red if negative
   - This is the headline "is this signal doing anything?" number.

c. **Add a faint baseline reference band on the spaghetti chart**: a horizontal dotted line at `baseline.meanReturn × (week / horizon)` — i.e. the expected drift if you'd just held blindly. Lets the user eyeball whether the median path is meaningfully above/below "do nothing."

**Optional lightweight significance flag** (no scipy): compute a rough z-score
`z = (meanReturn - baseline.mean) / (baseline.stdDev / sqrt(count))`
and show a small `·sig` chip when `|z| > 2`. Keeps it honest without overstating; the cohort sizes are small so we won't claim p-values.

### Files touched
- `src/hooks/useBacktest.ts` — type changes, remove sign flip, add baseline calc
- `src/pages/Backtests.tsx` — toggle rename, KPI baselines, edge tile, baseline reference on chart, narration copy

No DB or edge function changes.
