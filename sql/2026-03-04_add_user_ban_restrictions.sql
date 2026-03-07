alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_until timestamptz null,
  add column if not exists restricted_until timestamptz null;

create index if not exists idx_profiles_is_banned on public.profiles (is_banned);
create index if not exists idx_profiles_restricted_until on public.profiles (restricted_until);
