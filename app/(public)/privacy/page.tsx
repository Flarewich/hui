import PageShell from "@/components/PageShell";
import { getRequestLocale } from "@/lib/i18nServer";

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";

  return (
    <PageShell
      title={isEn ? "Privacy Policy" : "Политика конфиденциальности"}
      subtitle={isEn ? "How we collect, use and protect your data." : "Как мы собираем, используем и защищаем ваши данные."}
    >
      <section className="card p-4 sm:p-6 space-y-4 text-sm text-white/80">
        <p>
          {isEn
            ? "WinStrike processes account and tournament data to provide platform functionality."
            : "WinStrike обрабатывает данные аккаунта и турниров для обеспечения работы платформы."}
        </p>
        <p>
          {isEn
            ? "We may collect: email, profile name, avatar, role, tournament registrations, team membership, support messages, and technical logs."
            : "Мы можем собирать: email, имя профиля, аватар, роль, регистрации на турниры, участие в командах, сообщения в поддержку и технические логи."}
        </p>
        <p>
          {isEn
            ? "Data is used for authentication, tournament participation, moderation, support, and security."
            : "Данные используются для аутентификации, участия в турнирах, модерации, поддержки и безопасности."}
        </p>
        <p>
          {isEn
            ? "We do not sell personal data. Data can be updated in profile settings and removed on valid request."
            : "Мы не продаем персональные данные. Данные можно обновить в профиле и удалить по корректному запросу."}
        </p>
        <p>
          {isEn
            ? "By using the platform, you agree to this Privacy Policy."
            : "Используя платформу, вы соглашаетесь с этой Политикой конфиденциальности."}
        </p>
      </section>
    </PageShell>
  );
}
