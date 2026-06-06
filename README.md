<!--
⚠️  IMPORTANTE PARA CLAUDE / OTROS LLMs ⚠️
El archivo `index.html` se edita DIRECTO (Joel hace cambios a mano).
NO regenerar desde ningún script Python externo: pisaría los cambios manuales.
Para cualquier modificación al index.html, usar Edit puntual sobre este archivo.
-->

# Mundial 2026 — Prode + Simulador + Grupos

Sitio del Mundial 2026 con:
- **🔴 LIVE** — resultados en vivo (API TheSportsDB, sin key) + todos los partidos de fase de grupos con fecha confirmada.
- **🧩 Armá tu prode** — cargás los resultados de cada grupo con steppers, la tabla y el cuadro de eliminatorias se autocompletan. Se guarda en tu navegador.
- **👥 Grupos** — creás un grupo, compartís el link y juegan el prode entre amigos, con tabla de posiciones que se autopuntúa contra los resultados reales.
- **Comparativa** de 5 análisis (Claude, Codex, Gemini, Kimi, Maldini).

Hecho por [Joel Pacheco](https://www.instagram.com/joelp_____/).

---

## Deploy en Vercel

Es HTML estático (`index.html`) + una función serverless (`api/groups.js`). Importá el repo en Vercel y deploy.

### Activar los GRUPOS (Supabase — una sola vez, gratis)

1. **Crear la tabla.** En Supabase → **SQL Editor** → pegá y ejecutá:
   ```sql
   create table if not exists grupos (id text primary key, data jsonb);
   ```
2. **Copiar credenciales.** Supabase → **Settings → API**: copiá el **Project URL** y la clave **service_role** (secreta).
3. **Pegarlas en Vercel.** Proyecto → **Settings → Environment Variables**, agregá:
   - `SUPABASE_URL` = el Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = la clave service_role
4. **Redeploy** (Deployments → ⋯ → Redeploy).

Listo: ya se pueden crear grupos y compartir el link `…/?grupo=CODIGO`.

> Si la DB no está configurada, el resto del sitio funciona igual; solo los grupos avisan que no se pudo crear.

Las banderas se cargan desde `flagcdn.com` (requiere conexión).
