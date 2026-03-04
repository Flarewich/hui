alter table if exists public.tournaments
  add column if not exists room_code text,
  add column if not exists room_password text,
  add column if not exists room_instructions text;
