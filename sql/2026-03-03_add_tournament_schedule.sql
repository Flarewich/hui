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
