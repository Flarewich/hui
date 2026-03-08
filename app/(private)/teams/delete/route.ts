import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseRouteClient } from "@/lib/supabaseRoute";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { localeCookieName, resolveLocale } from "@/lib/i18n";

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

  if (!teamId) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team ID is missing", "Не передан ID команды"))}`);
  }

  const { data: team, error: teamError } = await supabaseAdmin.from("teams").select("id, captain_id").eq("id", teamId).maybeSingle();

  if (teamError || !team) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team not found", "Команда не найдена"))}`);
  }

  if (team.captain_id !== user.id) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "You can delete only your own team", "Можно удалить только свою команду"))}`);
  }

  // Remove linked registrations first to avoid trigger conflicts on team_id nullification.
  const { error: regDeleteError } = await supabaseAdmin.from("registrations").delete().eq("team_id", teamId);

  if (regDeleteError) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Failed to delete team registrations", "Не удалось удалить регистрации команды"))}`);
  }

  const { error: delError } = await supabaseAdmin.from("teams").delete().eq("id", teamId);

  if (delError) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Failed to delete team", "Не удалось удалить команду"))}`);
  }

  revalidatePath("/profile");
  revalidatePath("/tournaments");

  return redirectToProfile(request, `ok=${encodeURIComponent(msg(request, "Team deleted", "Команда удалена"))}`);
}
