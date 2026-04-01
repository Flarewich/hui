import { NextResponse } from "next/server";
import { getTeamSizeLimit } from "@/lib/tournamentLimits";
import { pgMaybeOne, pgOne } from "@/lib/postgres";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const [team, teamCountRow, registration] = await Promise.all([
    pgMaybeOne<{ id: string; mode: string | null }>(
      `
        select id, mode
        from teams
        where id = $1
        limit 1
      `,
      [id]
    ),
    pgOne<{ count: string }>(
      `
        select count(*)::text as count
        from team_members
        where team_id = $1
      `,
      [id]
    ),
    pgMaybeOne<{ tournament_id: string }>(
      `
        select tournament_id
        from registrations
        where team_id = $1
        order by created_at asc
        limit 1
      `,
      [id]
    ),
  ]);

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  let gameSlug: string | null = null;
  let gameName: string | null = null;

  if (registration?.tournament_id) {
    const tournament = await pgMaybeOne<{ slug: string | null; name: string | null }>(
      `
        select g.slug, g.name
        from tournaments t
        left join games g on g.id = t.game_id
        where t.id = $1
        limit 1
      `,
      [registration.tournament_id]
    );

    gameSlug = tournament?.slug ?? null;
    gameName = tournament?.name ?? null;
  }

  const limit = getTeamSizeLimit(team.mode ?? "squad", gameSlug, gameName);
  return NextResponse.json({
    team_id: id,
    mode: team.mode,
    count: Number(teamCountRow.count ?? 0),
    limit,
  });
}
