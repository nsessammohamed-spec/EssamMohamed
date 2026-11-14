/* وسيط آمن (Cloudflare Worker) بين لوحة التحكم و GitHub.
   - التوكن الحقيقي محفوظ هنا كـ Secret ومش بيوصل للمتصفح ولا للريبو أبدًا.
   - كلمة السر بتتراجع هنا (مش في المتصفح) مع حد للمحاولات الغلط.
   - اللوحة تقدر تقرأ/تكتب data/site.js وصور images/uploads وفيديوهات videos/uploads (mp4/webm) بس. أي مسار تاني مرفوض. */
const enc = new TextEncoder();
const SESSION_TTL = 4 * 3600;          // مدة الجلسة (ساعات)
const IP_MAX_FAILS = 5, IP_LOCK = 900; // 5 محاولات غلط من نفس الجهاز = قفل 15 دقيقة
const GLOBAL_MAX_FAILS = 25;           // حماية من محاولات موزعة على أجهزة كتير
const MAX_BODY = 9 * 1024 * 1024;

const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => Uint8Array.from(h.match(/../g) || [], x => parseInt(x, 16));
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };

async function pbkdf2(pw, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, k, 256));
}
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
async function makeSession(env) {
  const p = b64u(enc.encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_TTL, n: hex(crypto.getRandomValues(new Uint8Array(8))) })));
  return p + '.' + b64u(await hmac(env.SESSION_SECRET, p));
}
async function sessionOk(env, tok) {
  try {
    const [p, s] = String(tok || '').split('.'); if (!p || !s) return false;
    if (!same(await hmac(env.SESSION_SECRET, p), unb64u(s))) return false;
    return JSON.parse(new TextDecoder().decode(unb64u(p))).exp > Date.now() / 1000;
  } catch (e) { return false; }
}

function corsHeaders(env, req) {
  const o = req.headers.get('Origin') || '';
  const ok = String(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const h = { 'Vary': 'Origin', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (o && ok.includes(o)) Object.assign(h, { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS', 'Access-Control-Max-Age': '600' });
  return h;
}
const reply = (h, body, status = 200, extra) => new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json' }, h, extra || {}) });

async function getFails(kv, key) { try { return JSON.parse(await kv.get(key)) || { n: 0 }; } catch (e) { return { n: 0 }; } }

async function login(req, env, h) {
  if (!env.RL) return reply(h, { error: 'misconfigured' }, 500);
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  const ik = 'ip:' + ip, gk = 'global';
  const [fi, fg] = await Promise.all([getFails(env.RL, ik), getFails(env.RL, gk)]);
  if (fi.n >= IP_MAX_FAILS) return reply(h, { error: 'locked', retry: IP_LOCK }, 429, { 'Retry-After': String(IP_LOCK) });
  if (fg.n >= GLOBAL_MAX_FAILS) return reply(h, { error: 'locked', retry: IP_LOCK }, 429, { 'Retry-After': String(IP_LOCK) });
  let pw = '';
  try { pw = String((await req.json()).password || ''); } catch (e) {}
  const [saltHex, hashHex] = String(env.ADMIN_HASH || '').split(':');
  let ok = false;
  if (pw && pw.length <= 256 && saltHex && hashHex) ok = same(await pbkdf2(pw, unhex(saltHex)), unhex(hashHex));
  if (!ok) {
    await Promise.all([
      env.RL.put(ik, JSON.stringify({ n: fi.n + 1 }), { expirationTtl: IP_LOCK }),
      env.RL.put(gk, JSON.stringify({ n: fg.n + 1 }), { expirationTtl: IP_LOCK })
    ]);
    await new Promise(r => setTimeout(r, 400));
    return reply(h, { error: 'bad_password' }, 401);
  }
  await env.RL.delete(ik);
  return reply(h, { session: await makeSession(env), repo: env.REPO, ttl: SESSION_TTL });
}

/* المسموح بس — أي حاجة غير كده بترجع 403 */
function route(method, path, repo) {
  const base = '/repos/' + repo;
  if (method === 'GET' && (path === base || path === base + '/pages' || path === base + '/pages/builds/latest')) return 'read';
  if (path === base + '/contents/data/site.js' && (method === 'GET' || method === 'PUT')) return method === 'GET' ? 'read' : 'site';
  if (method === 'PUT' && /^\/repos\/[^/]+\/[^/]+\/contents\/images\/uploads\/[A-Za-z0-9_-]{4,40}\.(jpg|webp)$/.test(path) && path.startsWith(base + '/contents/')) return 'image';
  if (method === 'PUT' && /^\/repos\/[^/]+\/[^/]+\/contents\/videos\/uploads\/[A-Za-z0-9_-]{4,40}\.(mp4|webm)$/.test(path) && path.startsWith(base + '/contents/')) return 'video';
  return null;
}
function checkBody(kind, b) {
  if (!b || typeof b.content !== 'string' || typeof b.message !== 'string' || typeof b.branch !== 'string') return false;
  if (b.sha != null && typeof b.sha !== 'string') return false;
  try {
    if (kind === 'site') {
      const t = new TextDecoder().decode(Uint8Array.from(atob(b.content), c => c.charCodeAt(0)));
      if (!t.startsWith('window.SITE=')) return false;
      const o = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
      return o && Array.isArray(o.projects);                  // مجرد بيانات — مفيش كود يتنفذ
    }
    const head = atob(b.content.slice(0, 16));
    if (kind === 'video') return head.slice(4, 8) === 'ftyp' || (head.charCodeAt(0) === 0x1A && head.charCodeAt(1) === 0x45 && head.charCodeAt(2) === 0xDF && head.charCodeAt(3) === 0xA3);   // mp4 / webm حقيقي بس
    const jpg = head.charCodeAt(0) === 0xFF && head.charCodeAt(1) === 0xD8 && head.charCodeAt(2) === 0xFF;
    const webp = head.slice(0, 4) === 'RIFF' && head.slice(8, 12) === 'WEBP';
    return jpg || webp;                                       // صور حقيقية بس
  } catch (e) { return false; }
}


/* ---------- آراء العملاء (الزوار بيبعتوا، وانت بتوافق من لوحة التحكم) ----------
   - الرأي بيتخزن في KV (نفس الـ RL) كـ "منتظر مراجعة" لمدة 60 يوم، ومش بيظهر في الموقع غير لما توافق عليه.
   - حماية: حقل مخفي للبوتات، حد 3 آراء/ساعة لكل جهاز، حد أقصى 300 رأي منتظر، ومنع الروابط في النص. */
const RV_TTL = 60 * 86400, RV_IP_MAX = 3, RV_IP_WINDOW = 3600, RV_MAX_PENDING = 300;
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‎‏‪-‮]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

async function reviewSubmit(req, env, h) {
  if (!env.RL) return reply(h, { error: 'misconfigured' }, 500);
  let b; try { b = await req.json(); } catch (e) { return reply(h, { error: 'bad_request' }, 400); }
  if (b && b.hp) return reply(h, { ok: true });                          // بوت: نتجاهله من غير ما نقوله
  const pid = String((b && b.pid) || ''), name = clean(b && b.name, 40), text = clean(b && b.text, 600);
  const rating = Math.max(0, Math.min(5, parseInt(b && b.rating, 10) || 0));
  if (!/^[\w-]{1,40}$/.test(pid)) return reply(h, { error: 'bad_project' }, 400);
  if (name.length < 2) return reply(h, { error: 'name' }, 400);
  if (text.length < 10) return reply(h, { error: 'text' }, 400);
  if (/https?:\/\/|www\.|\.(com|net|org|ru|xyz|top)\b/i.test(name + ' ' + text)) return reply(h, { error: 'links' }, 400);
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown', ik = 'rvip:' + ip;
  const used = await getFails(env.RL, ik);
  if (used.n >= RV_IP_MAX) return reply(h, { error: 'too_many' }, 429, { 'Retry-After': String(RV_IP_WINDOW) });
  const cur = await env.RL.list({ prefix: 'rv:', limit: RV_MAX_PENDING + 1 });
  if (cur.keys.length > RV_MAX_PENDING) return reply(h, { error: 'full' }, 503);
  const id = Date.now().toString(36) + hex(crypto.getRandomValues(new Uint8Array(3)));
  await env.RL.put('rv:' + id, JSON.stringify({ id, pid, name, text, rating, ts: Date.now() }), { expirationTtl: RV_TTL });
  await env.RL.put(ik, JSON.stringify({ n: used.n + 1 }), { expirationTtl: RV_IP_WINDOW });
  return reply(h, { ok: true });
}
async function reviewPending(env, h) {
  if (!env.RL) return reply(h, { error: 'misconfigured' }, 500);
  const l = await env.RL.list({ prefix: 'rv:', limit: 500 });
  const items = (await Promise.all(l.keys.map(async k => { try { return JSON.parse(await env.RL.get(k.name)); } catch (e) { return null; } }))).filter(Boolean).sort((a, b) => a.ts - b.ts);
  return reply(h, { items });
}
async function reviewDelete(req, env, h) {
  let b; try { b = await req.json(); } catch (e) { return reply(h, { error: 'bad_request' }, 400); }
  const ids = (Array.isArray(b && b.ids) ? b.ids : []).filter(x => /^[a-z0-9]{4,30}$/.test(String(x))).slice(0, 50);
  await Promise.all(ids.map(x => env.RL.delete('rv:' + x)));
  return reply(h, { ok: true, n: ids.length });
}

export default {
  async fetch(req, env) {
    const h = corsHeaders(env, req), url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (!h['Access-Control-Allow-Origin']) return reply(h, { error: 'forbidden_origin' }, 403);
    if (!env.GH_TOKEN || !env.ADMIN_HASH || !env.SESSION_SECRET || !env.REPO) return reply(h, { error: 'misconfigured' }, 500);

    if (url.pathname === '/login' && req.method === 'POST') return login(req, env, h);

    if (url.pathname === '/reviews' && req.method === 'POST') return reviewSubmit(req, env, h);      // عام: الزوار
    if (url.pathname === '/reviews/pending' || url.pathname === '/reviews/delete') {                 // خاص: لوحة التحكم بس
      const auth = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
      if (!(await sessionOk(env, auth))) return reply(h, { error: 'unauthorized' }, 401);
      if (url.pathname === '/reviews/pending' && req.method === 'GET') return reviewPending(env, h);
      if (url.pathname === '/reviews/delete' && req.method === 'POST') return reviewDelete(req, env, h);
    }

    if (url.pathname.startsWith('/gh/')) {
      const auth = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
      if (!(await sessionOk(env, auth))) return reply(h, { error: 'unauthorized' }, 401);
      const path = url.pathname.slice(3), kind = route(req.method, path, env.REPO);
      if (!kind) return reply(h, { error: 'not_allowed' }, 403);
      let body;
      if (req.method === 'PUT') {
        const raw = await req.text();
        if (raw.length > MAX_BODY) return reply(h, { error: 'too_large' }, 413);
        let j; try { j = JSON.parse(raw); } catch (e) {}
        if (!checkBody(kind, j)) return reply(h, { error: 'bad_content' }, 400);
        body = JSON.stringify({ message: j.message.slice(0, 200), content: j.content, branch: j.branch, ...(j.sha ? { sha: j.sha } : {}) });
      }
      const ref = url.searchParams.get('ref');
      const gh = await fetch('https://api.github.com' + path + (ref && /^[\w./-]{1,100}$/.test(ref) ? '?ref=' + encodeURIComponent(ref) : ''), {
        method: req.method, body,
        headers: { Authorization: 'Bearer ' + env.GH_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'site-admin-worker', 'Content-Type': 'application/json' }
      });
      return new Response(gh.status === 204 ? null : await gh.text(), { status: gh.status, headers: Object.assign({ 'Content-Type': 'application/json' }, h) });
    }
    return reply(h, { error: 'not_found' }, 404);
  }
};
