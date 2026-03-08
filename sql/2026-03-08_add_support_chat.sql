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
