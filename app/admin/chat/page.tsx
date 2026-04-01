import AdminTeamChat from "@/components/AdminTeamChat";
import { requireAdmin } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function AdminChatPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  await requireAdmin();

  return (
    <AdminTeamChat
      locale={locale}
      title={isEn ? "Admin team chat" : "Чат админов"}
      subtitle={isEn ? "Internal real-time communication between admins." : "Внутренняя realtime-переписка между администраторами."}
    />
  );
}
