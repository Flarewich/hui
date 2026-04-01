import Link from "next/link";
import { redirect } from "next/navigation";
import { getRequestLocale } from "@/lib/i18nServer";
import { createPasswordReset, getValidPasswordResetToken, resetPasswordWithToken } from "@/lib/passwordReset";
import { assertSameOriginServerAction, consumeRateLimit, getServerActionIp, isValidEmail, sanitizeTextInput } from "@/lib/security";

function isRedirectException(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeDigest = (error as { digest?: unknown }).digest;
  return typeof maybeDigest === "string" && maybeDigest.startsWith("NEXT_REDIRECT");
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; ok?: string; error?: string }>;
}) {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const sp = await searchParams;
  const token = sanitizeTextInput(sp.token, { maxLength: 256 });
  const tokenInfo = token ? await getValidPasswordResetToken(token) : null;

  async function requestReset(formData: FormData) {
    "use server";

    const locale = await getRequestLocale();
    const isEn = locale === "en";
    try {
      await assertSameOriginServerAction();
      const email = sanitizeTextInput(formData.get("email"), { maxLength: 160 }).toLowerCase();
      const ip = await getServerActionIp();

      if (!email || !isValidEmail(email)) {
        redirect(`/reset-password?error=${encodeURIComponent(isEn ? "Invalid email address." : "Некорректный email.")}`);
      }

      const ipRate = await consumeRateLimit({
        action: "password-reset:request:ip",
        key: ip,
        limit: 5,
        windowSeconds: 60 * 60,
      });
      if (!ipRate.allowed) {
        redirect(`/reset-password?error=${encodeURIComponent(isEn ? "Too many reset requests. Try again later." : "Слишком много запросов на сброс пароля. Попробуйте позже.")}`);
      }

      await createPasswordReset(email, locale);
      redirect(
        `/reset-password?ok=${encodeURIComponent(
          isEn
            ? "If the account exists, reset instructions were sent to email."
            : "Если аккаунт существует, инструкция по сбросу отправлена на email."
        )}`
      );
    } catch (error) {
      if (isRedirectException(error)) throw error;
      redirect(`/reset-password?error=${encodeURIComponent(isEn ? "Failed to request password reset." : "Не удалось запросить сброс пароля.")}`);
    }
  }

  async function applyReset(formData: FormData) {
    "use server";

    const locale = await getRequestLocale();
    const isEn = locale === "en";
    try {
      await assertSameOriginServerAction();
      const token = sanitizeTextInput(formData.get("token"), { maxLength: 256 });
      const password = String(formData.get("password") ?? "").trim();
      const ip = await getServerActionIp();

      const ipRate = await consumeRateLimit({
        action: "password-reset:complete:ip",
        key: ip,
        limit: 10,
        windowSeconds: 60 * 60,
      });
      if (!ipRate.allowed) {
        redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(isEn ? "Too many reset attempts. Try again later." : "Слишком много попыток сброса. Попробуйте позже.")}`);
      }

      if (!token || password.length < 6) {
        redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(isEn ? "Password must be at least 6 characters." : "Пароль должен быть не короче 6 символов.")}`);
      }

      const result = await resetPasswordWithToken(token, password);
      if (!result.ok) {
        redirect(`/reset-password?error=${encodeURIComponent(isEn ? "Reset link is invalid or expired." : "Ссылка для сброса недействительна или истекла.")}`);
      }

      redirect(`/login?tab=signin&ok=${encodeURIComponent(isEn ? "Password updated. Now sign in." : "Пароль обновлен. Теперь войдите в аккаунт.")}`);
    } catch (error) {
      if (isRedirectException(error)) throw error;
      redirect(`/reset-password?error=${encodeURIComponent(isEn ? "Failed to reset password." : "Не удалось сбросить пароль.")}`);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6">
        <h1 className="text-2xl font-bold title-glow">{isEn ? "Reset password" : "Сброс пароля"}</h1>
        <p className="mt-2 text-sm muted">
          {tokenInfo
            ? isEn
              ? "Enter a new password for your account."
              : "Введите новый пароль для аккаунта."
            : isEn
              ? "Request a reset link to your email."
              : "Запросите ссылку для сброса на ваш email."}
        </p>

        {sp.error && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{sp.error}</div>}
        {sp.ok && <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{sp.ok}</div>}

        {tokenInfo ? (
          <form action={applyReset} className="mt-5 grid gap-3">
            <input type="hidden" name="token" value={token} />
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="input"
              placeholder={isEn ? "New password (min 6 chars)" : "Новый пароль (минимум 6 символов)"}
            />
            <button type="submit" className="btn-primary mt-1 w-full">
              {isEn ? "Save new password" : "Сохранить новый пароль"}
            </button>
          </form>
        ) : (
          <form action={requestReset} className="mt-5 grid gap-3">
            <input name="email" type="email" required className="input" placeholder="you@mail.com" />
            <button type="submit" className="btn-primary mt-1 w-full">
              {isEn ? "Send reset link" : "Отправить ссылку для сброса"}
            </button>
          </form>
        )}

        <div className="pt-4 text-center text-xs text-white/60">
          <Link href="/login?tab=signin" className="text-cyan-300">
            {isEn ? "Back to sign in" : "Назад ко входу"}
          </Link>
        </div>
      </div>
    </div>
  );
}
