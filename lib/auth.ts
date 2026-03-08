import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveLocale } from "@/lib/i18n";

type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  is_banned?: boolean | null;
  banned_until?: string | null;
  restricted_until?: string | null;
};

function formatUntil(raw: string | null | undefined, locale: "ru" | "en") {
  if (!raw) return null;
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function banMessage(locale: "ru" | "en", until: string | null) {
  if (locale === "en") return until ? `Your account is banned until ${until}.` : "Your account is banned.";
  return until ? `Ваш аккаунт забанен до ${until}.` : "Ваш аккаунт забанен.";
}

function restrictionMessage(locale: "ru" | "en", until: string | null) {
  if (locale === "en") return until ? `Your account is temporarily restricted until ${until}.` : "Your account is temporarily restricted.";
  return until ? `Ваш аккаунт временно ограничен до ${until}.` : "Ваш аккаунт временно ограничен.";
}

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

  if (isBanned || isRestricted) {
    const cookieStore = await cookies();
    const locale = resolveLocale(cookieStore.get("lang")?.value);
    const until = isBanned ? formatUntil(profile?.banned_until, locale) : formatUntil(profile?.restricted_until, locale);
    const message = isBanned ? banMessage(locale, until) : restrictionMessage(locale, until);
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

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
