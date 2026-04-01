-- 2026-03-13: Allow manual tournament max teams configured by admin
-- Safe to run multiple times

alter table public.tournaments
  add column if not exists max_teams int;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tournaments_max_teams_check'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_max_teams_check
      check (max_teams is null or max_teams between 1 and 512);
  end if;
end $$;

create or replace function public.enforce_tournament_capacity()
returns trigger
language plpgsql
as $$
declare
  v_mode text;
  v_slug text;
  v_name text;
  v_manual_limit int;
  v_limit int;
  v_count int;
  v_text text;
begin
  -- Lock only tournament row to serialize concurrent registrations.
  perform 1
  from public.tournaments t
  where t.id = new.tournament_id
  for update;

  select t.mode, coalesce(g.slug, ''), coalesce(g.name, ''), t.max_teams
  into v_mode, v_slug, v_name, v_manual_limit
  from public.tournaments t
  left join public.games g on g.id = t.game_id
  where t.id = new.tournament_id;

  if v_mode is null then
    raise exception 'Tournament not found';
  end if;

  if v_manual_limit is not null and v_manual_limit > 0 then
    v_limit := v_manual_limit;
  else
    v_text := lower(trim(v_slug || ' ' || v_name));

    if v_mode = 'solo' then
      v_limit := 100;
    elsif position('cs2' in v_text) > 0
       or position('counter-strike-2' in v_text) > 0
       or position('counter strike 2' in v_text) > 0 then
      v_limit := 128;
    elsif position('dota-2' in v_text) > 0
       or position('dota2' in v_text) > 0
       or position('dota 2' in v_text) > 0 then
      v_limit := 32;
    elsif position('brawl-stars' in v_text) > 0
       or position('brawlstars' in v_text) > 0
       or position('brawl stars' in v_text) > 0 then
      v_limit := 64;
    elsif position('standoff-2' in v_text) > 0
       or position('standoff2' in v_text) > 0 then
      v_limit := 64;
    elsif position('mobile-legends' in v_text) > 0
       or position('mobile legends' in v_text) > 0 then
      v_limit := 64;
    elsif position('pubg-mobile' in v_text) > 0
       or position('pubgm' in v_text) > 0
       or position('pubg mobile' in v_text) > 0 then
      v_limit := 16;
    elsif position('pubg' in v_text) > 0 then
      v_limit := 16;
    elsif position('freefire' in v_text) > 0
       or position('free-fire' in v_text) > 0
       or position('free fire' in v_text) > 0 then
      v_limit := 12;
    elsif v_mode = 'duo' then
      v_limit := 50;
    elsif v_mode = 'squad' then
      -- Default fallback squad limit for other games.
      v_limit := 24;
    else
      v_limit := 100;
    end if;
  end if;

  select count(*) into v_count
  from public.registrations
  where tournament_id = new.tournament_id;

  if v_count >= v_limit then
    raise exception 'Tournament is full for mode %', v_mode;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_tournament_capacity on public.registrations;
create trigger trg_enforce_tournament_capacity
before insert on public.registrations
for each row
execute function public.enforce_tournament_capacity();
