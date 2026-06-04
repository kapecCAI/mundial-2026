// Serverless function (Vercel) para grupos del prode — backend con SUPABASE.
// Sin dependencias: usa la REST API (PostgREST) de Supabase vía fetch.
// Variables de entorno (Vercel → Settings → Environment Variables):
//   SUPABASE_URL                 (ej: https://xxxx.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY    (clave "service_role", secreta)
// Tabla necesaria (Supabase → SQL Editor):
//   create table if not exists grupos (id text primary key, data jsonb);
const URL_ = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

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
function id6() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
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
      const picks = b.picks || {};
      if (JSON.stringify(picks).length > 12000) { res.status(413).json({ error: 'picks_grande' }); return; }
      const player = String(b.player || 'Anónimo').slice(0, 30);

      if (b.action === 'create') {
        const name = String(b.name || 'Grupo').slice(0, 40);
        let id;
        for (let t = 0; t < 6; t++) { id = id6(); if (!(await getGroup(id))) break; }
        const g = { id: id, name: name, created: Date.now(), entries: {} };
        if (b.pid) g.entries[String(b.pid).slice(0, 24)] = { name: player, picks: picks, updated: Date.now() };
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
      res.status(400).json({ error: 'accion_invalida' }); return;
    }
    res.status(405).json({ error: 'metodo' });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
