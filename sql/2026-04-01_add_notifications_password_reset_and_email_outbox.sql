create table if not exists public.app_notifications (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  href text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_app_notifications_user_created_at
  on public.app_notifications (user_id, created_at desc);

create index if not exists idx_app_notifications_user_is_read
  on public.app_notifications (user_id, is_read, created_at desc);

create table if not exists public.email_outbox (
  id uuid primary key,
  user_id uuid references public.profiles(id) on delete set null,
  to_email text not null,
  subject text not null,
  text_body text not null,
  html_body text,
  kind text,
  meta jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'queued',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_email_outbox_created_at
  on public.email_outbox (created_at desc);

create index if not exists idx_email_outbox_user_id_created_at
  on public.email_outbox (user_id, created_at desc);

create table if not exists public.password_reset_tokens (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_user_id_created_at
  on public.password_reset_tokens (user_id, created_at desc);
