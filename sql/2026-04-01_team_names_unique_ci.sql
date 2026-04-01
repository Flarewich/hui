-- 2026-04-01: prevent duplicate team names regardless of case/whitespace

create unique index if not exists uq_teams_name_ci
  on public.teams ((lower(btrim(name))));
