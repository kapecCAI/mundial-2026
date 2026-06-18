// Serverless (Vercel) — ranking del minijuego de penales.
// Solo cuentas logueadas pueden guardar puntaje (se verifica el token de /api/auth).
// Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUTH_SECRET (o ADMIN_PASSWORD).
// Tabla (Supabase → SQL Editor):
//   create table if not exists ranking_juego (user_id text primary key, username text, score int default 0, updated timestamptz default now());
const crypto = require('crypto');
const URL_ = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const TOKEN_SECRET = process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || 'auth-secret-mundial-2026';

function H(extra) {
  return Object.assign({ apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, extra || {});
}
// Mismo esquema de token que api/auth.js (payload.firma, HMAC-SHA256).
function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(parts[0]).digest('base64url');
  try { if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(parts[1]))) return null; } catch (e) { return null; }
  try { return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch (e) { return null; }
}
async function topScores(limit) {
  if (!URL_ || !KEY) return { scores: [], setupRequired: true };
  const r = await fetch(URL_ + '/rest/v1/ranking_juego?select=username,score,updated&order=score.desc,updated.asc&limit=' + (limit || 20), { headers: H() });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 404 || t.includes('ranking_juego') || t.includes('42P01')) return { scores: [], setupRequired: true };
    throw new Error('RANK_LIST ' + r.status + ' ' + t);
  }
  return { scores: (await r.json()) || [], setupRequired: false };
}
async function currentScore(userId) {
  const r = await fetch(URL_ + '/rest/v1/ranking_juego?user_id=eq.' + encodeURIComponent(userId) + '&select=score', { headers: H() });
  if (!r.ok) return null;
  const a = await r.json();
  return (a && a[0]) ? a[0] : null;
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      res.status(200).json(Object.assign({ ok: true }, await topScores(20)));
      return;
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'metodo' }); return; }
    if (!URL_ || !KEY) { res.status(500).json({ error: 'DB_NO_CONFIG' }); return; }
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b || '{}'); } catch (e) { b = {}; } }
    b = b || {};

    if (b.action === 'submit') {
      const t = verifyToken(b.token);
      if (!t || !t.id) { res.status(401).json({ error: 'token_invalido' }); return; }
      let score = Math.floor(Number(b.score));
      if (!Number.isFinite(score) || score < 0) { res.status(400).json({ error: 'score_invalido' }); return; }
      if (score > 100000) score = 100000;
      const username = String(t.username || 'Anónimo').slice(0, 24);
      const prev = await currentScore(t.id);
      const best = prev ? Math.max(prev.score || 0, score) : score;
      if (!prev || best > (prev.score || 0)) {
        const r = await fetch(URL_ + '/rest/v1/ranking_juego', {
          method: 'POST',
          headers: H({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify({ user_id: t.id, username: username, score: best, updated: new Date().toISOString() })
        });
        if (!r.ok) throw new Error('RANK_UPSERT ' + r.status + ' ' + (await r.text()));
      }
      const top = await topScores(20);
      res.status(200).json({ ok: true, best: best, improved: !prev || best > (prev.score || 0), scores: top.scores });
      return;
    }
    res.status(400).json({ error: 'accion_invalida' });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
