-- 2026-04-01: allow team members to hold their own registration row
-- Required so joining an already-registered team automatically enrolls
-- the new member into the same duo/squad tournament.

create or replace function public.validate_registration_team()
returns trigger
language plpgsql
as $$
declare
  v_tournament_mode text;
  v_team_mode text;
begin
  select mode into v_tournament_mode
  from public.tournaments
  where id = new.tournament_id;

  if v_tournament_mode is null then
    raise exception 'Tournament not found';
  end if;

  if v_tournament_mode in ('duo','squad') then
    if new.team_id is null then
      raise exception 'team_id is required for % tournaments', v_tournament_mode;
    end if;

    select mode into v_team_mode
    from public.teams
    where id = new.team_id;

    if v_team_mode is null then
      raise exception 'Selected team not found';
    end if;

    if v_team_mode <> v_tournament_mode then
      raise exception 'Team mode (%) does not match tournament mode (%)', v_team_mode, v_tournament_mode;
    end if;

    if not exists (
      select 1
      from public.team_members
      where team_id = new.team_id and user_id = new.user_id
    ) then
      raise exception 'User must be a member of selected team';
    end if;
  else
    new.team_id := null;
  end if;

  return new;
end;
$$;
