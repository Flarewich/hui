-- 2026-04-01: local/dev admin seed
-- Email: admin@local.test
-- Password: Admin123!

do $$
declare
  v_existing_user_id uuid;
  v_target_user_id uuid;
begin
  select user_id
  into v_existing_user_id
  from public.user_accounts
  where lower(email) = lower('admin@local.test')
  limit 1;

  v_target_user_id := coalesce(v_existing_user_id, 'f6a8d8d8-2c59-4a1b-9d92-c327df6e3a01'::uuid);

  insert into public.profiles (id, username, role)
  values (v_target_user_id, 'admin', 'admin')
  on conflict (id) do update
  set username = excluded.username,
      role = 'admin';

  insert into public.user_accounts (user_id, email, password_hash, updated_at)
  values (
    v_target_user_id,
    'admin@local.test',
    '$2b$10$j1fq//L4944IQOTyZ/Fa0.vByLH1exw9/N8rXLTtxpDPuD4wrCXwO',
    now()
  )
  on conflict (user_id) do update
  set email = excluded.email,
      password_hash = excluded.password_hash,
      updated_at = now();

  update public.user_accounts
  set password_hash = '$2b$10$j1fq//L4944IQOTyZ/Fa0.vByLH1exw9/N8rXLTtxpDPuD4wrCXwO',
      updated_at = now()
  where lower(email) = lower('admin@local.test');
end $$;
