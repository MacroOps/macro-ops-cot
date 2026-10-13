# Community Alpha: direction-check failures, same-author merge, ChrisM diagnosis

## What I found

### 1. Why the direction check gave no answer (#ideas-commodities, Oct 2)
The AI call worked (no error), but the answer came back in the wrong shape. Instead of a list of checks, the AI sent the whole list as one block of text, and that text was broken: it held only one check (lumber), with its fields mixed up. Our code didn't notice the bad shape and read it as "no answers", so all 5 ideas were kept as "unclear". Confirmed from the saved AI request (gateway log 01a13346-fdec-72fc-81e1-f9d91f4c90f4, 03:20:54 UTC).

### 2. Corn twice
The extraction returned two corn ideas from ChrisM (short Sep 30, long Oct 2). The new "latest view" rule wasn't enough on its own, so a code check is needed.

### 3. ChrisM's #ideas-equities ideas (Oct 2)
- His messages reached the AI. The saved request (log 01a13346-c7ee-7cee-978f-30d7c12db069, 03:20:43 UTC) includes his SDEV post and its thread. The run's size (7,818 input tokens) matches a later run that returned his Japan and tax-loss ideas, so those posts were in it too.
- None were filtered out: no validator rejections for that task, and 0 ideas dropped as tactical.
- The AI left them out. It returned only 3 ideas (HHH, E&C, Phil's META list). The AI gives no reason when it leaves posts out, so this is run-to-run variation, not a rule removing them. Two results show this: the earlier runs found all four of his ideas, and a later run returned Japan and the tax-loss basket but not THNQ or SDEV.
- Note: a separate manual Oct 2 run started at 03:48 UTC (run 1201cdfa). It was outside the test I reported, and I didn't start it. It is in staging task rows only. Its results are the ones mentioned above.

## Changes

1. **Direction check must give a valid answer for every idea.**
   - Read the answer even when the AI sends it as text, but only accept it if every idea has exactly one check with a view of positive, negative or unclear.
   - Anything else (call error, empty, broken, missing ideas) counts as a failure. Retry the check once.
   - If it fails again, mark the task failed with reason "direction_check_failed" and keep none of that task's ideas. The usual 3-attempt retry doesn't apply to this failure. Credits for both calls are still counted.
   - Slack message: add a warning line naming the channel and week, the same way the credit-cap warning works. The failed channel keeps its previous ideas for that week, as the weekly merge already does for failed channels.
2. **Same-author merge in code.** After the AI's ideas are checked and before the direction check: if one author has more than one idea on the same first instrument in a channel and week, keep only the idea from the latest message. Instruments are compared ignoring case and spaces. Different names for the same thing ("Lumber" vs "LBR") are not merged. The dropped ideas are logged internally.
3. Tests: broken or text-shaped check answers, a missing idea, retry then failure, the merge (corn short then long keeps the long; different authors are both kept; different instruments are both kept). Re-run the existing Community Alpha tests.
4. Redeploy ca-worker and ca-finalize so Friday's run uses these changes.

## Test run (staging only)
Manual run of #ideas-equities and #ideas-commodities for the week ending Oct 2, saved to staging task rows only. No finalize, no DM, no state change.

## Report
- Tax-loss basket (ChrisM) present?
- Lumber squeeze (ChrisM) present and bullish?
- Corn appears once, as long?
- ChrisM's Japan, THNQ, SDEV present?
- Did the direction check answer every idea (any retry or direction_check_failed)?
- Ideas per channel, and credits (extraction, direction check, total).
- ELMT (Sep 18) is not re-run, so its last result (bullish) stands.

## Technical details
- `extract.ts` `checkDirections`: if `parsed.checks` is a string, `JSON.parse` it. Validate it's an array with ids 0..n-1, each `author_view` in {positive, negative, unclear}. Otherwise throw `DirectionCheckError`. Retry once inside the worker.
- `ca-worker`: catch `DirectionCheckError` → `status: failed, error: "direction_check_failed"`, no attempts-based retry. New pure helper `mergeSameAuthor(ideas, review)` keyed on `author_id` + normalized first ticker, keeping the max `source_ts`.
- `ca-finalize`: warning line for tasks with `error = 'direction_check_failed'`, alongside the existing credit_cap line.
- Tests in `supabase/functions/_shared/community-alpha/` (deno).
