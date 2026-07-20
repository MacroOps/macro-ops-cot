# Move Macro Ops API to Fly.io (Kindergarten Guide)

Goal: Get your Macro Ops API running in the cloud on Fly.io with a permanent HTTPS URL, so you can retire the local machine. Then point the app at the new URL. No coding required from you — just clicks and copy/paste.

---

## Part A — What you'll end up with

- A live URL like `https://macro-ops.fly.dev` that works forever, from anywhere.
- Your scheduled ingestion jobs running on Fly's cron.
- The Lovable app switched over by updating one secret.

---

## Part B — Step-by-step (do these in order)

### Step 1 — Create a Fly.io account
1. Go to **https://fly.io/app/sign-up**.
2. Sign up with GitHub (fastest — it'll help us later).
3. Add a credit card when it asks. Fly has a free allowance; a small always-on API usually costs **$0–$5/month**.

### Step 2 — Install the Fly command-line tool (one time)
This is the only "scary" part. It's just copy/paste into your computer's terminal.

- **Mac:** open the Terminal app, paste this, hit Enter:
  ```
  curl -L https://fly.io/install.sh | sh
  ```
- **Windows:** open PowerShell, paste this, hit Enter:
  ```
  iwr https://fly.io/install.ps1 -useb | iex
  ```
Then close and reopen the terminal, and run:
```
fly auth login
```
A browser window opens — click **Continue** to log in.

### Step 3 — Make sure your API repo has a Dockerfile
Fly needs a `Dockerfile` in the repo root (a small text file telling Fly how to run your API). Open your GitHub repo in the browser and check.

- **If you see a `Dockerfile`:** great, skip to Step 4.
- **If you don't:** tell me the repo URL and I'll write one for you and give you a single "add file" link on GitHub to paste it.

### Step 4 — Launch the app on Fly
In the terminal, navigate into your API folder (if the code is on the old machine, download the repo from GitHub first: `git clone <your-repo-url>` then `cd <folder>`). Then run:
```
fly launch
```
Answer the prompts:
- **App name:** `macro-ops` (or whatever you want — this becomes the URL)
- **Region:** pick the one closest to you (e.g. `iad` for US East)
- **Postgres / Redis:** **No** to both (unless your API needs them — tell me if it does)
- **Deploy now:** **Yes**

Wait ~2 minutes. When done it prints a URL like `https://macro-ops.fly.dev`.

### Step 5 — Set your API's own secrets on Fly
If your Macro Ops API needs API keys or a database URL to run, set them with:
```
fly secrets set X_API_KEY=dev-key-12345 OTHER_KEY=...
```
(One command, all keys separated by spaces.) Tell me which keys the API needs and I'll give you the exact command.

### Step 6 — Move the cron jobs to Fly
Two clean options — I'll pick one for you once I see the repo:
- **Option A (simplest):** Add a `[processes]` block to `fly.toml` with a scheduled machine. Fly runs your ingestion script on a schedule.
- **Option B:** Trigger the ingestion via a Supabase `pg_cron` job that calls your Fly URL over HTTPS (we already use this pattern for the dashboard refresh).

Either way I'll write the exact config and send you the one file to commit.

### Step 7 — Test the new URL
Open in browser:
```
https://macro-ops.fly.dev/docs
```
You should see the same Swagger docs page you have today. If yes — success.

### Step 8 — Point Lovable at the new URL
Once you confirm the new URL works, tell me and I'll update the `MACRO_OPS_API_URL` secret in Lovable to `https://macro-ops.fly.dev`. The whole Signals Lab and Copilot start working immediately, no code changes.

### Step 9 — Retire the old machine
Once the app is showing live data from the Fly URL for a day, you can safely turn off the old machine.

---

## Part C — What I need from you to start

Just answer these two and I'll do the rest as far as I can from my side:

1. **Paste your API's GitHub repo URL** (so I can check for a Dockerfile and see what secrets/cron jobs it needs).
2. **Do you want me to draft the Dockerfile / fly.toml / cron config for you** so you only have to click "Add file" on GitHub and paste? (Recommended: yes.)

I can't run `fly launch` for you — that command has to run on your computer where you're logged into Fly — but I can prep every config file and give you the exact commands to paste at each step.

---

## Part D — Cost & time expectations

- **Time:** 20–40 minutes end-to-end the first time.
- **Cost:** Fly's shared-cpu-1x with 256MB RAM is free. If your API needs more RAM, expect ~$2–5/month. Cron machines only bill while running.
- **Reliability:** Fly restarts crashed apps automatically and has global HTTPS + a stable URL. This is production-grade.

---

## Technical notes (for reference, ignore if not curious)

- Fly auto-provisions Let's Encrypt TLS for `*.fly.dev` — no cert work.
- `fly.toml` controls port, health checks, and scheduled machines.
- The existing `macro-ops-proxy` edge function and all frontend hooks continue to work unchanged; only `MACRO_OPS_API_URL` changes.
- If ingestion writes to a database on the old machine, we'll need to migrate that too — flag it when you share the repo.