import SupportChat from "@/components/SupportChat";
import { requireAdmin } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function AdminSupportPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  await requireAdmin();

  return (
    <SupportChat
      locale={locale}
      title={isEn ? "Support (admin)" : "Поддержка (админ)"}
      subtitle={isEn ? "User conversations" : "Диалоги с пользователями"}
      emptyText={isEn ? "No messages in this thread yet." : "Для выбранного диалога пока нет сообщений."}
    />
  );
}
