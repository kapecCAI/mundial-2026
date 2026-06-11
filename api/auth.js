// Serverless (Vercel) — login sin mail + prode por usuario.
// Backend: Supabase PostgREST con service_role.
const crypto = require('crypto');

const URL_ = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const PASS = process.env.ADMIN_PASSWORD || '';
const TOKEN_SECRET = process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || 'auth-secret-mundial-2026';

function H(extra) {
  return Object.assign({ apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, extra || {});
}
function cleanUsername(v) {
  return String(v || '').trim().slice(0, 24);
}
function normUsername(v) {
  return cleanUsername(v).toLowerCase();
}
function id12() {
  return 'u_' + crypto.randomBytes(9).toString('base64url');
}
function nowMs() {
  return Date.now();
}
function hashPassword(pass, salt) {
  salt = salt || crypto.randomBytes(16).toString('base64url');
  const hash = crypto.scryptSync(String(pass || ''), salt, 64).toString('base64url');
  return 'scrypt$' + salt + '$' + hash;
}
function verifyPassword(pass, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const test = hashPassword(pass, parts[1]);
  return crypto.timingSafeEqual(Buffer.from(test), Buffer.from(stored));
}
function signToken(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, username: user.username })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}
function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(parts[0]).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(parts[1]))) return null;
  try { return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch (e) { return null; }
}
async function getUserByUsername(username) {
  const r = await fetch(URL_ + '/rest/v1/usuarios?username_norm=eq.' + encodeURIComponent(normUsername(username)) + '&select=id,username,password_hash', { headers: H() });
  if (!r.ok) throw new Error('USER_GET ' + r.status + ' ' + (await r.text()));
  const a = await r.json();
  return a && a[0] || null;
}
async function getUserById(id) {
  const r = await fetch(URL_ + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(String(id || '')) + '&select=id,username', { headers: H() });
  if (!r.ok) throw new Error('USER_ID ' + r.status + ' ' + (await r.text()));
  const a = await r.json();
  return a && a[0] || null;
}
async function createUser(username, password) {
  const user = { id: id12(), username: cleanUsername(username), password_hash: hashPassword(password), created: nowMs(), updated: nowMs() };
  const r = await fetch(URL_ + '/rest/v1/usuarios', {
    method: 'POST',
    headers: H({ Prefer: 'return=representation' }),
    body: JSON.stringify(user)
  });
  if (!r.ok) throw new Error('USER_CREATE ' + r.status + ' ' + (await r.text()));
  const a = await r.json();
  return a && a[0] || user;
}
async function touchLogin(id) {
  await fetch(URL_ + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: H({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ last_login: nowMs(), updated: nowMs() })
  });
}
async function getPicks(userId) {
  const r = await fetch(URL_ + '/rest/v1/prodes_usuario?user_id=eq.' + encodeURIComponent(userId) + '&select=picks,updated', { headers: H() });
  if (!r.ok) throw new Error('PICKS_GET ' + r.status + ' ' + (await r.text()));
  const a = await r.json();
  return a && a[0] || null;
}
async function savePicks(userId, picks) {
  const r = await fetch(URL_ + '/rest/v1/prodes_usuario', {
    method: 'POST',
    headers: H({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ user_id: userId, picks: picks || {}, updated: nowMs() })
  });
  if (!r.ok) throw new Error('PICKS_SAVE ' + r.status + ' ' + (await r.text()));
}
async function searchUsers(q) {
  q = normUsername(q).replace(/[%_*]/g, '');
  const url = URL_ + '/rest/v1/usuarios?select=id,username,created,updated,last_login&username_norm=ilike.*' + encodeURIComponent(q) + '*&order=updated.desc&limit=20';
  const r = await fetch(url, { headers: H() });
  if (!r.ok) throw new Error('USER_SEARCH ' + r.status + ' ' + (await r.text()));
  return await r.json();
}
async function resetPassword(username, password) {
  const user = await getUserByUsername(username);
  if (!user) return null;
  const r = await fetch(URL_ + '/rest/v1/usuarios?id=eq.' + encodeURIComponent(user.id), {
    method: 'PATCH',
    headers: H({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ password_hash: hashPassword(password), updated: nowMs() })
  });
  if (!r.ok) throw new Error('RESET ' + r.status + ' ' + (await r.text()));
  return { id: user.id, username: user.username };
}
function publicUser(user) {
  return { id: user.id, username: user.username };
}

module.exports = async (req, res) => {
  if (!URL_ || !KEY) { res.status(500).json({ error: 'DB_NO_CONFIG' }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'metodo' }); return; }
  try {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b || '{}'); } catch (e) { b = {}; } }
    b = b || {};

    if (b.action === 'register') {
      const username = cleanUsername(b.username);
      const password = String(b.password || '');
      if (username.length < 3 || password.length < 4) { res.status(400).json({ error: 'datos_invalidos' }); return; }
      if (await getUserByUsername(username)) { res.status(409).json({ error: 'usuario_existe' }); return; }
      const user = await createUser(username, password);
      if (b.picks) await savePicks(user.id, b.picks);
      res.status(200).json({ ok: true, user: publicUser(user), token: signToken(user), picks: b.picks || null }); return;
    }

    if (b.action === 'login') {
      const user = await getUserByUsername(b.username);
      if (!user || !verifyPassword(b.password, user.password_hash)) { res.status(401).json({ error: 'login_invalido' }); return; }
      await touchLogin(user.id);
      const p = await getPicks(user.id);
      res.status(200).json({ ok: true, user: publicUser(user), token: signToken(user), picks: p && p.picks || null }); return;
    }

    if (b.action === 'me' || b.action === 'save_picks') {
      const t = verifyToken(b.token);
      if (!t || !t.id) { res.status(401).json({ error: 'token_invalido' }); return; }
      const user = await getUserById(t.id);
      if (!user) { res.status(401).json({ error: 'usuario_no_existe' }); return; }
      if (b.action === 'save_picks') {
        if (JSON.stringify(b.picks || {}).length > 12000) { res.status(413).json({ error: 'picks_grande' }); return; }
        await savePicks(user.id, b.picks || {});
      }
      const p = await getPicks(user.id);
      res.status(200).json({ ok: true, user: publicUser(user), picks: p && p.picks || null }); return;
    }

    if (b.action === 'admin_search' || b.action === 'admin_reset') {
      if (!PASS || b.pass !== PASS) { res.status(401).json({ error: 'pass_invalida' }); return; }
      if (b.action === 'admin_search') { res.status(200).json({ ok: true, users: await searchUsers(b.q || '') }); return; }
      const password = String(b.newPassword || '');
      if (password.length < 4) { res.status(400).json({ error: 'password_corta' }); return; }
      const user = await resetPassword(b.username, password);
      if (!user) { res.status(404).json({ error: 'usuario_no_existe' }); return; }
      res.status(200).json({ ok: true, user: user }); return;
    }

    res.status(400).json({ error: 'accion_invalida' });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
