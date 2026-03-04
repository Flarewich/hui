import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  const { data: regs } = await supabaseAdmin
    .from("registrations")
    .select("id, created_at, user_id, team_id")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true })
    .returns<Registration[]>();

  const regRows = regs ?? [];
  if (regRows.length === 0) return [];

  const userIds = [...new Set(regRows.map((r) => r.user_id))];
  const teamIds = [...new Set(regRows.map((r) => r.team_id).filter(Boolean))] as string[];

  const [profilesResult, teamsResult, teamMembersResult] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from("profiles").select("id, username").in("id", userIds).returns<Profile[]>()
      : Promise.resolve({ data: [] as Profile[] }),
    teamIds.length
      ? supabaseAdmin.from("teams").select("id, name").in("id", teamIds).returns<Team[]>()
      : Promise.resolve({ data: [] as Team[] }),
    teamIds.length
      ? supabaseAdmin.from("team_members").select("team_id, user_id").in("team_id", teamIds).returns<TeamMember[]>()
      : Promise.resolve({ data: [] as TeamMember[] }),
  ]);

  const teamMembers = teamMembersResult.data ?? [];
  const teamMemberUserIds = [...new Set(teamMembers.map((m) => m.user_id))];
  const extraProfileIds = teamMemberUserIds.filter((id) => !userIds.includes(id));
  const extraProfilesResult = extraProfileIds.length
    ? await supabaseAdmin.from("profiles").select("id, username").in("id", extraProfileIds).returns<Profile[]>()
    : { data: [] as Profile[] };

  const profileMap = new Map(
    [...(profilesResult.data ?? []), ...(extraProfilesResult.data ?? [])].map((p) => [p.id, p.username ?? "User"])
  );
  const teamMap = new Map((teamsResult.data ?? []).map((t) => [t.id, t.name]));
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
