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
