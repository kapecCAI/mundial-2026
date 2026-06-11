// Serverless function (Vercel) para grupos + métricas. Backend: SUPABASE (PostgREST).
// Sin dependencias: usa fetch.
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   SUPABASE_URL                 (ej: https://xxxx.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY    (clave service_role, secreta)
//
// Tablas necesarias (Supabase → SQL Editor):
//   create table if not exists grupos (id text primary key, data jsonb);
//   create table if not exists visitas  (hash text, dia date, primary key (hash, dia));
//   create table if not exists prodes   (pid text primary key, updated timestamptz default now());
const URL_ = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const SALT = process.env.ADMIN_PASSWORD || 'salt-default-mundial-2026';

function H(extra) {
  return Object.assign({ apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, extra || {});
}
async function getGroup(id) {
  const r = await fetch(URL_ + '/rest/v1/grupos?id=eq.' + encodeURIComponent(id) + '&select=data', { headers: H() });
  if (!r.ok) throw new Error('GET ' + r.status + ' ' + (await r.text()));
  const a = await r.json();
  return (a && a[0]) ? a[0].data : null;
}
async function putGroup(id, data) {
  const r = await fetch(URL_ + '/rest/v1/grupos', {
    method: 'POST',
    headers: H({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ id: id, data: data })
  });
  if (!r.ok) throw new Error('PUT ' + r.status + ' ' + (await r.text()));
}
async function upsertVisit(hash) {
  const dia = new Date().toISOString().slice(0, 10);
  const r = await fetch(URL_ + '/rest/v1/visitas', {
    method: 'POST',
    headers: H({ Prefer: 'resolution=ignore-duplicates,return=minimal' }),
    body: JSON.stringify({ hash: hash, dia: dia })
  });
  if (!r.ok && r.status !== 409) throw new Error('VISIT ' + r.status + ' ' + (await r.text()));
}
async function upsertProde(pid) {
  const r = await fetch(URL_ + '/rest/v1/prodes', {
    method: 'POST',
    headers: H({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ pid: pid, updated: new Date().toISOString() })
  });
  if (!r.ok) throw new Error('PRODE ' + r.status + ' ' + (await r.text()));
}
function id6() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}
function hashIp(ip) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update((ip || '0') + '|' + SALT).digest('hex').slice(0, 32);
}
function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket && req.socket.remoteAddress || '0';
}

module.exports = async (req, res) => {
  if (!URL_ || !KEY) { res.status(500).json({ error: 'DB_NO_CONFIG' }); return; }
  try {
    if (req.method === 'GET') {
      const id = String(req.query.id || '').toUpperCase().slice(0, 6);
      if (!id) { res.status(400).json({ error: 'falta id' }); return; }
      const data = await getGroup(id);
      if (!data) { res.status(404).json({ error: 'no_existe' }); return; }
      res.status(200).json(data); return;
    }
    if (req.method === 'POST') {
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b || '{}'); } catch (e) { b = {}; } }
      b = b || {};

      // ---- TRACK: registra visita (hash de IP) y/o prode guardado ----
      if (b.action === 'track') {
        try { await upsertVisit(hashIp(clientIp(req))); } catch (e) {}
        if (b.pid) { try { await upsertProde(String(b.pid).slice(0, 24)); } catch (e) {} }
        res.status(200).json({ ok: true }); return;
      }

      const picks = b.picks || {};
      if (JSON.stringify(picks).length > 12000) { res.status(413).json({ error: 'picks_grande' }); return; }
      const player = String(b.player || 'Anónimo').slice(0, 30);

      if (b.action === 'create') {
        const name = String(b.name || 'Grupo').slice(0, 40);
        let id;
        for (let t = 0; t < 6; t++) { id = id6(); if (!(await getGroup(id))) break; }
        const ownerPid = b.pid ? String(b.pid).slice(0, 24) : '';
        const g = { id: id, name: name, created: Date.now(), ownerPid: ownerPid, entries: {} };
        if (ownerPid) g.entries[ownerPid] = { name: player, picks: picks, updated: Date.now() };
        await putGroup(id, g);
        res.status(200).json({ id: id }); return;
      }
      if (b.action === 'submit') {
        const id = String(b.id || '').toUpperCase().slice(0, 6);
        if (!b.pid) { res.status(400).json({ error: 'falta_pid' }); return; }
        const g = await getGroup(id);
        if (!g) { res.status(404).json({ error: 'no_existe' }); return; }
        g.entries = g.entries || {};
        const pidk = String(b.pid).slice(0, 24);
        if (!g.entries[pidk] && Object.keys(g.entries).length >= 100) { res.status(403).json({ error: 'grupo_lleno' }); return; }
        g.entries[pidk] = { name: player, picks: picks, updated: Date.now() };
        await putGroup(id, g);
        res.status(200).json({ ok: true, count: Object.keys(g.entries).length }); return;
      }
      if (b.action === 'claim_owner') {
        const id = String(b.id || '').toUpperCase().slice(0, 6);
        const pidk = String(b.pid || '').slice(0, 24);
        if (!pidk) { res.status(400).json({ error: 'falta_pid' }); return; }
        const g = await getGroup(id);
        if (!g) { res.status(404).json({ error: 'no_existe' }); return; }
        g.entries = g.entries || {};
        if (g.ownerPid) { res.status(409).json({ error: 'ya_tiene_dueno' }); return; }
        const entry = g.entries[pidk];
        const entryName = String(entry && entry.name || player || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!entry || entryName.indexOf('joel') === -1) { res.status(403).json({ error: 'solo_joel' }); return; }
        g.ownerPid = pidk;
        await putGroup(id, g);
        res.status(200).json({ ok: true }); return;
      }
      if (b.action === 'rename_member') {
        const id = String(b.id || '').toUpperCase().slice(0, 6);
        const pidk = String(b.pid || '').slice(0, 24);
        if (!pidk) { res.status(400).json({ error: 'falta_pid' }); return; }
        const g = await getGroup(id);
        if (!g) { res.status(404).json({ error: 'no_existe' }); return; }
        g.entries = g.entries || {};
        if (!g.entries[pidk]) { res.status(404).json({ error: 'no_participante' }); return; }
        g.entries[pidk].name = player;
        g.entries[pidk].updated = Date.now();
        await putGroup(id, g);
        res.status(200).json({ ok: true }); return;
      }
      if (b.action === 'delete_member') {
        const id = String(b.id || '').toUpperCase().slice(0, 6);
        const ownerPid = String(b.ownerPid || '').slice(0, 24);
        const targetPid = String(b.targetPid || '').slice(0, 24);
        if (!ownerPid || !targetPid) { res.status(400).json({ error: 'faltan_datos' }); return; }
        const g = await getGroup(id);
        if (!g) { res.status(404).json({ error: 'no_existe' }); return; }
        g.entries = g.entries || {};
        if (!g.ownerPid || g.ownerPid !== ownerPid) { res.status(403).json({ error: 'no_dueno' }); return; }
        if (targetPid === g.ownerPid) { res.status(403).json({ error: 'no_borrar_dueno' }); return; }
        if (!g.entries[targetPid]) { res.status(404).json({ error: 'no_participante' }); return; }
        delete g.entries[targetPid];
        await putGroup(id, g);
        res.status(200).json({ ok: true, count: Object.keys(g.entries).length }); return;
      }
      res.status(400).json({ error: 'accion_invalida' }); return;
    }
    res.status(405).json({ error: 'metodo' });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
