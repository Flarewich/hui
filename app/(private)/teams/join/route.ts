import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseRouteClient } from "@/lib/supabaseRoute";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { localeCookieName, resolveLocale } from "@/lib/i18n";
import { getTeamSizeLimit } from "@/lib/tournamentLimits";

function getLocale(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  const match = raw.match(new RegExp(`${localeCookieName}=([^;]+)`));
  return resolveLocale(match?.[1]);
}

function msg(request: Request, en: string, ru: string) {
  return getLocale(request) === "en" ? en : ru;
}

function redirectToProfile(request: Request, query: string) {
  const url = new URL(request.url);
  return NextResponse.redirect(`${url.origin}/profile?${query}`, { status: 303 });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = new URL(request.url);
    return NextResponse.redirect(`${url.origin}/login`, { status: 303 });
  }

  const formData = await request.formData();
  const teamId = String(formData.get("team_id") ?? "").trim();
  const teamPassword = String(formData.get("team_password") ?? "").trim();

  if (!teamId) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team ID is missing", "Не передан ID команды"))}`);
  }

  const { data: team, error: teamError } = await supabaseAdmin.from("teams").select("id, mode, join_type, join_password").eq("id", teamId).maybeSingle();

  if (teamError || !team) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team not found", "Команда не найдена"))}`);
  }

  if (team.join_type === "password") {
    if (!teamPassword) {
      return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Enter team password", "Введите пароль команды"))}`);
    }
    if (String(team.join_password ?? "") !== teamPassword) {
      return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Invalid team password", "Неверный пароль команды"))}`);
    }
  }

  const { data: inTeam } = await supabaseAdmin.from("team_members").select("id").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();

  if (inTeam?.id) {
    return redirectToProfile(request, `ok=${encodeURIComponent(msg(request, "You are already in this team", "Вы уже в этой команде"))}`);
  }

  const { data: myMemberships } = await supabaseAdmin.from("team_members").select("team_id").eq("user_id", user.id).returns<Array<{ team_id: string }>>();
  const myTeamIds = (myMemberships ?? []).map((x) => x.team_id).filter(Boolean);

  // Block only if user is already in another team within the same tournament.
  const { data: targetTeamRegistration } = await supabaseAdmin
    .from("registrations")
    .select("tournament_id")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ tournament_id: string }>();

  if (targetTeamRegistration?.tournament_id && myTeamIds.length > 0) {
    const { data: myRegisteredTeams } = await supabaseAdmin
      .from("registrations")
      .select("team_id")
      .eq("tournament_id", targetTeamRegistration.tournament_id)
      .in("team_id", myTeamIds)
      .returns<Array<{ team_id: string | null }>>();

    if ((myRegisteredTeams ?? []).some((row) => String(row.team_id ?? "").length > 0)) {
      return redirectToProfile(
        request,
        `error=${encodeURIComponent(msg(request, "You are already in a team for this tournament", "Вы уже состоите в команде этого турнира"))}`
      );
    }
  }

  const { count } = await supabaseAdmin.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", teamId);

  const { data: registration } = await supabaseAdmin
    .from("registrations")
    .select("tournament_id")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ tournament_id: string }>();

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
  if ((count ?? 0) >= limit) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team is full", "Команда уже укомплектована"))}`);
  }

  const { error: insertError } = await supabaseAdmin.from("team_members").insert({ team_id: teamId, user_id: user.id });

  if (insertError) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Failed to join team", "Не удалось вступить в команду"))}`);
  }

  revalidatePath("/profile");
  revalidatePath("/tournaments");

  return redirectToProfile(request, `ok=${encodeURIComponent(msg(request, "You joined the team", "Вы присоединились к команде"))}`);
}

