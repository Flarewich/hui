import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { localeCookieName, resolveLocale } from "@/lib/i18n";
import { createNotification } from "@/lib/notifications";
import { pgMaybeOne, withPgTransaction } from "@/lib/postgres";
import { assertSameOriginRequest } from "@/lib/security";
import { getCurrentSession } from "@/lib/sessionAuth";

function redirectToTournament(request: Request, id: string, query: string) {
  const url = new URL(request.url);
  return NextResponse.redirect(`${url.origin}/tournaments/${id}?${query}`, { status: 303 });
}

function redirectToProfile(request: Request, query: string) {
  const url = new URL(request.url);
  return NextResponse.redirect(`${url.origin}/profile?${query}`, { status: 303 });
}

function getLocaleFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${localeCookieName}=`));
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
    return NextResponse.redirect(`${url.origin}/login`, { status: 303 });
  }

  const formData = await request.formData();
  const returnTo = String(formData.get("return_to") ?? "").trim();
  const toProfile = returnTo === "profile";

  const registration = await pgMaybeOne<{
    team_id: string | null;
    captain_id: string | null;
    members_count: string | null;
  }>(
    `
      select
        r.team_id,
        t.captain_id,
        (
          select count(*)::text
          from team_members tm
          where tm.team_id = r.team_id
        ) as members_count
      from registrations r
      left join teams t on t.id = r.team_id
      where r.tournament_id = $1 and r.user_id = $2
      limit 1
    `,
    [id, user.id]
  );

  const isCaptain = Boolean(registration?.team_id) && registration?.captain_id === user.id;
  const membersCount = Number(registration?.members_count ?? 0);
  const shouldDeleteSoloCaptainTeam = isCaptain && membersCount <= 1 && Boolean(registration?.team_id);
  const shouldLeaveTeam = Boolean(registration?.team_id) && !isCaptain;

  try {
    await withPgTransaction(async (client) => {
      if (shouldDeleteSoloCaptainTeam && registration?.team_id) {
        await client.query(
          `
            delete from registrations
            where team_id = $1
          `,
          [registration.team_id]
        );

        await client.query(
          `
            delete from teams
            where id = $1
          `,
          [registration.team_id]
        );
        return;
      }

      await client.query(
        `
          delete from registrations
          where tournament_id = $1 and user_id = $2
        `,
        [id, user.id]
      );

      if (shouldLeaveTeam && registration?.team_id) {
        await client.query(
          `
            delete from team_members
            where team_id = $1 and user_id = $2
          `,
          [registration.team_id, user.id]
        );
      }
    });
  } catch {
    const errorMsg = encodeURIComponent(isEn ? "Failed to cancel registration" : "Не удалось отменить регистрацию");
    return toProfile
      ? redirectToProfile(request, `error=${errorMsg}`)
      : redirectToTournament(request, id, `error=${errorMsg}`);
  }

  revalidatePath(`/tournaments/${id}`);
  revalidatePath(`/tournaments/${id}/room`);
  revalidatePath("/profile");
  revalidatePath("/tournaments");

  await createNotification({
    userId: user.id,
    type: "tournament_unregistered",
    title: isEn ? "Tournament registration cancelled" : "Регистрация на турнир отменена",
    body: shouldDeleteSoloCaptainTeam
      ? isEn
        ? "Your registration was cancelled and your solo team was deleted."
        : "Регистрация отменена, одиночная команда удалена."
      : shouldLeaveTeam
        ? isEn
          ? "Registration cancelled and you left the team."
          : "Регистрация отменена, вы покинули команду."
        : isEn
          ? "Your registration was cancelled."
          : "Ваша регистрация отменена.",
    href: toProfile ? "/profile" : `/tournaments/${id}`,
  });

  const okMsg = encodeURIComponent(
    shouldDeleteSoloCaptainTeam
      ? isEn
        ? "Registration cancelled. Your team was deleted."
        : "Регистрация отменена. Ваша команда была удалена."
      : shouldLeaveTeam
        ? isEn
          ? "Registration cancelled. You also left the team."
          : "Регистрация отменена. Вы также покинули команду."
        : isEn
          ? "Registration cancelled"
          : "Регистрация отменена"
  );

  return toProfile
    ? redirectToProfile(request, `ok=${okMsg}`)
    : redirectToTournament(request, id, `ok=${okMsg}`);
}
