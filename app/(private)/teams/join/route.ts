import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { localeCookieName, resolveLocale } from "@/lib/i18n";
import { createNotification } from "@/lib/notifications";
import { pgMaybeOne, pgOne, pgRows, withPgTransaction } from "@/lib/postgres";
import { assertSameOriginRequest, getSafeRequestUrl } from "@/lib/security";
import { getCurrentSession } from "@/lib/sessionAuth";
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
  return NextResponse.redirect(getSafeRequestUrl(request, `/profile?${query}`), { status: 303 });
}

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch {
    return NextResponse.redirect(getSafeRequestUrl(request, `/profile?error=${encodeURIComponent("Forbidden")}`), { status: 303 });
  }

  const session = await getCurrentSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.redirect(getSafeRequestUrl(request, "/login"), { status: 303 });
  }

  const formData = await request.formData();
  const teamId = String(formData.get("team_id") ?? "").trim();
  const teamPassword = String(formData.get("team_password") ?? "").trim();

  if (!teamId) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team ID is missing", "Не передан ID команды"))}`);
  }

  const team = await pgMaybeOne<{
    id: string;
    mode: string | null;
    join_type: string | null;
    join_password: string | null;
    captain_id: string | null;
    name: string | null;
  }>(
    `
      select id, mode, join_type, join_password, captain_id, name
      from teams
      where id = $1
      limit 1
    `,
    [teamId]
  );

  if (!team) {
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

  const inTeam = await pgMaybeOne<{ user_id: string }>(
    `
      select user_id
      from team_members
      where team_id = $1 and user_id = $2
      limit 1
    `,
    [teamId, user.id]
  );
  if (inTeam?.user_id) {
    return redirectToProfile(request, `ok=${encodeURIComponent(msg(request, "You are already in this team", "Вы уже в этой команде"))}`);
  }

  const myMemberships = await pgRows<{ team_id: string }>(
    `
      select team_id
      from team_members
      where user_id = $1
    `,
    [user.id]
  );
  const myTeamIds = myMemberships.map((x) => x.team_id).filter(Boolean);

  const targetTeamRegistration = await pgMaybeOne<{ tournament_id: string }>(
    `
      select tournament_id
      from registrations
      where team_id = $1
      order by created_at asc
      limit 1
    `,
    [teamId]
  );

  const existingTournamentRegistration = targetTeamRegistration?.tournament_id
    ? await pgMaybeOne<{ id: string }>(
        `
          select id
          from registrations
          where tournament_id = $1 and user_id = $2
          limit 1
        `,
        [targetTeamRegistration.tournament_id, user.id]
      )
    : null;

  if (targetTeamRegistration?.tournament_id && myTeamIds.length > 0) {
    const myRegisteredTeams = await pgRows<{ team_id: string | null }>(
      `
        select team_id
        from registrations
        where tournament_id = $1
          and team_id = any($2::uuid[])
      `,
      [targetTeamRegistration.tournament_id, myTeamIds]
    );

    if (myRegisteredTeams.some((row) => String(row.team_id ?? "").length > 0)) {
      return redirectToProfile(
        request,
        `error=${encodeURIComponent(msg(request, "You are already in a team for this tournament", "Вы уже состоите в команде этого турнира"))}`
      );
    }
  }

  const countRow = await pgOne<{ count: string }>(
    `
      select count(*)::text as count
      from team_members
      where team_id = $1
    `,
    [teamId]
  );

  const registration = await pgMaybeOne<{ tournament_id: string; game_slug: string | null; game_name: string | null }>(
    `
      select r.tournament_id, g.slug as game_slug, g.name as game_name
      from registrations r
      left join tournaments t on t.id = r.tournament_id
      left join games g on g.id = t.game_id
      where r.team_id = $1
      order by r.created_at asc
      limit 1
    `,
    [teamId]
  );

  const limit = getTeamSizeLimit(team.mode ?? "squad", registration?.game_slug ?? null, registration?.game_name ?? null);
  if (Number(countRow.count ?? 0) >= limit) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team is full", "Команда уже укомплектована"))}`);
  }

  try {
    await withPgTransaction(async (client) => {
      await client.query(
        `
          insert into team_members (team_id, user_id)
          values ($1, $2)
        `,
        [teamId, user.id]
      );

      if (targetTeamRegistration?.tournament_id && !existingTournamentRegistration?.id) {
        await client.query(
          `
            insert into registrations (tournament_id, user_id, team_id)
            values ($1, $2, $3)
            on conflict (tournament_id, user_id) do nothing
          `,
          [targetTeamRegistration.tournament_id, user.id, teamId]
        );
      }
    });
  } catch {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Failed to join team", "Не удалось вступить в команду"))}`);
  }

  revalidatePath("/profile");
  revalidatePath("/tournaments");
  if (targetTeamRegistration?.tournament_id) {
    revalidatePath(`/tournaments/${targetTeamRegistration.tournament_id}`);
    revalidatePath(`/tournaments/${targetTeamRegistration.tournament_id}/room`);
  }

  if (team.captain_id && team.captain_id !== user.id) {
    await createNotification({
      userId: team.captain_id,
      type: "team_member_joined",
      title: "New team member joined",
      body: team.name ? `Team: ${team.name}` : null,
      href: "/profile#teams",
    });
  }

  await logAuditEvent({
    userId: user.id,
    action: "team.joined",
    ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null,
    metadata: {
      teamId,
      teamName: team.name,
      captainId: team.captain_id,
      tournamentId: targetTeamRegistration?.tournament_id ?? null,
    },
  });

  return redirectToProfile(request, `ok=${encodeURIComponent(msg(request, "You joined the team", "Вы присоединились к команде"))}`);
}
