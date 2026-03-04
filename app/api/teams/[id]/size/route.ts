import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTeamSizeLimit } from "@/lib/tournamentLimits";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const [{ data: team }, { count }, { data: registration }] = await Promise.all([
    supabaseAdmin
      .from("teams")
      .select("id, mode")
      .eq("id", id)
      .maybeSingle<{ id: string; mode: string | null }>(),
    supabaseAdmin
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", id),
    supabaseAdmin
      .from("registrations")
      .select("tournament_id")
      .eq("team_id", id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ tournament_id: string }>(),
  ]);

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  let gameSlug: string | null = null;
  let gameName: string | null = null;

  if (registration?.tournament_id) {
    const { data: tournament } = await supabaseAdmin
      .from("tournaments")
      .select("games(slug, name)")
      .eq("id", registration.tournament_id)
      .maybeSingle<{ games: { slug?: string | null; name?: string | null } | null }>();

    gameSlug = tournament?.games?.slug ?? null;
    gameName = tournament?.games?.name ?? null;
  }

  const limit = getTeamSizeLimit(team.mode ?? "squad", gameSlug, gameName);
  return NextResponse.json({
    team_id: id,
    mode: team.mode,
    count: count ?? 0,
    limit,
  });
}
