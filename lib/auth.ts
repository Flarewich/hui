import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  is_banned?: boolean | null;
  banned_until?: string | null;
  restricted_until?: string | null;
};

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, role, is_banned, banned_until, restricted_until")
    .eq("id", user.id)
    .single<Profile>();

  const now = Date.now();
  const isBanned =
    Boolean(profile?.is_banned) ||
    (profile?.banned_until ? new Date(profile.banned_until).getTime() > now : false);
  const isRestricted = profile?.restricted_until ? new Date(profile.restricted_until).getTime() > now : false;

  if (isBanned) redirect("/login?error=Ваш аккаунт заблокирован");
  if (isRestricted) redirect("/login?error=Доступ временно ограничен");

  return { supabase, user, profile: profile ?? null };
}

export async function requireAdmin() {
  const { supabase, user, profile } = await requireUser();
  const metadataRole =
    user.app_metadata && typeof user.app_metadata === "object" && user.app_metadata.role === "admin"
      ? "admin"
      : null;

  if (profile?.role !== "admin" && metadataRole !== "admin") redirect("/");
  return { supabase, user, profile };
}
