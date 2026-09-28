# Community Alpha — Finishing Plan (revised)

Goal: move the weekly Slack digest off the laptop into Terminus. It runs by itself after each Friday 2:00 PM PT close, writes to staging for now, posts a Slack summary, and members read it on a protected /community-alpha page.

---

## 1. Components and how they connect

```text
pg_cron (5 past each hour, Fri 21:05 UTC -> Sat, covers PDT and PST)
   │  POST + internal token (from Vault)
   ▼
ca-scheduler ──► computes closed windows after state row ──► 1 run + tasks (week x channel)
   │               (nothing due -> "already up to date through Fri {date}", once per Friday)
   ▼ kicks
ca-worker (one task per call)
   ca_claim_task() → fetch 1 channel / 1 week (messages + thread replies)
   → filter in code → Claude Sonnet 5 extraction (chunked if large) → validate
   → save ideas + counts on the task → kick next hop or ca-finalize
   ▼
ca-finalize
   replace-per-week merge into staging/live (with safeguards) → advance state
   (scheduled runs only) → record tokens/credits → Slack summary
   ▼
community-alpha-read (Outseta-verified, live table only) ◄── /community-alpha page
```

**Functions (4 new; copilot-agent and Daily Briefing untouched):**
- `ca-scheduler` — decides which weeks are due, queues work, or reports "up to date".
- `ca-worker` — one (week, channel) task per call.
- `ca-finalize` — merges, advances state, sends the Slack message. Wrapped so a crash still posts a warning.
- `community-alpha-read` — serves live digest data to logged-in members.

**Shared code (`_shared/community-alpha/`):** window math, Slack client, filters, extraction prompt + schema, validator, merge, config.

**One config switch:** `CA_MODE` (`staging` | `live`) selects table, state row, and Slack destination. Staging = DMs to U03CSJ4QPFS and UUSBEJG9K prefixed `[STAGING]`; live = channel to be decided.

**Fixed config (in code):**
- Channels: C6Q4C2WR1 #ideas-equities, C71BKN7PW #ideas-commodities, C70L60T6C #ideas-fx, C71DZ6805 #ideas-rates, C07U19HEQUS #big-bet, C018EPUKTH6 #emerging-markets, C6Q22AT9R #general (strict), C0ABECRNTA8 #hedging.
- Team IDs: U6PEHV6RW, U03CSJ4QPFS, U6R43TGFQ, U0AR0DT1BSP, U01CP2H2JDQ, UUSBEJG9K.
- Page link: published Terminus URL + `/community-alpha`.

**Slack scopes:** existing install is enough — `channels:history` (messages/replies), `channels:read`, `users:read` (`users.info` for author names), `chat:write` (DMs via `chat.postMessage` with the user ID as channel; bots can DM this way without `im:write`). No reinstall needed. If a channel later turns out to be private, `groups:history` would be required.

**Week record — unchanged from the archive:**
- `team_excluded_count` = team-author messages removed.
- `tactical_excluded_count` = private-list messages removed + position-management posts the AI dropped (one combined number).
- Ideas keep the archive fields exactly, including `technical`.

**Table changes (small, additive):**
- `community_alpha_runs`: add `hops_remaining`, `credits_used`, `last_kick_at`, `is_manual` (manual runs never move state).
- `community_alpha_tasks`: add `anchor_at` (exact window end) and `chunk_count`.
- Partial unique index: one active run per mode (single-flight lock).
- Weeks tables unchanged.

## 2. Handling time limits

- Smallest unit per call: one channel for one week (one Slack fetch + one AI call, or a few chunks). Chunks are internal; the channel still counts once in counts and warnings.
- `ca_claim_task()` reclaims tasks stuck over 10 minutes; a task fails after 3 attempts and becomes a warning line.
- Self-chaining: hop budget, short delay between hops, continues only while pending tasks exist. The hourly cron resumes a stalled chain.
- Catch-up: each missed week is its own digest with its own window.
- Slack 429 honors `Retry-After`; AI 429/5xx bounded backoff; AI 402/403 pause the run and send a warning.
- Finalize crash: try/catch posts a warning; if the process dies outright, the next cron check sees a run stuck in `finalizing` and posts the warning then.

## 3. Rules enforced in code

- Window: Friday 2:00 PM PT → next Friday 2:00 PM PT, exclusive start / inclusive end, via Luxon `America/Los_Angeles`. Thread replies judged by their own timestamp.
- Pre-AI filters: team IDs, private list (secret), bots/system, empty/emoji-only.
- Validator: source message must be fetched, author matches and not excluded, values in allowed sets, #general only ticker+direction, permalink/timestamp built by code.
- Cap: 50 ideas per week.
- State advances to the latest processed Friday even with zero ideas — scheduled runs only.

**Re-runs (replace per week) with safeguards:**
- Live weeks up to 2026-09-25 (imported archive) are never reprocessed unless explicitly requested (hard check in finalize).
- If a channel fails on a re-run, that channel's previous ideas are kept (ideas are grouped by channel for the swap).

## 4. Security

- **Functions not publicly callable, no secret for you:** I generate a random internal token (never shown to you), stored as a backend secret and in the encrypted Vault. Cron reads it from Vault; every `ca-*` function rejects requests without it. Manual reruns use the same path when you ask me.
- **Page data protected server-side:** tables stay locked (RLS, no policies). `community-alpha-read` verifies the Outseta token with the existing shared verifier, then reads with backend privileges. The access decision lives in one function (`canAccessCommunityAlpha(claims)`) — today "any logged-in member"; a plan check drops in there later. Live table only.
- **Private exclusion list:** secret only; never logged, stored, returned, or shown — only folded into the combined tactical count.
- **AI:** Claude Sonnet 5 via the gateway Messages endpoint; our code doesn't log prompt content.

## 5. Build order (small, testable steps)

1. **Window logic + tests.** Fri 1:59 PM vs 2:01 PM PT; exactly 2:00:00 (end-inclusive, start-exclusive); DST start and end weeks both anchor at 2:00 PM PT; multi-week catch-up gives distinct windows; result independent of run time.
2. **Filters, validator, merge + tests.** Includes #general rule, 50 cap, archive-week protection, failed-channel keeps prior ideas, re-run idempotence.
3. **Slack reader dry run** — 2026-09-18 and 2026-09-25, counts only, nothing saved. (Bot token form sent here; private list form too.)
4. **Extraction** — your exact instructions, one channel for 2026-09-25, results on the task row.
5. **Queue + worker chain** — manual run for both weeks into staging; state row 2 stays at Sep 18.
6. **Finalize + staging DMs** — merge into staging, token/credit usage recorded, `[STAGING]` DM to both recipients; re-run to prove no duplicates; state still untouched.
7. **Schedule** — enable cron; the first real run after Oct 2 closes catches up Sep 25 + Oct 2 and moves row 2 to Oct 2.
8. **Members page** — `community-alpha-read` + `/community-alpha` from your HTML reference (Fridays list, weekly digest, search, top tickers 1W/1M, Technical tag + hide toggle, mobile).
9. **Go live** (after 3–4 weeks) — flip `CA_MODE`, set the channel.

## 6. Still needed from you

- Bot token and private exclusion list (secure forms at step 3).
- Extraction instructions (step 4) and dashboard HTML (step 8).
- Live Slack channel (at go-live).

## Where I disagree or see risk

- **"Already up to date" message:** the cron checks hourly, so posting it on every check would spam ~30 DMs a week. I'll post it only once per Friday (first check after close) and on manual runs. Tell me if you want otherwise.
- **50-idea cap:** needs a rule for what gets cut. Proposal: keep non-#general channels first, then newest; report "N ideas over cap dropped" in the warning line so it's never silent.
- **Replace per week vs. identity:** within a week, ideas are still de-duplicated by permalink + tickers, but a changed AI answer on re-run replaces the old version rather than adding a near-duplicate — intended.
- **Step 7 compares Sep 25 twice** (manual test in step 5–6, then the real catch-up overwrites staging Sep 25). Fine for staging; just noting the manual result gets replaced.
- **Slack history limits** on long catch-ups, and **#general size** (may need several chunks, raising AI cost for that channel).
- **DMs via user ID** work with `chat:write` for bot tokens in practice; if Slack returns `channel_not_found`, `im:write` would be the fix (reinstall).

## Technical notes

- Luxon via `npm:luxon`; tests with `deno test`.
- Anthropic via gateway Messages API with tool-based structured output; usage tokens per task, summed on the run.
- Cron: `pg_cron` + `pg_net`, token from `vault.decrypted_secrets`; scheduled SQL run once, not as a migration.
