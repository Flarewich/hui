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
