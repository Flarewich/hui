-- Bootstrap base schema for local PostgreSQL migration.
-- This file creates the minimal tables and compatibility objects
-- required before later project migrations can be applied.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;

create schema if not exists auth;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select null::uuid;
$$;

create table if not exists public.profiles (
  id uuid primary key,
  username text,
  avatar_url text,
  role text not null default 'user',
  is_banned boolean not null default false,
  banned_until timestamptz null,
  restricted_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon_url text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'upcoming',
  mode text not null default 'solo',
  game_id uuid null references public.games(id) on delete set null,
  start_at timestamptz not null,
  prize_pool numeric(12,2) not null default 0,
  max_teams integer null,
  room_code text null,
  room_password text null,
  room_instructions text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tournaments_start_at on public.tournaments(start_at);
create index if not exists idx_tournaments_game_id on public.tournaments(game_id);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_registrations_tournament_id on public.registrations(tournament_id);
create index if not exists idx_registrations_user_id on public.registrations(user_id);

create table if not exists public.site_pages (
  slug text primary key,
  title text not null,
  content_md text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  href text null,
  tier text null default 'partner',
  logo_url text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sponsors_active on public.sponsors(is_active);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid null references public.support_tickets(id) on delete cascade,
  sender_id uuid null references public.profiles(id) on delete cascade,
  message text null,
  created_at timestamptz not null default now()
);
