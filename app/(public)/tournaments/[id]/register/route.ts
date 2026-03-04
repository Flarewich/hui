import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseRouteClient } from "@/lib/supabaseRoute";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTournamentCapacity } from "@/lib/tournamentLimits";
import { localeCookieName, resolveLocale } from "@/lib/i18n";

function redirectToTournament(request: Request, id: string, query: string) {
  const url = new URL(request.url);
  return NextResponse.redirect(`${url.origin}/tournaments/${id}?${query}`, { status: 303 });
}

function getLocaleFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${localeCookieName}=`));
  return resolveLocale(match?.split("=")[1]);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const locale = getLocaleFromRequest(request);
  const isEn = locale === "en";

  const supabase = await createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = new URL(request.url);
    return NextResponse.redirect(
      `${url.origin}/login?ok=${encodeURIComponent(isEn ? "Sign in to register for tournament" : "Войдите, чтобы зарегистрироваться на турнир")}`,
      { status: 303 }
    );
  }

  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from("tournaments")
    .select("id, status, mode, start_at, games(slug, name)")
    .eq("id", id)
    .maybeSingle();
  if (tournamentError || !tournament) {
    return redirectToTournament(request, id, `error=${encodeURIComponent(isEn ? "Tournament not found" : "Турнир не найден")}`);
  }

  const hasStarted = new Date(String(tournament.start_at)).getTime() <= Date.now();
  if (tournament.status === "finished" || hasStarted) {
    return redirectToTournament(request, id, `error=${encodeURIComponent(isEn ? "Registration is closed" : "Регистрация закрыта")}`);
  }

  const { data: existing } = await supabaseAdmin.from("registrations").select("id").eq("tournament_id", id).eq("user_id", user.id).maybeSingle();
  if (existing?.id) {
    return redirectToTournament(request, id, `ok=${encodeURIComponent(isEn ? "You are already registered" : "Вы уже зарегистрированы")}`);
  }

  const capacity = getTournamentCapacity(
    String(tournament.mode ?? "solo"),
    typeof tournament.games === "object" && tournament.games && "slug" in tournament.games ? String(tournament.games.slug ?? "") : null,
    typeof tournament.games === "object" && tournament.games && "name" in tournament.games ? String(tournament.games.name ?? "") : null
  );
  const { count: registrationCount } = await supabaseAdmin.from("registrations").select("id", { count: "exact", head: true }).eq("tournament_id", id);
  if ((registrationCount ?? 0) >= capacity) {
    return redirectToTournament(request, id, `error=${encodeURIComponent(isEn ? "All slots are taken. Registration is closed." : "Все слоты заняты. Регистрация закрыта.")}`);
  }

  const formData = await request.formData();
  const teamName = String(formData.get("team_name") ?? "").trim();
  const teamAccess = String(formData.get("team_access") ?? "open").trim().toLowerCase();
  const teamPassword = String(formData.get("team_password") ?? "").trim();
  const mode = String(tournament.mode ?? "solo");

  let teamId: string | null = null;
  if (mode === "duo" || mode === "squad") {
    if (teamName.length < 2 || teamName.length > 64) {
      return redirectToTournament(request, id, `error=${encodeURIComponent(isEn ? "Enter team name: 2 to 64 chars" : "Введите название команды: от 2 до 64 символов")}`);
    }
    if (teamAccess !== "open" && teamAccess !== "password") {
      return redirectToTournament(request, id, `error=${encodeURIComponent(isEn ? "Invalid team access type" : "Неверный тип доступа команды")}`);
    }
    if (teamAccess === "password" && (teamPassword.length < 4 || teamPassword.length > 32)) {
      return redirectToTournament(request, id, `error=${encodeURIComponent(isEn ? "Team password: 4 to 32 chars" : "Пароль команды: от 4 до 32 символов")}`);
    }

    const teamInsert = await supabaseAdmin
      .from("teams")
      .insert({ name: teamName, mode, captain_id: user.id, join_type: teamAccess, join_password: teamAccess === "password" ? teamPassword : null })
      .select("id")
      .single();

    if (teamInsert.error || !teamInsert.data?.id) {
      const message = teamInsert.error?.message.includes("teams")
        ? isEn ? "Teams table is not configured in DB" : "Таблица команд не настроена в базе"
        : isEn ? "Failed to create team for registration" : "Не удалось создать команду для регистрации";
      return redirectToTournament(request, id, `error=${encodeURIComponent(message)}`);
    }

    teamId = teamInsert.data.id;
    await supabaseAdmin.from("team_members").upsert({ team_id: teamId, user_id: user.id }, { onConflict: "team_id,user_id" });
  }

  const insertPayload: { tournament_id: string; user_id: string; team_id?: string } = { tournament_id: id, user_id: user.id };
  if (teamId) insertPayload.team_id = teamId;
  const { error: insertError } = await supabaseAdmin.from("registrations").insert(insertPayload);

  if (insertError) {
    const message = insertError.message.includes("duplicate")
      ? isEn ? "You are already registered" : "Вы уже зарегистрированы"
      : insertError.message.includes("Tournament is full")
      ? isEn ? "All slots are taken. Registration is closed." : "Все слоты заняты. Регистрация закрыта."
      : isEn ? "Failed to complete registration" : "Не удалось завершить регистрацию";
    return redirectToTournament(request, id, `error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/tournaments/${id}`);
  revalidatePath(`/tournaments/${id}/room`);
  revalidatePath("/profile");

  return redirectToTournament(request, id, `ok=${encodeURIComponent(isEn ? "Registration successful" : "Вы успешно зарегистрировались")}`);
}
