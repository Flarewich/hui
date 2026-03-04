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

  const { data: team, error: teamError } = await supabaseAdmin
    .from("teams")
    .insert({
      name,
      mode,
      captain_id: user.id,
      join_type: joinType,
      join_password: joinType === "password" ? joinPassword : null,
    })
    .select("id")
    .single();

  if (teamError || !team?.id) {
    return redirectToProfile(request, `error=${encodeURIComponent(teamError?.message || msg(request, "Failed to create team", "Не удалось создать команду"))}`);
  }

  await supabaseAdmin.from("team_members").upsert({ team_id: team.id, user_id: user.id }, { onConflict: "team_id,user_id" });

  revalidatePath("/profile");
  revalidatePath("/tournaments");

  return redirectToProfile(request, `ok=${encodeURIComponent(msg(request, "Team created", "Команда создана"))}`);
}
