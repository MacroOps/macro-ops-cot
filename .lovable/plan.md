# Community Alpha — Finishing Plan

Goal: move the weekly Slack digest off the laptop into Terminus. It runs by itself every Friday, writes to staging for now, sends a Slack summary, and members read it on a protected /community-alpha page.

---

## 1. Components and how they connect

```text
pg_cron (hourly, Fri–Sat only)
   │  POST + internal token (from Vault)
   ▼
ca-scheduler ──► works out missed windows ──► creates 1 run + tasks (week x channel)
   │                                              in community_alpha_runs / _tasks
   ▼ kicks
ca-worker (called repeatedly, one task per call)
   ca_claim_task() → fetch 1 channel for 1 week from Slack → filter in code
   → Claude Sonnet 5 extraction → validate → save ideas/counts on the task
   → if tasks remain: kick itself again (with a hop budget)
   → if none remain: kick ca-finalize
   ▼
ca-finalize
   merge tasks into weeks table (staging or live) by (permalink + tickers)
   → advance state row → record token/credit usage on run → post Slack message
   ▼
community-alpha-read (Outseta-verified) ◄── /community-alpha page
```

**Functions (4 new, nothing existing changes):**
- `ca-scheduler` — decides which weeks are due and queues the work.
- `ca-worker` — processes exactly one (week, channel) task per call.
- `ca-finalize` — merges results, advances state, sends the Slack message.
- `community-alpha-read` — serves digest data to logged-in members only.

**Shared code (`_shared/community-alpha/`):** window math, Slack client, pre-AI filters, extraction prompt + schema, validator, merge, config.

**One config switch:** a `CA_MODE` secret (`staging` | `live`) picks target table, state row, and Slack destination (DM with `[STAGING]` prefix vs. channel). Switching to live = change one value.

**Table changes (small):**
- `community_alpha_runs`: add `hops_remaining`, `credits_used`, `last_kick_at` (credit/cost tracking and chain safety).
- `community_alpha_tasks`: add `anchor_at` (exact window end) so each task knows its window.
- Unique index on runs to prevent two active runs at once (single-flight lock).
- No changes to weeks tables — ideas stay jsonb.

## 2. Handling time limits

- Work is split into the smallest unit: one channel for one week per call (~8 tasks per week). Each call does one Slack fetch (paginated, with threads) and one AI call — well inside the limit.
- `ca_claim_task()` already hands out one task at a time and reclaims tasks stuck over 10 minutes; tasks that fail 3 times are marked failed and reported as a warning instead of retried forever.
- Self-chaining has a hop budget, a short delay between hops, and only continues while pending tasks exist. The hourly cron doubles as a backstop to resume a stalled chain.
- Catch-up: 4 missed weeks = 32 tasks in one run; each week is finalized as its own digest with its own window.
- Slack rate limits (429) honor `Retry-After`; AI 429/5xx use bounded backoff; AI 402/403 pause the run and send a warning Slack message.

## 3. Security

**Functions not publicly callable, with no secret for you to manage:**
- I generate a random internal token myself (you never see or handle it), store it as a backend secret and in the database's encrypted Vault. Cron reads it from Vault; each `ca-*` function rejects any request without it. Manual reruns go through the same path when you ask me.
- Workers/finalize only ever called by the scheduler or each other with that token.

**Member data protected server-side:**
- Tables stay locked (RLS on, no policies) — the browser can never read them directly.
- `community-alpha-read` verifies the Outseta token exactly like watchlist/alerts do today (`_shared/outseta-jwt.ts`), then reads with backend privileges. Only the live table is served (staging reachable only for an admin check if you want it).

**Private exclusion list:** stored only as a secret, used in memory during filtering, never logged, stored, returned, or counted separately in anything members see (only "team excluded" and a combined excluded count on runs, internal only).

**AI:** Claude Sonnet 5 via the gateway's Messages endpoint (allowed under your retention settings); prompts not logged by our code.

## 4. Build order (each step testable on its own)

1. **Window logic + tests.** Pure functions using a real timezone library (Luxon, `America/Los_Angeles`). Tests: Friday 1:59 PM vs 2:01 PM PT; window containing DST start (March) and end (November) — both still 2:00 PM PT; exclusive start / inclusive end at exactly 2:00:00; 3-week catch-up returns 3 distinct windows; result independent of when "now" is inside the week.
2. **Filters + validator + merge + tests.** Team/private list, bot/system, empty/emoji-only; validator rejects unknown messages, author mismatch, excluded authors, bad enum values; merge by permalink+tickers is idempotent (re-run twice = same row).
3. **Slack reader (dry run).** Manual call for one channel/week; report message counts and excluded counts only — nothing saved.
4. **Extraction step.** Plug in your exact prompt; run on one channel/week in staging; inspect ideas in the task row.
5. **Queue + worker chain.** Scheduler creates tasks; worker chain completes all 8 channels for 2026-10-02 into staging.
6. **Finalize + Slack DM.** Merge into staging, advance state row 2, `[STAGING]` DM with summary and warnings; record token/credit usage. Re-run the same week to prove no duplicates.
7. **Catch-up test.** Staging row 2 is at Sep 18 → first run should produce Sep 25 and Oct 2 (compare Sep 25 with Mike's archive).
8. **Schedule.** Enable the cron (hourly Friday 2 PM PT–Saturday only, ~30 checks/week; it exits immediately when nothing is due).
9. **Members page.** `community-alpha-read` + `/community-alpha` built from your HTML reference: Friday list, weekly digest, search across weeks, top tickers 1W/1M, Technical tag + hide toggle, mobile layout.
10. **Go live (after 3–4 weeks).** Flip `CA_MODE` to `live` and set the channel.

## 5. What I need from you

- Slack bot token (scopes: `channels:history`, `channels:read`, `chat:write`, `im:write`, plus `groups:history` if any channel is private) and the bot added to all 8 channels.
- The 8 channel IDs.
- Macro Ops team Slack user IDs.
- Private exclusion list (you'll paste it into a secure form).
- Staging DM recipient user ID; later, the live channel.
- The exact extraction instructions (step 4) and the dashboard HTML (step 9).
- Page link to put in the Slack message (published URL `/community-alpha`?).

## Open questions / risks

- **Should the page show all Terminus members or only certain Outseta plans?** Currently no paywall exists; I'll default to "any logged-in member".
- **Edits/deletes in Slack after the window:** re-runs merge, so a deleted message's idea stays unless we also prune. Proposal: a re-run replaces ideas for that week rather than only adding. Your call.
- **Thread replies posted after the window closes** to a message inside the window: include or exclude? Proposal: judge by the reply's own timestamp.
- **Idea identity with changed tickers** on a re-run (AI returns different tickers) creates a second idea — risk of near-duplicates; replace-per-week avoids it.
- **Credit cost:** ~8 Sonnet calls per week; #general may be large — may need chunking if a channel exceeds input limits.
- **Slack free-plan history limits** could hide older messages during long catch-ups.
- **Old vs new comparison** depends on the same prompt; small model differences are expected.

## Technical notes

- Luxon via `npm:luxon` in Deno; tests run with `deno test`.
- Gateway endpoint for Anthropic uses Messages API with tool-based structured output; usage tokens saved per task and summed on the run.
- Cron: `pg_cron` + `pg_net`, token read via `vault.decrypted_secrets`; SQL run once (not a migration) so it isn't copied on remix.
- Single-flight: partial unique index on runs where status in (processing, finalizing) per mode.
