// Serverless (Vercel) — resultados manuales del admin.
// Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD.
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const PASS = process.env.ADMIN_PASSWORD || '';

function H(extra) {
  return Object.assign({ apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, extra || {});
}
function clean(s, n) {
  return String(s || '').trim().slice(0, n || 80);
}
function matchKey(home, away) {
  return clean(home, 80).toLowerCase() + '|' + clean(away, 80).toLowerCase();
}
function rowToEvent(r) {
  return {
    dateEvent: r.date_event,
    strHomeTeam: r.home_team,
    strAwayTeam: r.away_team,
    strGroup: r.group_name || '',
    intHomeScore: String(r.home_score),
    intAwayScore: String(r.away_score),
    strStatus: r.status || 'FT',
    fromManual: true
  };
}
async function listManual() {
  if (!URL_ || !KEY) return { events: [], setupRequired: true };
  const r = await fetch(URL_ + '/rest/v1/resultados_manual?select=*&order=date_event.desc,updated.desc', { headers: H() });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 404 || t.includes('resultados_manual') || t.includes('42P01')) return { events: [], setupRequired: true };
    throw new Error('RESULTS_LIST ' + r.status + ' ' + t);
  }
  const rows = await r.json();
  return { events: (rows || []).map(rowToEvent), setupRequired: false };
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const data = await listManual();
      res.status(200).json(Object.assign({ ok: true }, data));
      return;
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'metodo' }); return; }
    if (!URL_ || !KEY) { res.status(500).json({ error: 'DB_NO_CONFIG' }); return; }
    if (!PASS) { res.status(500).json({ error: 'ADMIN_PASSWORD_NO_CONFIG' }); return; }
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b || '{}'); } catch (e) { b = {}; } }
    b = b || {};
    if (!b.pass || b.pass !== PASS) { res.status(401).json({ error: 'pass_invalida' }); return; }

    if (b.action === 'delete') {
      const key = clean(b.matchKey, 180);
      if (!key) { res.status(400).json({ error: 'falta_match_key' }); return; }
      const r = await fetch(URL_ + '/rest/v1/resultados_manual?match_key=eq.' + encodeURIComponent(key), {
        method: 'DELETE',
        headers: H()
      });
      if (!r.ok) throw new Error('RESULTS_DELETE ' + r.status + ' ' + (await r.text()));
      res.status(200).json({ ok: true });
      return;
    }

    const home = clean(b.strHomeTeam || b.homeTeam, 80);
    const away = clean(b.strAwayTeam || b.awayTeam, 80);
    const hs = Number(b.intHomeScore ?? b.homeScore);
    const as = Number(b.intAwayScore ?? b.awayScore);
    const date = clean(b.dateEvent || b.date, 10);
    if (!date || !home || !away || !Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) {
      res.status(400).json({ error: 'datos_invalidos' });
      return;
    }
    const row = {
      match_key: matchKey(home, away),
      date_event: date,
      home_team: home,
      away_team: away,
      group_name: clean(b.strGroup || b.groupName, 40),
      home_score: hs,
      away_score: as,
      status: clean(b.strStatus || b.status || 'FT', 20) || 'FT',
      updated: new Date().toISOString()
    };
    const r = await fetch(URL_ + '/rest/v1/resultados_manual?on_conflict=match_key', {
      method: 'POST',
      headers: H({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(row)
    });
    if (!r.ok) throw new Error('RESULTS_UPSERT ' + r.status + ' ' + (await r.text()));
    const rows = await r.json();
    res.status(200).json({ ok: true, event: rowToEvent((rows || [row])[0]) });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
