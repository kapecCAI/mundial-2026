// Serverless function (Vercel) para grupos del prode. Sin dependencias: usa la
// REST API de Upstash/Vercel KV vía fetch. Variables de entorno esperadas:
//   KV_REST_API_URL / KV_REST_API_TOKEN  (o UPSTASH_REDIS_REST_URL / _TOKEN)
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK  = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOK, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  return j.result;
}
function id6() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

module.exports = async (req, res) => {
  if (!URL_ || !TOK) { res.status(500).json({ error: 'DB_NO_CONFIG' }); return; }
  try {
    if (req.method === 'GET') {
      const id = String(req.query.id || '').toUpperCase().slice(0, 6);
      if (!id) { res.status(400).json({ error: 'falta id' }); return; }
      const data = await redis(['GET', 'grupo:' + id]);
      if (!data) { res.status(404).json({ error: 'no_existe' }); return; }
      res.status(200).json(JSON.parse(data)); return;
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
        for (let t = 0; t < 6; t++) { id = id6(); if (!(await redis(['GET', 'grupo:' + id]))) break; }
        const g = { id, name, created: Date.now(), entries: {} };
        if (b.pid) g.entries[String(b.pid).slice(0, 24)] = { name: player, picks, updated: Date.now() };
        await redis(['SET', 'grupo:' + id, JSON.stringify(g)]);
        res.status(200).json({ id }); return;
      }
      if (b.action === 'submit') {
        const id = String(b.id || '').toUpperCase().slice(0, 6);
        if (!b.pid) { res.status(400).json({ error: 'falta_pid' }); return; }
        const data = await redis(['GET', 'grupo:' + id]);
        if (!data) { res.status(404).json({ error: 'no_existe' }); return; }
        const g = JSON.parse(data);
        const pidk = String(b.pid).slice(0, 24);
        if (!g.entries[pidk] && Object.keys(g.entries).length >= 100) { res.status(403).json({ error: 'grupo_lleno' }); return; }
        g.entries[pidk] = { name: player, picks, updated: Date.now() };
        await redis(['SET', 'grupo:' + id, JSON.stringify(g)]);
        res.status(200).json({ ok: true, count: Object.keys(g.entries).length }); return;
      }
      res.status(400).json({ error: 'accion_invalida' }); return;
    }
    res.status(405).json({ error: 'metodo' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
