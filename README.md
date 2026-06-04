# Mundial 2026 — Prode + Simulador + Grupos

Sitio del Mundial 2026 con:
- **🔴 LIVE** — resultados en vivo (API TheSportsDB, sin key).
- **🧩 Armá tu prode** — cargás los resultados de cada grupo con steppers, la tabla y el cuadro de eliminatorias se autocompletan. Se guarda en tu navegador.
- **👥 Grupos** — creás un grupo, compartís el link y juegan el prode entre amigos, con tabla de posiciones que se autopuntúa contra los resultados reales.
- **Comparativa** de 5 análisis (Claude, Codex, Gemini, Kimi, Maldini).

Hecho por [Joel Pacheco](https://web-cv-amber-rho.vercel.app/).

---

## Deploy en Vercel

Es HTML estático (`index.html`) + una función serverless (`api/groups.js`). Importá el repo en Vercel y deploy.

### Activar los GRUPOS (base de datos — 3 pasos, gratis)

Los grupos necesitan una base de datos. Se hace una sola vez:

1. En **Vercel** → entrá a tu proyecto → pestaña **Storage** → **Create Database**.
2. Elegí **Upstash (Redis / KV)** → creala (plan gratis) y **conectala a este proyecto**. Vercel agrega solo las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. **Redeploy** el proyecto (Deployments → ⋯ → Redeploy) para que tome las variables.

Listo: ya se pueden crear grupos y compartir el link `…/?grupo=CODIGO`.

> Si la DB no está configurada, el resto del sitio funciona igual; solo los grupos avisan que no se pudo crear.

Las banderas se cargan desde `flagcdn.com` (requiere conexión).
