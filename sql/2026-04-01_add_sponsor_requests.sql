create table if not exists public.sponsor_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  brand_name text null,
  contact_email text not null,
  contact_details text not null,
  offer_summary text not null,
  status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sponsor_requests_status_created_at
  on public.sponsor_requests(status, created_at desc);

create index if not exists idx_sponsor_requests_user_id
  on public.sponsor_requests(user_id);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'sponsor_requests'
      and constraint_name = 'sponsor_requests_status_check'
  ) then
    alter table public.sponsor_requests
      add constraint sponsor_requests_status_check
      check (status in ('pending_review', 'reviewed', 'approved', 'rejected'));
  end if;
end $$;
