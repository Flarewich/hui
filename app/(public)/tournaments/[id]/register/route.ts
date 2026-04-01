import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";
import { getGameTournamentSettings, getTournamentCapacity } from "@/lib/tournamentLimits";
import { localeCookieName, resolveLocale } from "@/lib/i18n";
import { pgMaybeOne, pgOne, withPgTransaction } from "@/lib/postgres";
import { assertSameOriginRequest } from "@/lib/security";
import { getCurrentSession } from "@/lib/sessionAuth";

function redirectToTournament(request: Request, id: string, query: string) {
  const url = new URL(request.url);
  return NextResponse.redirect(`${url.origin}/tournaments/${id}?${query}`, { status: 303 });
}

function getLocaleFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${localeCookieName}=`));
  return resolveLocale(match?.split("=")[1]);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOriginRequest(request);
  } catch {
    const { id } = await context.params;
    return redirectToTournament(request, id, `error=${encodeURIComponent("Forbidden")}`);
  }

  const { id } = await context.params;
  const locale = getLocaleFromRequest(request);
  const isEn = locale === "en";

  const session = await getCurrentSession();
  const user = session?.user;

  if (!user) {
    const url = new URL(request.url);
    return NextResponse.redirect(
      `${url.origin}/login?ok=${encodeURIComponent(
        isEn ? "Sign in to register for tournament" : "Войдите, чтобы зарегистрироваться на турнир"
      )}`,
      { status: 303 }
    );
  }

  const tournament = await pgMaybeOne<{
    id: string;
    status: string;
    mode: string | null;
    start_at: string;
    max_teams: number | null;
    game_slug: string | null;
    game_name: string | null;
  }>(
    `
      select
        t.id,
        t.status,
        t.mode,
        t.start_at,
        t.max_teams,
        g.slug as game_slug,
        g.name as game_name
      from tournaments t
      left join games g on g.id = t.game_id
      where t.id = $1
      limit 1
    `,
    [id]
  );

  if (!tournament) {
    return redirectToTournament(request, id, `error=${encodeURIComponent(isEn ? "Tournament not found" : "Турнир не найден")}`);
  }

  const hasStarted = new Date(String(tournament.start_at)).getTime() <= Date.now();
  if (tournament.status === "finished" || hasStarted) {
    return redirectToTournament(request, id, `error=${encodeURIComponent(isEn ? "Registration is closed" : "Регистрация закрыта")}`);
  }

  const settings = getGameTournamentSettings(tournament.game_slug, tournament.game_name);
  const teamGame = settings.team_size > 1;
  const tournamentMode = String(tournament.mode ?? "solo");

  if (teamGame && tournamentMode === "solo") {
    return redirectToTournament(
      request,
      id,
      `error=${encodeURIComponent(
        isEn
          ? "Registration is temporarily unavailable for this tournament format."
          : "Турнир настроен некорректно: для этой игры нужна командная регистрация. Попросите админа переключить режим на squad/duo."
      )}`
    );
  }

  const existing = await pgMaybeOne<{ id: string }>(
    `
      select id
      from registrations
      where tournament_id = $1 and user_id = $2
      limit 1
    `,
    [id, user.id]
  );

  if (existing?.id) {
    return redirectToTournament(request, id, `ok=${encodeURIComponent(isEn ? "You are already registered" : "Вы уже зарегистрированы")}`);
  }

  const capacity = getTournamentCapacity(
    tournamentMode,
    tournament.game_slug,
    tournament.game_name,
    typeof tournament.max_teams === "number" ? tournament.max_teams : null
  );

  const registrationCountRow = await pgOne<{ count: string }>(
    `
      select count(distinct coalesce(team_id, user_id))::text as count
      from registrations
      where tournament_id = $1
    `,
    [id]
  );

  if (Number(registrationCountRow.count ?? 0) >= capacity) {
    return redirectToTournament(
      request,
      id,
      `error=${encodeURIComponent(
        isEn ? "All slots are taken. Registration is closed." : "Все слоты заняты. Регистрация закрыта."
      )}`
    );
  }

  const formData = await request.formData();
  const teamName = String(formData.get("team_name") ?? "").trim();
  const teamAccess = String(formData.get("team_access") ?? "open").trim().toLowerCase();
  const teamPassword = String(formData.get("team_password") ?? "").trim();
  const mode = tournamentMode;

  if ((mode === "duo" || mode === "squad") && (teamName.length < 2 || teamName.length > 64)) {
    return redirectToTournament(
      request,
      id,
      `error=${encodeURIComponent(
        isEn ? "Enter team name: 2 to 64 chars" : "Введите название команды: от 2 до 64 символов"
      )}`
    );
  }

  if ((mode === "duo" || mode === "squad") && teamAccess !== "open" && teamAccess !== "password") {
    return redirectToTournament(
      request,
      id,
      `error=${encodeURIComponent(isEn ? "Invalid team access type" : "Неверный тип доступа команды")}`
    );
  }

  if ((mode === "duo" || mode === "squad") && teamAccess === "password" && (teamPassword.length < 4 || teamPassword.length > 32)) {
    return redirectToTournament(
      request,
      id,
      `error=${encodeURIComponent(
        isEn ? "Team password: 4 to 32 chars" : "Пароль команды: от 4 до 32 символов"
      )}`
    );
  }

  if (mode === "duo" || mode === "squad") {
    const duplicateTeam = await pgMaybeOne<{ id: string }>(
      `
        select id
        from teams
        where lower(btrim(name)) = lower(btrim($1))
        limit 1
      `,
      [teamName]
    );

    if (duplicateTeam?.id) {
      return redirectToTournament(
        request,
        id,
        `error=${encodeURIComponent(isEn ? "Team name is already taken" : "Название команды уже занято")}`
      );
    }
  }

  try {
    await withPgTransaction(async (client) => {
      let teamId: string | null = null;

      if (mode === "duo" || mode === "squad") {
        const teamInsert = await client.query<{ id: string }>(
          `
            insert into teams (name, mode, captain_id, join_type, join_password)
            values ($1, $2, $3, $4, $5)
            returning id
          `,
          [teamName, mode, user.id, teamAccess, teamAccess === "password" ? teamPassword : null]
        );

        teamId = teamInsert.rows[0]?.id ?? null;
        if (!teamId) {
          throw new Error("Failed to create team for registration");
        }

        await client.query(
          `
            insert into team_members (team_id, user_id)
            values ($1, $2)
            on conflict (team_id, user_id) do nothing
          `,
          [teamId, user.id]
        );
      }

      await client.query(
        `
          insert into registrations (tournament_id, user_id, team_id)
          values ($1, $2, $3)
        `,
        [id, user.id, teamId]
      );
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "";
    const message =
      messageText.includes("uq_teams_name_ci") || messageText.toLowerCase().includes("team name")
        ? isEn
          ? "Team name is already taken"
          : "Название команды уже занято"
        : messageText.includes("duplicate")
          ? isEn
            ? "You are already registered"
            : "Вы уже зарегистрированы"
          : isEn
            ? "Failed to complete registration"
            : "Не удалось завершить регистрацию";

    return redirectToTournament(request, id, `error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/tournaments/${id}`);
  revalidatePath(`/tournaments/${id}/room`);
  revalidatePath("/profile");

  await createNotification({
    userId: user.id,
    type: "tournament_registered",
    title: isEn ? "Tournament registration completed" : "Регистрация на турнир завершена",
    body: isEn
      ? `You have been registered for ${tournament.id}.`
      : `Вы зарегистрированы на турнир ${tournament.id}.`,
    href: `/tournaments/${id}`,
  });

  return redirectToTournament(
    request,
    id,
    `ok=${encodeURIComponent(isEn ? "Registration successful" : "Вы успешно зарегистрировались")}`
  );
}
