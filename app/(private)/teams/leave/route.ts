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

  const { data: team } = await supabaseAdmin.from("teams").select("id, captain_id").eq("id", teamId).maybeSingle();

  if (!team) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Team not found", "Команда не найдена"))}`);
  }

  if (team.captain_id === user.id) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Captain cannot leave the team. Delete team instead", "Капитан не может выйти из команды. Удалите команду"))}`);
  }

  const { error: delError } = await supabaseAdmin.from("team_members").delete().eq("team_id", teamId).eq("user_id", user.id);

  if (delError) {
    return redirectToProfile(request, `error=${encodeURIComponent(msg(request, "Failed to leave team", "Не удалось выйти из команды"))}`);
  }

  revalidatePath("/profile");
  revalidatePath("/tournaments");

  return redirectToProfile(request, `ok=${encodeURIComponent(msg(request, "You left the team", "Вы вышли из команды"))}`);
}
