create table if not exists public.resultados_manual (
  match_key text primary key,
  date_event date not null,
  home_team text not null,
  away_team text not null,
  group_name text default '',
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  status text not null default 'FT',
  updated timestamptz not null default now()
);

create index if not exists resultados_manual_date_event_idx
  on public.resultados_manual (date_event desc);

alter table public.resultados_manual enable row level security;

drop policy if exists "resultados_manual_service_role_all" on public.resultados_manual;
create policy "resultados_manual_service_role_all"
  on public.resultados_manual
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
