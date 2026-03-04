alter table if exists public.teams
  add column if not exists join_type text default 'open',
  add column if not exists join_password text;
