// ============================================================
//  RAVE TRAIN — THE LAST SHUTTLE leaderboard
//  Cloudflare Worker + KV. Free tier. No server to maintain.
//
//  Setup (see DEPLOY.md):
//    1. Create a KV namespace, bind it to this Worker as  SCORES
//    2. Deploy, copy the Worker URL into LB_URL in rave-train.html
//
//  Routes:
//    GET  /scores  -> { board:[{n,t,d}...] }  top 25, fastest first
//    POST /submit  -> { ok, rank, board }     body: {n,t,s}
//
//  Only runs that finish THE LAST SHUTTLE with all 18 aboard
//  qualify — the game only submits then, and the server rejects
//  anything outside sane bounds as a second line of defence.
// ============================================================

const SECRET   = 'LSTSHTL-9000';  // must match lbSig() in the game
const MAX_KEEP = 100;             // scores stored
const TOP_SHOW = 25;              // scores returned
const MIN_MS   = 8000;            // gauntlet is ~1900px at 190px/s — sub-8s is impossible
const MAX_MS   = 30000;           // shuttle leaves at 30s
const RATE_MAX = 5;               // submissions per IP per minute

// profanity filter — leetspeak is normalised first (0→O, 1→I, 3→E, ...)
// substring matches (unambiguous):
const BAD_SUB = ['FUCK','FCUK','FUK','PHUK','SHIT','SHYT','CUNT','COCK','DICK',
  'PISS','TWAT','WANK','SLUT','WHORE','BITCH','NIGG','NGGER','FAGG','KIKE',
  'SPIK','CHINK','GOOK','NAZI','PEDO','HITLA','PORN','ANUS','SEMEN','PENIS',
  'VAGIN','BOOB','TITS','JIZZ','HOMO','TRANY','RETRD'];
// exact matches only (substrings would catch innocent names like GRAPE, BASS):
const BAD_EXACT = ['ASS','ARSE','RAPE','CUM','CUMS','FAG','FAP','POO','POOP',
  'CRAP','DAMN','HELL','SEX','SEXY','SPIC'];

const LEET = {'0':'O','1':'I','3':'E','4':'A','5':'S','6':'G','7':'T','8':'B','9':'G'};
function isClean(name){
  const norm = name.split('').map(c => LEET[c] || c).join('');
  for (const w of BAD_SUB) if (norm.includes(w) || name.includes(w)) return false;
  return !BAD_EXACT.includes(norm) && !BAD_EXACT.includes(name);
}

// same FNV-1a signature the game computes — keeps casual cheating out
function sig(n, t){
  let h = 0x811c9dc5;
  const s = n + '|' + t + '|' + SECRET;
  for (let i = 0; i < s.length; i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const CORS = {
  'Access-Control-Allow-Origin': '*',   // optionally lock to your site, e.g. 'https://lordravineous.github.io'
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

export default {
  async fetch(req, env){
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (req.method === 'GET' && url.pathname === '/scores'){
      const board = (await env.SCORES.get('board', 'json')) || [];
      return json({ board: board.slice(0, TOP_SHOW) });
    }

    if (req.method === 'POST' && url.pathname === '/submit'){
      // --- rate limit: RATE_MAX submissions per IP per minute ---
      const ip = req.headers.get('cf-connecting-ip') || 'unknown';
      const rlKey = 'rl:' + ip;
      const hits = parseInt(await env.SCORES.get(rlKey) || '0', 10);
      if (hits >= RATE_MAX) return json({ ok: false, error: 'easy tiger — try again in a minute' }, 429);
      await env.SCORES.put(rlKey, String(hits + 1), { expirationTtl: 60 });

      // --- parse + validate ---
      let body;
      try { body = await req.json(); } catch { return json({ ok: false, error: 'bad request' }, 400); }
      const name = String(body.n || '').toUpperCase();
      const t = Math.round(Number(body.t));

      if (!/^[A-Z0-9]{2,5}$/.test(name)) return json({ ok: false, error: '2-5 letters or numbers' }, 400);
      if (!isClean(name))                return json({ ok: false, error: "that name's not rave-friendly — try another" }, 400);
      if (!Number.isFinite(t) || t < MIN_MS || t > MAX_MS)
        return json({ ok: false, error: 'impossible time' }, 400);
      if (body.s !== sig(name, t))       return json({ ok: false, error: 'nice try' }, 400);

      // --- insert: one entry per name, keep their best ---
      let board = (await env.SCORES.get('board', 'json')) || [];
      const prev = board.findIndex(e => e.n === name);
      if (prev >= 0){
        if (board[prev].t <= t){          // not a PB — report current rank
          return json({ ok: true, rank: prev + 1, pb: false, board: board.slice(0, TOP_SHOW) });
        }
        board.splice(prev, 1);
      }
      board.push({ n: name, t, d: Date.now() });
      board.sort((a, b) => a.t - b.t || a.d - b.d);
      board = board.slice(0, MAX_KEEP);
      await env.SCORES.put('board', JSON.stringify(board));

      const rank = board.findIndex(e => e.n === name && e.t === t) + 1;
      return json({ ok: true, rank: rank || null, pb: true, board: board.slice(0, TOP_SHOW) });
    }

    return json({ error: 'not found' }, 404);
  }
};
