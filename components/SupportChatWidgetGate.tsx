import { getRequestLocale } from "@/lib/i18nServer";
import { getCurrentSession } from "@/lib/sessionAuth";
import FloatingSupportChat from "./FloatingSupportChat";

export default async function SupportChatWidgetGate() {
  const locale = await getRequestLocale();
  const session = await getCurrentSession();
  const profile = session?.profile;

  if (!session?.user || !profile) return null;
  if (profile.is_blocked) return null;

  return <FloatingSupportChat locale={locale} />;
}
