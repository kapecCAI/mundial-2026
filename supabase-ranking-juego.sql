-- Ranking del minijuego de penales (easter egg de la copa 🏆).
-- Ejecutar UNA vez en Supabase → SQL Editor.
create table if not exists ranking_juego (
  user_id  text primary key,
  username text,
  score    int default 0,
  updated  timestamptz default now()
);
