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
-- 2026-03-03: Teams + team registrations support
-- Safe to run multiple times

create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 64),
  mode text not null check (mode in ('duo','squad')),
  captain_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index if not exists idx_teams_captain_id on public.teams(captain_id);
create index if not exists idx_team_members_team_id on public.team_members(team_id);
create index if not exists idx_team_members_user_id on public.team_members(user_id);

-- Add team_id to registrations (for duo/squad)
alter table public.registrations
  add column if not exists team_id uuid references public.teams(id) on delete set null;

create index if not exists idx_registrations_team_id on public.registrations(team_id);

-- Ensure one registration per user per tournament
create unique index if not exists uq_registrations_tournament_user
  on public.registrations(tournament_id, user_id);

-- Team size limiter by mode
create or replace function public.enforce_team_size()
returns trigger
language plpgsql
as $$
declare
  v_mode text;
  v_count int;
  v_limit int;
begin
  select mode into v_mode from public.teams where id = new.team_id;

  if v_mode is null then
    raise exception 'Team not found';
  end if;

  v_limit := case when v_mode = 'duo' then 2 when v_mode = 'squad' then 5 else 1 end;

  select count(*) into v_count
  from public.team_members
  where team_id = new.team_id;

  if v_count >= v_limit then
    raise exception 'Team is full for mode %', v_mode;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_team_size on public.team_members;
create trigger trg_enforce_team_size
before insert on public.team_members
for each row
execute function public.enforce_team_size();

-- Registration validator by tournament mode
create or replace function public.validate_registration_team()
returns trigger
language plpgsql
as $$
declare
  v_tournament_mode text;
  v_team_mode text;
  v_team_captain uuid;
begin
  select mode into v_tournament_mode
  from public.tournaments
  where id = new.tournament_id;

  if v_tournament_mode is null then
    raise exception 'Tournament not found';
  end if;

  if v_tournament_mode in ('duo','squad') then
    if new.team_id is null then
      raise exception 'team_id is required for % tournaments', v_tournament_mode;
    end if;

    select mode, captain_id into v_team_mode, v_team_captain
    from public.teams
    where id = new.team_id;

    if v_team_mode is null then
      raise exception 'Selected team not found';
    end if;

    if v_team_mode <> v_tournament_mode then
      raise exception 'Team mode (%) does not match tournament mode (%)', v_team_mode, v_tournament_mode;
    end if;

    if v_team_captain <> new.user_id then
      raise exception 'Only team captain can register this team';
    end if;
  else
    -- solo tournament
    new.team_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_registration_team on public.registrations;
create trigger trg_validate_registration_team
before insert or update on public.registrations
for each row
execute function public.validate_registration_team();

-- RLS (minimal practical policies)
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- teams policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='teams' AND policyname='teams_select_auth'
  ) THEN
    CREATE POLICY teams_select_auth ON public.teams FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='teams' AND policyname='teams_insert_captain'
  ) THEN
    CREATE POLICY teams_insert_captain ON public.teams FOR INSERT TO authenticated WITH CHECK (captain_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='teams' AND policyname='teams_update_captain'
  ) THEN
    CREATE POLICY teams_update_captain ON public.teams FOR UPDATE TO authenticated USING (captain_id = auth.uid()) WITH CHECK (captain_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='teams' AND policyname='teams_delete_captain'
  ) THEN
    CREATE POLICY teams_delete_captain ON public.teams FOR DELETE TO authenticated USING (captain_id = auth.uid());
  END IF;
END $$;

-- team_members policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_members' AND policyname='team_members_select_auth'
  ) THEN
    CREATE POLICY team_members_select_auth ON public.team_members FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_members' AND policyname='team_members_insert_captain'
  ) THEN
    CREATE POLICY team_members_insert_captain
    ON public.team_members
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_members.team_id AND t.captain_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_members' AND policyname='team_members_delete_captain'
  ) THEN
    CREATE POLICY team_members_delete_captain
    ON public.team_members
    FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_members.team_id AND t.captain_id = auth.uid()
      )
    );
  END IF;
END $$;
alter table if exists public.teams
  add column if not exists join_type text default 'open',
  add column if not exists join_password text;
-- Enforce registration capacity per tournament mode:
-- solo: 100, duo: 50, squad: 25

create or replace function public.enforce_tournament_capacity()
returns trigger
language plpgsql
as $$
declare
  v_mode text;
  v_limit int;
  v_count int;
begin
  -- Serialize checks for the same tournament to avoid race conditions.
  select mode into v_mode
  from public.tournaments
  where id = new.tournament_id
  for update;

  if v_mode is null then
    raise exception 'Tournament not found';
  end if;

  v_limit := case
    when v_mode = 'solo' then 100
    when v_mode = 'duo' then 50
    when v_mode = 'squad' then 25
    else 100
  end;

  select count(*) into v_count
  from public.registrations
  where tournament_id = new.tournament_id;

  if v_count >= v_limit then
    raise exception 'Tournament is full for mode %', v_mode;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_tournament_capacity on public.registrations;
create trigger trg_enforce_tournament_capacity
before insert on public.registrations
for each row
execute function public.enforce_tournament_capacity();

alter table if exists public.tournaments
  add column if not exists room_code text,
  add column if not exists room_password text,
  add column if not exists room_instructions text;
create table if not exists public.tournament_schedule (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  stage text not null default 'group',
  match_title text not null,
  start_at timestamptz not null,
  end_at timestamptz null,
  stream_url text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tournament_schedule_start_at_idx on public.tournament_schedule(start_at);
create index if not exists tournament_schedule_tournament_id_idx on public.tournament_schedule(tournament_id);

alter table public.tournament_schedule enable row level security;

drop policy if exists "schedule_select_public" on public.tournament_schedule;
create policy "schedule_select_public"
on public.tournament_schedule
for select
to anon, authenticated
using (true);

drop policy if exists "schedule_insert_admin" on public.tournament_schedule;
create policy "schedule_insert_admin"
on public.tournament_schedule
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "schedule_update_admin" on public.tournament_schedule;
create policy "schedule_update_admin"
on public.tournament_schedule
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "schedule_delete_admin" on public.tournament_schedule;
create policy "schedule_delete_admin"
on public.tournament_schedule
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
-- Patch: set squad team size to 5 players
create or replace function public.enforce_team_size()
returns trigger
language plpgsql
as $$
declare
  v_mode text;
  v_count int;
  v_limit int;
begin
  select mode into v_mode from public.teams where id = new.team_id;

  if v_mode is null then
    raise exception 'Team not found';
  end if;

  v_limit := case when v_mode = 'duo' then 2 when v_mode = 'squad' then 5 else 1 end;

  select count(*) into v_count
  from public.team_members
  where team_id = new.team_id;

  if v_count >= v_limit then
    raise exception 'Team is full for mode %', v_mode;
  end if;

  return new;
end;
$$;
alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_until timestamptz null,
  add column if not exists restricted_until timestamptz null;

create index if not exists idx_profiles_is_banned on public.profiles (is_banned);
create index if not exists idx_profiles_restricted_until on public.profiles (restricted_until);
-- 2026-03-08: Support chat (user <-> admin)
-- Safe to run multiple times

create extension if not exists pgcrypto;

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table if exists public.support_threads
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists status text default 'open',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.support_messages
  add column if not exists thread_id uuid references public.support_threads(id) on delete cascade,
  add column if not exists sender_id uuid references public.profiles(id) on delete cascade,
  add column if not exists body text,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_threads'
      and column_name = 'status'
  ) then
    alter table public.support_threads
      drop constraint if exists support_threads_status_check;
    alter table public.support_threads
      add constraint support_threads_status_check check (status in ('open', 'closed'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_messages'
      and column_name = 'body'
  ) then
    alter table public.support_messages
      drop constraint if exists support_messages_body_check;
    alter table public.support_messages
      add constraint support_messages_body_check check (char_length(body) between 1 and 2000);
  end if;
end $$;

create index if not exists idx_support_threads_user_id on public.support_threads(user_id);
create index if not exists idx_support_threads_updated_at on public.support_threads(updated_at desc);
create index if not exists idx_support_messages_thread_id_created_at on public.support_messages(thread_id, created_at);
create index if not exists idx_support_messages_sender_id on public.support_messages(sender_id);

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role = 'admin'
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated;

create or replace function public.touch_support_thread_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_support_thread_updated_at on public.support_threads;
create trigger trg_touch_support_thread_updated_at
before update on public.support_threads
for each row
execute function public.touch_support_thread_updated_at();

create or replace function public.bump_support_thread_on_message()
returns trigger
language plpgsql
as $$
begin
  update public.support_threads
  set updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_support_thread_on_message on public.support_messages;
create trigger trg_bump_support_thread_on_message
after insert on public.support_messages
for each row
execute function public.bump_support_thread_on_message();

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'support_threads' and policyname = 'support_threads_select_own_or_admin'
  ) then
    create policy support_threads_select_own_or_admin
      on public.support_threads
      for select
      to authenticated
      using (user_id = auth.uid() or public.is_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'support_threads' and policyname = 'support_threads_insert_own_or_admin'
  ) then
    create policy support_threads_insert_own_or_admin
      on public.support_threads
      for insert
      to authenticated
      with check (user_id = auth.uid() or public.is_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'support_threads' and policyname = 'support_threads_update_own_or_admin'
  ) then
    create policy support_threads_update_own_or_admin
      on public.support_threads
      for update
      to authenticated
      using (user_id = auth.uid() or public.is_admin(auth.uid()))
      with check (user_id = auth.uid() or public.is_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'support_messages' and policyname = 'support_messages_select_thread_owner_or_admin'
  ) then
    create policy support_messages_select_thread_owner_or_admin
      on public.support_messages
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.support_threads t
          where t.id = thread_id
            and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'support_messages' and policyname = 'support_messages_insert_owner_or_admin'
  ) then
    create policy support_messages_insert_owner_or_admin
      on public.support_messages
      for insert
      to authenticated
      with check (
        sender_id = auth.uid()
        and exists (
          select 1
          from public.support_threads t
          where t.id = thread_id
            and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
        )
      );
  end if;
end $$;
-- 2026-03-08: Fix tournament capacity trigger with game-aware limits
-- Safe to run multiple times

create or replace function public.enforce_tournament_capacity()
returns trigger
language plpgsql
as $$
declare
  v_mode text;
  v_slug text;
  v_name text;
  v_limit int;
  v_count int;
  v_text text;
begin
  -- Lock only tournament row to serialize concurrent registrations.
  perform 1
  from public.tournaments t
  where t.id = new.tournament_id
  for update;

  select t.mode, coalesce(g.slug, ''), coalesce(g.name, '')
  into v_mode, v_slug, v_name
  from public.tournaments t
  left join public.games g on g.id = t.game_id
  where t.id = new.tournament_id;

  if v_mode is null then
    raise exception 'Tournament not found';
  end if;

  v_text := lower(trim(v_slug || ' ' || v_name));

  if v_mode = 'solo' then
    v_limit := 100;
  elsif position('cs2' in v_text) > 0
     or position('counter-strike-2' in v_text) > 0
     or position('counter strike 2' in v_text) > 0 then
    v_limit := 128;
  elsif position('dota-2' in v_text) > 0
     or position('dota2' in v_text) > 0
     or position('dota 2' in v_text) > 0 then
    v_limit := 32;
  elsif position('brawl-stars' in v_text) > 0
     or position('brawlstars' in v_text) > 0
     or position('brawl stars' in v_text) > 0 then
    v_limit := 64;
  elsif position('standoff-2' in v_text) > 0
     or position('standoff2' in v_text) > 0 then
    v_limit := 64;
  elsif position('mobile-legends' in v_text) > 0
     or position('mobile legends' in v_text) > 0 then
    v_limit := 64;
  elsif position('pubg-mobile' in v_text) > 0
     or position('pubgm' in v_text) > 0
     or position('pubg mobile' in v_text) > 0 then
    v_limit := 16;
  elsif position('pubg' in v_text) > 0 then
    v_limit := 16;
  elsif position('freefire' in v_text) > 0
     or position('free-fire' in v_text) > 0
     or position('free fire' in v_text) > 0 then
    v_limit := 12;
  elsif v_mode = 'duo' then
    v_limit := 50;
  elsif v_mode = 'squad' then
    -- Default fallback squad limit for other games.
    v_limit := 24;
  else
    v_limit := 100;
  end if;

  select count(*) into v_count
  from public.registrations
  where tournament_id = new.tournament_id;

  if v_count >= v_limit then
    raise exception 'Tournament is full for mode %', v_mode;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_tournament_capacity on public.registrations;
create trigger trg_enforce_tournament_capacity
before insert on public.registrations
for each row
execute function public.enforce_tournament_capacity();
-- 2026-03-08: Compatibility fix for legacy support schema
-- Run this if support_messages.ticket_id NOT NULL blocks new chat flow.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_messages'
      and column_name = 'ticket_id'
  ) then
    alter table public.support_messages
      alter column ticket_id drop not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_messages'
      and column_name = 'message'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'support_messages'
      and column_name = 'body'
  ) then
    update public.support_messages
    set body = message
    where body is null and message is not null;
  end if;
end $$;
-- 2026-03-13: Stage 1 prize flow
-- winner -> tournament finished -> prize claim -> winner sends payment details -> admin marks paid
-- Safe to run multiple times

create extension if not exists pgcrypto;

create table if not exists public.prize_claims (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  winner_user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'pending_details' check (status in ('pending_details', 'details_submitted', 'paid', 'cancelled')),
  payment_details text,
  details_submitted_at timestamptz,
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id)
);

create index if not exists idx_prize_claims_winner on public.prize_claims(winner_user_id);
create index if not exists idx_prize_claims_status on public.prize_claims(status);

create or replace function public.set_prize_claims_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_prize_claims_updated_at on public.prize_claims;
create trigger trg_prize_claims_updated_at
before update on public.prize_claims
for each row
execute function public.set_prize_claims_updated_at();
-- 2026-03-13: Allow manual tournament max teams configured by admin
-- Safe to run multiple times

alter table public.tournaments
  add column if not exists max_teams int;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_max_teams_check'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_max_teams_check
      check (max_teams is null or max_teams between 1 and 512);
  end if;
end $$;

create or replace function public.enforce_tournament_capacity()
returns trigger
language plpgsql
as $$
declare
  v_mode text;
  v_slug text;
  v_name text;
  v_manual_limit int;
  v_limit int;
  v_count int;
  v_text text;
begin
  -- Lock only tournament row to serialize concurrent registrations.
  perform 1
  from public.tournaments t
  where t.id = new.tournament_id
  for update;

  select t.mode, coalesce(g.slug, ''), coalesce(g.name, ''), t.max_teams
  into v_mode, v_slug, v_name, v_manual_limit
  from public.tournaments t
  left join public.games g on g.id = t.game_id
  where t.id = new.tournament_id;

  if v_mode is null then
    raise exception 'Tournament not found';
  end if;

  if v_manual_limit is not null and v_manual_limit > 0 then
    v_limit := v_manual_limit;
  else
    v_text := lower(trim(v_slug || ' ' || v_name));

    if v_mode = 'solo' then
      v_limit := 100;
    elsif position('cs2' in v_text) > 0
       or position('counter-strike-2' in v_text) > 0
       or position('counter strike 2' in v_text) > 0 then
      v_limit := 128;
    elsif position('dota-2' in v_text) > 0
       or position('dota2' in v_text) > 0
       or position('dota 2' in v_text) > 0 then
      v_limit := 32;
    elsif position('brawl-stars' in v_text) > 0
       or position('brawlstars' in v_text) > 0
       or position('brawl stars' in v_text) > 0 then
      v_limit := 64;
    elsif position('standoff-2' in v_text) > 0
       or position('standoff2' in v_text) > 0 then
      v_limit := 64;
    elsif position('mobile-legends' in v_text) > 0
       or position('mobile legends' in v_text) > 0 then
      v_limit := 64;
    elsif position('pubg-mobile' in v_text) > 0
       or position('pubgm' in v_text) > 0
       or position('pubg mobile' in v_text) > 0 then
      v_limit := 16;
    elsif position('pubg' in v_text) > 0 then
      v_limit := 16;
    elsif position('freefire' in v_text) > 0
       or position('free-fire' in v_text) > 0
       or position('free fire' in v_text) > 0 then
      v_limit := 12;
    elsif v_mode = 'duo' then
      v_limit := 50;
    elsif v_mode = 'squad' then
      -- Default fallback squad limit for other games.
      v_limit := 24;
    else
      v_limit := 100;
    end if;
  end if;

  select count(*) into v_count
  from public.registrations
  where tournament_id = new.tournament_id;

  if v_count >= v_limit then
    raise exception 'Tournament is full for mode %', v_mode;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_tournament_capacity on public.registrations;
create trigger trg_enforce_tournament_capacity
before insert on public.registrations
for each row
execute function public.enforce_tournament_capacity();
-- 2026-03-13: Stage 1 tournament results + payout workflow
-- Safe to run multiple times

create extension if not exists pgcrypto;

create table if not exists public.prize_claims (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  winner_user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'awaiting_details',
  payment_details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.tournament_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  place int not null check (place between 1 and 3),
  team_id uuid references public.teams(id) on delete set null,
  captain_user_id uuid not null references public.profiles(id) on delete cascade,
  prize_amount numeric(12,2) not null default 0 check (prize_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, place)
);

create index if not exists idx_tournament_results_tournament on public.tournament_results(tournament_id);
create index if not exists idx_tournament_results_captain on public.tournament_results(captain_user_id);

-- prize_claims upgrade for 1/2/3 places and manual payout moderation
alter table public.prize_claims
  add column if not exists place int;
alter table public.prize_claims
  add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.prize_claims
  add column if not exists payout_method text;
alter table public.prize_claims
  add column if not exists recipient_name text;
alter table public.prize_claims
  add column if not exists request_comment text;
alter table public.prize_claims
  add column if not exists submitted_at timestamptz;
alter table public.prize_claims
  add column if not exists reviewed_at timestamptz;
alter table public.prize_claims
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.prize_claims
  add column if not exists rejection_reason text;

update public.prize_claims
set place = coalesce(place, 1);

update public.prize_claims
set status = case
  when status = 'pending_details' then 'awaiting_details'
  when status = 'details_submitted' then 'pending_review'
  else status
end
where status in ('pending_details', 'details_submitted');

alter table public.prize_claims
  alter column place set not null;

alter table public.prize_claims
  drop constraint if exists prize_claims_tournament_id_key;
alter table public.prize_claims
  drop constraint if exists prize_claims_status_check;
alter table public.prize_claims
  add constraint prize_claims_status_check
  check (status in ('awaiting_details', 'pending_review', 'approved', 'rejected', 'paid', 'cancelled'));
alter table public.prize_claims
  add constraint prize_claims_place_check check (place between 1 and 3);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prize_claims_tournament_place_key'
      and conrelid = 'public.prize_claims'::regclass
  ) then
    alter table public.prize_claims
      add constraint prize_claims_tournament_place_key unique (tournament_id, place);
  end if;
end $$;

create index if not exists idx_prize_claims_tournament_place on public.prize_claims(tournament_id, place);
create index if not exists idx_prize_claims_team_id on public.prize_claims(team_id);
create index if not exists idx_prize_claims_status_v2 on public.prize_claims(status);

create or replace function public.set_tournament_results_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_tournament_results_updated_at on public.tournament_results;
create trigger trg_tournament_results_updated_at
before update on public.tournament_results
for each row
execute function public.set_tournament_results_updated_at();

create or replace function public.set_prize_claims_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_prize_claims_updated_at on public.prize_claims;
create trigger trg_prize_claims_updated_at
before update on public.prize_claims
for each row
execute function public.set_prize_claims_updated_at();
