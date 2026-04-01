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
