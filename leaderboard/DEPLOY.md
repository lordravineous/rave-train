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
- **Anti-cheat:** scores are signed by the game and the server rejects times under 8s, over 30s, and rate-limits to 5 submissions/min/IP. The secret lives in the page source, so a determined cheater can still forge a score — if that happens, change `LSTSHTL-9000` in both `worker.js` (SECRET) and the game's `lbSig()`, redeploy, and delete the fake entry.
- **Costs:** free tier allows 100k reads + 1k writes per day to KV — roughly 1,000 full-bus finishes a day before you'd ever see an error. You will not hit this.
