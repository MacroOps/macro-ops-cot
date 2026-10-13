# Community Alpha architecture overview

Create one new file, `docs/community-alpha/ARCHITECTURE.md`. No code, config, database, or deployment changes.

## How it will be written
Everything comes from the current code and the live setup, read only:
- the shared pipeline code (window, config, filters, extract, validate, merge, postcheck)
- the scheduler, worker, finalize, and read functions
- the members page and its dashboard port
- the database tables, the cron job, and the access rules in the entitlements file
- recent run records for typical credits (read-only queries)

## Sections
1. **Flow diagram** (mermaid, in the file): cron, then scheduler, task queue, worker (Slack read, filters, extraction, validator, same-author merge, second look, direction check), finalize, weeks tables, Slack DM, and read function to the /community-alpha page.
2. **Components**: each function, the cron job, each table (state, runs, tasks, live/staging weeks, usage), and the page. One short paragraph each.
3. **Weekly pipeline, step by step**: Friday 2 PM PT window (DST-safe), Slack read with thread replies and attachment summaries, filters (bots, empty posts, team list, private list), extraction, validator, same-author merge, second look, direction check with one retry, finalize (dedupe, 50-idea cap, idempotent), Slack DM (no link previews, warning lines).
4. **Instructions, verbatim**: the extraction instructions, the second-look line, and the direction check rules, copied exactly from the code.
5. **Safeguards**: 3-credit cap per run (every AI call counts, `credit_cap`), `direction_check_failed`, second-look failure handling, task retries and stale-task recovery, archive protection (`source = 'archive'`), staging vs live state, the Slack link check on the page.
6. **Access rules**: Collective sees live; Team Plan sees live and staging; everyone else is refused. Where each rule lives (read function, entitlements file, page gate). Notes that the read function never returns author IDs or post times.
7. **Config values and how to change each**: channels, team member IDs (shown), private exclusion list (described only, never its IDs), schedule, model, credit cap, idea cap, page URL. For each: where it lives and whether changing it needs a redeploy or a secret update.
8. **Typical credits per week**: from recent runs (about 0.9 per full 8-channel week with the second look), split into extraction, second look, and direction check.
9. **Known limitations**: run-to-run recall variation (for example, the tax-loss basket), attachments read by name only, Bond volatility and SDEV rulings pending, recall measurement against Mike's digests ongoing (Oct 2 tuning frozen), the "staff" wording left in the read function, and no real-plan sign-in test yet.

## Excluded
No tokens, keys, Vault contents, project IDs, internal URLs, or private exclusion list IDs.

## Check after writing
Scan the file for anything that looks like a secret, a token, a project ID, or a private-list member ID, and confirm the mermaid diagram renders.
