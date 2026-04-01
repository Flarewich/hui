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
      subtitle={isEn ? "Describe your issue and we will reply in this chat." : "Опишите проблему, и мы ответим в этом чате."}
      emptyText={isEn ? "This thread is empty. Send the first message." : "Диалог пока пуст. Напишите первое сообщение."}
    />
  );
}
