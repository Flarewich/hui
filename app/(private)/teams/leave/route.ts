import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { localeCookieName, resolveLocale } from "@/lib/i18n";
import { pgMaybeOne, withPgTransaction } from "@/lib/postgres";
import { assertSameOriginRequest } from "@/lib/security";
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
  const url = new URL(request.url);
  return NextResponse.redirect(`${url.origin}/profile?${query}`, { status: 303 });
}

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch {
    const url = new URL(request.url);
    return NextResponse.redirect(`${url.origin}/profile?error=${encodeURIComponent("Forbidden")}`, { status: 303 });
  }

  const session = await getCurrentSession();
  const user = session?.user;

  if (!user) {
    const url = new URL(request.url);
    return NextResponse.redirect(`${url.origin}/login`, { status: 303 });
  }

  const formData = await request.formData();
  const teamId = String(formData.get("team_id") ?? "").trim();

  if (!teamId) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team ID is missing", "Не передан ID команды"))}`);
  }

  const team = await pgMaybeOne<{ id: string; captain_id: string }>(
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
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Captain cannot leave the team. Delete team instead", "Капитан не может выйти из команды. Удалите команду"))}`);
  }

  try {
    const registration = await pgMaybeOne<{ tournament_id: string | null }>(
      `
        select tournament_id
        from registrations
        where team_id = $1 and user_id = $2
        limit 1
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

      await client.query(
        `
          delete from team_members
          where team_id = $1 and user_id = $2
        `,
        [teamId, user.id]
      );
    });

    if (registration?.tournament_id) {
      revalidatePath(`/tournaments/${registration.tournament_id}`);
      revalidatePath(`/tournaments/${registration.tournament_id}/room`);
    }
  } catch {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Failed to leave team", "Не удалось выйти из команды"))}`);
  }

  revalidatePath("/profile");
  revalidatePath("/tournaments");

  return redirectToProfile(request, `ok=${encodeURIComponent(msg(request, "You left the team", "Вы вышли из команды"))}`);
}
