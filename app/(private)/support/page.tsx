import SupportChat from "@/components/SupportChat";
import { requireUser } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function SupportPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  await requireUser();

  return (
    <SupportChat
      locale={locale}
      title={isEn ? "Support" : "Поддержка"}
      emptyText={isEn ? "No messages yet." : "Сообщений пока нет."}
    />
  );
}
