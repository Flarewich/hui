import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { localeCookieName, resolveLocale } from "@/lib/i18n";
import { pgMaybeOne, withPgTransaction } from "@/lib/postgres";
import { assertSameOriginRequest, getSafeRequestUrl } from "@/lib/security";
import { getCurrentSession } from "@/lib/sessionAuth";

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
  const name = String(formData.get("name") ?? "").trim();
  const mode = String(formData.get("mode") ?? "").trim();
  const joinTypeRaw = String(formData.get("join_type") ?? "open").trim().toLowerCase();
  const joinPassword = String(formData.get("join_password") ?? "").trim();

  if (name.length < 2 || name.length > 64) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team name must be 2-64 characters", "Название команды: от 2 до 64 символов"))}`);
  }

  if (mode !== "duo" && mode !== "squad") {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Invalid team mode", "Неверный режим команды"))}`);
  }

  const joinType = joinTypeRaw === "password" ? "password" : "open";
  if (joinType === "password" && (joinPassword.length < 4 || joinPassword.length > 32)) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team password must be 4-32 characters", "Пароль команды: от 4 до 32 символов"))}`);
  }

  const duplicateTeam = await pgMaybeOne<{ id: string }>(
    `
      select id
      from teams
      where lower(btrim(name)) = lower(btrim($1))
      limit 1
    `,
    [name]
  );

  if (duplicateTeam?.id) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team name is already taken", "Название команды уже занято"))}`);
  }

  try {
    await withPgTransaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `
          insert into teams (name, mode, captain_id, join_type, join_password)
          values ($1, $2, $3, $4, $5)
          returning id
        `,
        [name, mode, user.id, joinType, joinType === "password" ? joinPassword : null]
      );

      const teamId = created.rows[0]?.id;
      if (!teamId) {
        throw new Error("Failed to create team");
      }

      await client.query(
        `
          insert into team_members (team_id, user_id)
          values ($1, $2)
          on conflict (team_id, user_id) do nothing
        `,
        [teamId, user.id]
      );
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "";
    const message =
      messageText.includes("uq_teams_name_ci") || messageText.toLowerCase().includes("team name")
        ? msg(request, "Team name is already taken", "Название команды уже занято")
        : msg(request, "Failed to create team", "Не удалось создать команду");
    return redirectToProfile(request, `error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/tournaments");
  await logAuditEvent({
    userId: user.id,
    action: "team.created",
    ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null,
    metadata: { name, mode, joinType },
  });

  return redirectToProfile(request, `ok=${encodeURIComponent(msg(request, "Team created", "Команда создана"))}`);
}
