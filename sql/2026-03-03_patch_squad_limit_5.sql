-- Patch: set squad team size to 5 players
create or replace function public.enforce_team_size()
returns trigger
language plpgsql
as $$
declare
  v_mode text;
  v_count int;
  v_limit int;
begin
  select mode into v_mode from public.teams where id = new.team_id;

  if v_mode is null then
    raise exception 'Team not found';
  end if;

  v_limit := case when v_mode = 'duo' then 2 when v_mode = 'squad' then 5 else 1 end;

  select count(*) into v_count
  from public.team_members
  where team_id = new.team_id;

  if v_count >= v_limit then
    raise exception 'Team is full for mode %', v_mode;
  end if;

  return new;
end;
$$;
