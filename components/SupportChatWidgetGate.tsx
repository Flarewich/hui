import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getRequestLocale } from "@/lib/i18nServer";
import FloatingSupportChat from "./FloatingSupportChat";

export default async function SupportChatWidgetGate() {
  const locale = await getRequestLocale();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, banned_until, restricted_until")
    .eq("id", user.id)
    .maybeSingle<{ is_banned?: boolean | null; banned_until?: string | null; restricted_until?: string | null }>();

  const now = new Date().getTime();
  const isBanned =
    Boolean(profile?.is_banned) ||
    (profile?.banned_until ? new Date(profile.banned_until).getTime() > now : false);
  const isRestricted = profile?.restricted_until ? new Date(profile.restricted_until).getTime() > now : false;

  if (isBanned || isRestricted) return null;

  return <FloatingSupportChat locale={locale} />;
}
