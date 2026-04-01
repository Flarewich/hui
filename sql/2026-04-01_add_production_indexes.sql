-- 2026-04-01: production-oriented indexes for common query paths

create index if not exists idx_registrations_tournament_id
  on public.registrations (tournament_id);

create index if not exists idx_registrations_user_id
  on public.registrations (user_id);

create index if not exists idx_registrations_team_id_created_at
  on public.registrations (team_id, created_at desc);

create index if not exists idx_team_members_team_id_user_id
  on public.team_members (team_id, user_id);

create index if not exists idx_team_members_user_id_team_id
  on public.team_members (user_id, team_id);

create index if not exists idx_support_threads_user_id_updated_at
  on public.support_threads (user_id, updated_at desc);

create index if not exists idx_support_messages_thread_id_created_at
  on public.support_messages (thread_id, created_at asc);

create index if not exists idx_support_messages_sender_id_created_at
  on public.support_messages (sender_id, created_at desc);

create index if not exists idx_user_accounts_email_ci
  on public.user_accounts ((lower(email)));

create index if not exists idx_prize_claims_winner_user_id
  on public.prize_claims (winner_user_id);

create index if not exists idx_prize_claims_tournament_id_status
  on public.prize_claims (tournament_id, status);

create index if not exists idx_sponsor_requests_user_id_created_at
  on public.sponsor_requests (user_id, created_at desc);
