import { pgRows } from "@/lib/postgres";

export type PublicRegistrationRow = {
  id: string;
  created_at: string;
  user_id: string;
  username: string;
  team_id: string | null;
  team_name: string | null;
  team_members_count: number | null;
  team_other_players: string[];
};

type Registration = {
  id: string;
  created_at: string;
  user_id: string;
  team_id: string | null;
};

type Profile = {
  id: string;
  username: string | null;
};

type Team = {
  id: string;
  name: string;
};

type TeamMember = {
  team_id: string;
  user_id: string;
};

export async function getTournamentRegistrationRows(tournamentId: string): Promise<PublicRegistrationRow[]> {
  const regRows = await pgRows<Registration>(
    `
      select id, created_at, user_id, team_id
      from (
        select distinct on (coalesce(team_id, user_id))
          id,
          created_at,
          user_id,
          team_id
        from registrations
        where tournament_id = $1
        order by coalesce(team_id, user_id), created_at asc
      ) deduped
      order by created_at asc
    `,
    [tournamentId]
  );

  if (regRows.length === 0) return [];

  const userIds = [...new Set(regRows.map((r) => r.user_id))];
  const teamIds = [...new Set(regRows.map((r) => r.team_id).filter(Boolean))] as string[];

  const [profiles, teams, teamMembers] = await Promise.all([
    userIds.length
      ? pgRows<Profile>(
          `
            select id, username
            from profiles
            where id = any($1::uuid[])
          `,
          [userIds]
        )
      : Promise.resolve([] as Profile[]),
    teamIds.length
      ? pgRows<Team>(
          `
            select id, name
            from teams
            where id = any($1::uuid[])
          `,
          [teamIds]
        )
      : Promise.resolve([] as Team[]),
    teamIds.length
      ? pgRows<TeamMember>(
          `
            select team_id, user_id
            from team_members
            where team_id = any($1::uuid[])
          `,
          [teamIds]
        )
      : Promise.resolve([] as TeamMember[]),
  ]);

  const teamMemberUserIds = [...new Set(teamMembers.map((m) => m.user_id))];
  const extraProfileIds = teamMemberUserIds.filter((id) => !userIds.includes(id));
  const extraProfiles = extraProfileIds.length
    ? await pgRows<Profile>(
        `
          select id, username
          from profiles
          where id = any($1::uuid[])
        `,
        [extraProfileIds]
      )
    : [];

  const profileMap = new Map(
    [...profiles, ...extraProfiles].map((p) => [p.id, p.username ?? "User"])
  );
  const teamMap = new Map(teams.map((t) => [t.id, t.name]));
  const teamMembersByTeam = new Map<string, string[]>();

  for (const member of teamMembers) {
    const list = teamMembersByTeam.get(member.team_id) ?? [];
    list.push(member.user_id);
    teamMembersByTeam.set(member.team_id, list);
  }

  return regRows.map((r) => ({
    team_members_count: r.team_id ? (teamMembersByTeam.get(r.team_id)?.length ?? null) : null,
    team_other_players: r.team_id
      ? (teamMembersByTeam.get(r.team_id) ?? [])
          .filter((memberId) => memberId !== r.user_id)
          .map((memberId) => profileMap.get(memberId) ?? "User")
      : [],
    id: r.id,
    created_at: r.created_at,
    user_id: r.user_id,
    username: profileMap.get(r.user_id) ?? "User",
    team_id: r.team_id ?? null,
    team_name: r.team_id ? teamMap.get(r.team_id) ?? null : null,
  }));
}
