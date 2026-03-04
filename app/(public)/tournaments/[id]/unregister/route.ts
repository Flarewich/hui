import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseRouteClient } from "@/lib/supabaseRoute";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { localeCookieName, resolveLocale } from "@/lib/i18n";

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
  const { id } = await context.params;
  const locale = getLocaleFromRequest(request);
  const isEn = locale === "en";

  const supabase = await createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = new URL(request.url);
    return NextResponse.redirect(`${url.origin}/login`, { status: 303 });
  }

  const formData = await request.formData();
  const returnTo = String(formData.get("return_to") ?? "").trim();
  const toProfile = returnTo === "profile";

  const { error } = await supabaseAdmin.from("registrations").delete().eq("tournament_id", id).eq("user_id", user.id);
  const errorMsg = encodeURIComponent(isEn ? "Failed to cancel registration" : "Не удалось отменить регистрацию");
  const okMsg = encodeURIComponent(isEn ? "Registration cancelled" : "Регистрация отменена");

  if (error) {
    return toProfile ? redirectToProfile(request, `error=${errorMsg}`) : redirectToTournament(request, id, `error=${errorMsg}`);
  }

  revalidatePath(`/tournaments/${id}`);
  revalidatePath("/profile");

  return toProfile ? redirectToProfile(request, `ok=${okMsg}`) : redirectToTournament(request, id, `ok=${okMsg}`);
}
