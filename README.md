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
   - `ADMIN_PASSWORD` = contraseña para `/admin.html`
   - `AUTH_SECRET` = texto secreto largo para firmar sesiones de usuario
4. **Redeploy** (Deployments → ⋯ → Redeploy).

Listo: ya se pueden crear grupos y compartir el link `…/?grupo=CODIGO`.

> Si la DB no está configurada, el resto del sitio funciona igual; solo los grupos avisan que no se pudo crear.

### Activar login sin mail

En Supabase → **SQL Editor**, ejecutá:

```sql
create table if not exists usuarios (
  id text primary key,
  username text not null,
  username_norm text generated always as (lower(trim(username))) stored,
  password_hash text not null,
  created bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated bigint not null default (extract(epoch from now()) * 1000)::bigint,
  last_login bigint
);

create unique index if not exists usuarios_username_norm_key
on usuarios (username_norm);

create index if not exists usuarios_updated_idx
on usuarios (updated desc);

create table if not exists prodes_usuario (
  user_id text primary key references usuarios(id) on delete cascade,
  picks jsonb not null default '{}'::jsonb,
  updated bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists prodes_usuario_updated_idx
on prodes_usuario (updated desc);

alter table usuarios enable row level security;
alter table prodes_usuario enable row level security;
```

Los usuarios se registran con usuario + contraseña, sin email. Si olvidan la contraseña, el admin la resetea desde `/admin.html`.

Las banderas se cargan desde `flagcdn.com` (requiere conexión).
