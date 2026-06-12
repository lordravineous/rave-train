# Deploying THE LAST SHUTTLE leaderboard

The leaderboard runs on a Cloudflare Worker with KV storage. Free tier, no server, no credit card. About 10 minutes, all in the browser.

## 1. Create a Cloudflare account
Sign up free at https://dash.cloudflare.com/sign-up (no domain needed).

## 2. Create the Worker
1. Dashboard → **Workers & Pages** → **Create** → **Create Worker**
2. Name it `rave-train-leaderboard` → **Deploy** (deploys a hello-world for now)
3. Click **Edit code**, delete everything, paste in the contents of `worker.js`, then **Deploy**

## 3. Create the KV namespace and bind it
1. Dashboard → **Storage & Databases** → **KV** → **Create namespace** → name it `rave-train-scores`
2. Back on the Worker → **Settings** → **Bindings** → **Add** → **KV namespace**
3. Variable name: `SCORES` (must be exactly this) → select `rave-train-scores` → **Save**
4. Redeploy if prompted

## 4. Point the game at it
Copy the Worker URL (shown on its overview page, like `https://rave-train-leaderboard.yourname.workers.dev`) and paste it into `LB_URL` near the top of the `<script>` in **both** `rave-train.html` and `index.html`:

```js
const LB_URL = 'https://rave-train-leaderboard.yourname.workers.dev';
```

Commit and push — done.

## 5. Test it
Open `<your-worker-url>/scores` in a browser — you should see `{"board":[]}`. Then finish The Last Shuttle with all 18 aboard and the name-entry prompt appears on the win screen.

## Moderation & maintenance
- **Remove a score:** KV namespace → the `board` key → edit the JSON → save.
- **Wipe the board:** delete the `board` key.
- **Rude name slipped through:** add it to `BAD_SUB`/`BAD_EXACT` in the Worker and redeploy (and edit the `board` key to remove the entry).
- **Anti-cheat layers:**
  1. *Run tokens* — the game requests a single-use token the moment the finale starts; the server only accepts a score whose time fits inside the real wall-clock time since the token was issued. Forged times can't be submitted instantly, every fake costs a real-time wait, and tokens are rate-limited to 12/min/IP.
  2. *Signed payloads* — name + time + token are FNV-hashed with a secret; mismatches are rejected.
  3. *Bounds* — sub-8s and over-30s times are impossible and rejected; submissions limited to 5/min/IP.
  4. *One best entry per name.*

  The secret lives in the page source, so a determined cheater who reads the code can still forge a score (after genuinely waiting out the time) — if that happens, delete the entry, and optionally change `LSTSHTL-9000` in both `worker.js` (SECRET) and the game's `lbSig()`.
- **Costs:** free tier allows 100k reads + 1k writes per day to KV — roughly 1,000 full-bus finishes a day before you'd ever see an error. You will not hit this.
