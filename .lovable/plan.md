# Populate "TCTM 5-Component Status" from TCTM - Live

## Goal
The 5 cards on TurningPoint Market Overview (1B) show the same live numbers as the TCTM - Live "Model summary" table, instead of the placeholder values. The "mock" badge is removed.

## What each card shows (taken from TCTM - Live)
- Name: Risk-Off, Capitulation, Bottom, Thrust, Confirmation (same names as TCTM - Live).
- Status: Triggered when the composite fired within the hold window used by TCTM - Live; otherwise Neutral. Triggered follows the existing color rule (Risk-Off red, others green).
- Signal date: date of the last signal, plus "(N sessions)" like TCTM - Live; dash if none.
- Count: "count of N" components on the latest session (e.g. 3/12).
- Small "As of <date> close" line under the panel title.

## Behavior
- Loads the same Google Sheet TCTM - Live reads, once per visit, cached so opening TCTM - Live afterwards does not download again.
- While loading: Skeleton blocks in the 5 cards. If the sheet can't be read: a short message in the panel; rest of the page unaffected.
- TCTM - Live itself is unchanged (Dean's numbers and copy untouched).

## Technical details
- New `src/lib/tctm/loadDataset.js`: move `loadFromSheet` / `parseCSV` / `tryCsv` / `discoverGid` out of `dashboard.js` (verbatim), add a module-level promise cache returning `E.buildDataset(values)`. `dashboard.js` imports it instead of its local copy.
- New `src/lib/tctm/componentStatus.ts`: for each `DS.models` item, use `E.compositeSource` + `E.sourceStatus` and `m.count[T]` / `m.comps.length` to build `{ name, signal, signalDate, sessionsSince, count, total }`; map state `bull`/`bear` to "Triggered", `neutral` to "Neutral".
- New hook `useTctmComponentStatus` (react-query) used by `MarketOverview.tsx`; remove `TCTM_STATUS` mock usage and its MockBadge.
- Test: componentStatus on a small synthetic dataset (Triggered inside hold window, Neutral outside, count/total).
- Run `npm run design:check` and the tctm tests; check the panel in the preview against TCTM - Live.
