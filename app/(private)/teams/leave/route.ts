import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { localeCookieName, resolveLocale } from "@/lib/i18n";
import { pgMaybeOne, pgRows, withPgTransaction } from "@/lib/postgres";
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
  const teamId = String(formData.get("team_id") ?? "").trim();

  if (!teamId) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team ID is missing", "Не передан ID команды"))}`);
  }

  const team = await pgMaybeOne<{ id: string; captain_id: string | null }>(
    `
      select id, captain_id
      from teams
      where id = $1
      limit 1
    `,
    [teamId]
  );

  if (!team) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team not found", "Команда не найдена"))}`);
  }

  if (team.captain_id === user.id) {
    return redirectToProfile(
      request,
      `error=${encodeURIComponent(msg(request, "Captain cannot leave the team. Delete team instead", "Капитан не может выйти из команды. Удалите команду"))}`
    );
  }

  const membership = await pgMaybeOne<{ team_id: string }>(
    `
      select team_id
      from team_members
      where team_id = $1 and user_id = $2
      limit 1
    `,
    [teamId, user.id]
  );

  if (!membership?.team_id) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "You are not in this team", "Вас нет в этой команде"))}`);
  }

  try {
    const registrations = await pgRows<{ tournament_id: string | null }>(
      `
        select tournament_id
        from registrations
        where team_id = $1 and user_id = $2
      `,
      [teamId, user.id]
    );

    await withPgTransaction(async (client) => {
      await client.query(
        `
          delete from registrations
          where team_id = $1 and user_id = $2
        `,
        [teamId, user.id]
      );

      const deleted = await client.query(
        `
          delete from team_members
          where team_id = $1 and user_id = $2
          returning user_id
        `,
        [teamId, user.id]
      );

      if (!deleted.rowCount) {
        throw new Error("Membership not found");
      }
    });

    for (const registration of registrations) {
      if (!registration.tournament_id) continue;
      revalidatePath(`/tournaments/${registration.tournament_id}`);
      revalidatePath(`/tournaments/${registration.tournament_id}/room`);
    }
  } catch {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Failed to leave team", "Не удалось выйти из команды"))}`);
  }

  revalidatePath("/profile");
  revalidatePath("/tournaments");
  await logAuditEvent({
    userId: user.id,
    action: "team.left",
    ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null,
    metadata: { teamId },
  });

  return redirectToProfile(request, `ok=${encodeURIComponent(msg(request, "You left the team", "Вы вышли из команды"))}`);
}
