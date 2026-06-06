// Serverless (Vercel) — vista de admin: login por contraseña + métricas.
// Variables de entorno necesarias:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (las mismas de /api/groups)
//   ADMIN_PASSWORD                            (la contraseña de admin)
const URL_ = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const PASS = process.env.ADMIN_PASSWORD || '';

function H() { return { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }; }
async function count(table, qs) {
  const r = await fetch(URL_ + '/rest/v1/' + table + (qs || '?select=*'), { headers: Object.assign({}, H(), { Prefer: 'count=exact', Range: '0-0' }) });
  const cr = r.headers.get('content-range') || '';
  const m = cr.match(/\/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}
async function sql(rows) { return rows; } // placeholder

module.exports = async (req, res) => {
  if (!URL_ || !KEY) { res.status(500).json({ error: 'DB_NO_CONFIG' }); return; }
  if (!PASS) { res.status(500).json({ error: 'ADMIN_PASSWORD_NO_CONFIG' }); return; }
  try {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b || '{}'); } catch (e) { b = {}; } }
    b = b || {};
    if (req.method !== 'POST') { res.status(405).json({ error: 'metodo' }); return; }
    if (!b.pass || b.pass !== PASS) { res.status(401).json({ error: 'pass_invalida' }); return; }

    // ---- métricas ----
    const hoy = new Date().toISOString().slice(0, 10);
    const sieteDias = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

    const [grupos, prodes, visitasTot, visitasHoy, visitas7d] = await Promise.all([
      count('grupos'),
      count('prodes'),
      count('visitas'),
      count('visitas', '?dia=eq.' + hoy + '&select=*'),
      count('visitas', '?dia=gte.' + sieteDias + '&select=*'),
    ]);

    // Últimos 10 grupos
    let recientes = [];
    try {
      const r = await fetch(URL_ + '/rest/v1/grupos?select=id,data&order=id.desc&limit=20', { headers: H() });
      const all = await r.json();
      recientes = (all || []).map(g => ({
        id: g.id,
        name: (g.data && g.data.name) || '(sin nombre)',
        entries: (g.data && g.data.entries) ? Object.keys(g.data.entries).length : 0,
        created: (g.data && g.data.created) || null
      })).sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 10);
    } catch (e) {}

    // Serie por día de los últimos 7 días
    let serie = [];
    try {
      const r = await fetch(URL_ + '/rest/v1/visitas?dia=gte.' + sieteDias + '&select=dia', { headers: H() });
      const a = await r.json();
      const m = {};
      (a || []).forEach(x => { m[x.dia] = (m[x.dia] || 0) + 1; });
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        serie.push({ dia: d, n: m[d] || 0 });
      }
    } catch (e) {}

    res.status(200).json({
      ok: true,
      stats: { grupos: grupos, prodes: prodes, visitasTotales: visitasTot, visitasHoy: visitasHoy, visitas7d: visitas7d },
      recientes: recientes,
      serie: serie
    });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
