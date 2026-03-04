-- Enforce registration capacity per tournament mode:
-- solo: 100, duo: 50, squad: 25

create or replace function public.enforce_tournament_capacity()
returns trigger
language plpgsql
as $$
declare
  v_mode text;
  v_limit int;
  v_count int;
begin
  -- Serialize checks for the same tournament to avoid race conditions.
  select mode into v_mode
  from public.tournaments
  where id = new.tournament_id
  for update;

  if v_mode is null then
    raise exception 'Tournament not found';
  end if;

  v_limit := case
    when v_mode = 'solo' then 100
    when v_mode = 'duo' then 50
    when v_mode = 'squad' then 25
    else 100
  end;

  select count(*) into v_count
  from public.registrationsна
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
