# Community Alpha: "second look" pass for more consistent recall

## What it does
After the first extraction, for each channel and week:
1. Collect the messages that produced no idea. A message counts as "used" if it was the source of a kept idea (after the validator and same-author merge).
2. If any are left, send them back to the AI with the same extraction rules, plus one added line asking for missed ideas (wording below).
   - So the AI can read replies in context, other messages from the same threads go along as background only. These are the messages that already produced ideas and pre-window parents.
   - The AI may only return ideas whose source is one of the unused messages.
3. New ideas go through the same steps as first-pass ideas:
   - the validator (author, source, channel rules, excluded authors)
   - removing duplicates of a first-pass idea (same link and tickers)
   - the same-author merge across both passes (latest message wins)
   - the single direction check, which covers all ideas from both passes in one call
4. Credits count toward the run's 3-credit cap. The cap is checked before the call, like every other AI call. The second look's tokens are recorded under extraction.
5. If the second look fails, the first-pass ideas stand. The task still completes, and an internal warning "second_look_failed" is logged. Only the direction check can fail a task.

Added line for the second-look request (my wording; tell me if you want different text):
"These messages produced no idea in a first pass. Using the same rules, return only ideas that were missed. Return none if there are none. Messages marked context_only are background and can't be a source."

## Recorded per task (internal)
- How many messages were sent to the second look, and how many ideas it added after validation and merge.
- Each added idea is tagged internally as coming from the second look, so it can be reviewed. The tag is not shown on the members page.

## Tests
- Selecting unused messages: sources of kept ideas are excluded, and replies in the same thread go along as context only.
- An idea from the second look whose source is a context-only or first-pass message is rejected.
- Merge across passes: same author, same instrument, latest message kept.
- If the second look fails, the first-pass ideas are kept.
- The existing Community Alpha tests are re-run, then ca-worker is redeployed.

## Test runs (staging task rows only)
Three separate manual runs of #ideas-equities for the week ending Oct 2. No finalize, no DM, no state change.

## Report, per run
- Which of ChrisM's four ideas appear: tax-loss basket, Japan, THNQ, SDEV. For each, whether it came from the first pass or the second look.
- How many ideas the second look added, with a one-line list of them.
- Credits: extraction, second look, direction check, total.

## Technical details
- `extract.ts`: `extractIdeas` gets an optional `secondLook` flag that appends the added line to the system prompt. Candidates are sent as normal messages; thread mates are sent with `context_only: true`, the same mechanism used for pre-window parents.
- `ca-worker` `processTask`: run pass 1, then validate and merge. Then `guard.beforeCall()`, then pass 2 on unused messages. The validator gets `contextTs` = context-only set ∪ first-pass source messages. Merge `ideas` and `review` arrays, dedupe by `ideaKey`, re-run `mergeSameAuthor`, then run the direction check once.
- Task row: add `second_look_sent` / `second_look_added` inside the existing `review` or `rejected` JSON (no schema change). Usage goes through the existing `onUsage("extract", ...)`. A separate second-look credit figure for the report comes from the gateway log for that call.
