import Link from "next/link";
import { redirect } from "next/navigation";
import { getRequestLocale } from "@/lib/i18nServer";
import {
  authenticateWithPassword,
  clearCurrentSession,
  createSessionForUser,
  getCurrentSession,
  getProfileByUserId,
  registerWithPassword,
} from "@/lib/sessionAuth";
import {
  assertSameOriginServerAction,
  consumeRateLimit,
  getServerActionIp,
  isValidEmail,
  sanitizeTextInput,
} from "@/lib/security";

function isRedirectException(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeDigest = (error as { digest?: unknown }).digest;
  return typeof maybeDigest === "string" && maybeDigest.startsWith("NEXT_REDIRECT");
}

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

function blockedMessage(locale: "ru" | "en", isBanned: boolean, until: string | null) {
  if (locale === "en") {
    if (isBanned) return until ? `Your account is banned until ${until}.` : "Your account is banned.";
    return until ? `Your account is temporarily restricted until ${until}.` : "Your account is temporarily restricted.";
  }
  if (isBanned) return until ? `Ваш аккаунт забанен до ${until}.` : "Ваш аккаунт забанен.";
  return until ? `Ваш аккаунт временно ограничен до ${until}.` : "Ваш аккаунт временно ограничен.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; tab?: string }>;
}) {
  const locale = await getRequestLocale();
  const isEn = locale === "en";

  const sp = await searchParams;
  const session = await getCurrentSession();
  if (session?.user && !sp.error) redirect("/");
  const tab = sp.tab === "signup" ? "signup" : "signin";

  async function signIn(formData: FormData) {
    "use server";

    const locale = await getRequestLocale();
    const isEn = locale === "en";
    const invalidDataMsg = isEn
      ? "Incorrect data entered. Please check and try again."
      : "Вы ввели некорректные данные. Проверьте и попробуйте снова.";

    try {
      await assertSameOriginServerAction();

      const email = sanitizeTextInput(formData.get("email"), { maxLength: 160 }).toLowerCase();
      const password = String(formData.get("password") ?? "").trim();
      const ip = await getServerActionIp();

      if (!email || !password || !isValidEmail(email)) {
        redirect(`/login?tab=signin&error=${encodeURIComponent(invalidDataMsg)}`);
      }

      const ipRate = await consumeRateLimit({
        action: "login:ip",
        key: ip,
        limit: 10,
        windowSeconds: 10 * 60,
      });
      if (!ipRate.allowed) {
        redirect(`/login?tab=signin&error=${encodeURIComponent(isEn ? "Too many sign in attempts. Try again later." : "Слишком много попыток входа. Попробуйте позже.")}`);
      }

      const emailRate = await consumeRateLimit({
        action: "login:ip-email",
        key: `${ip}:${email}`,
        limit: 5,
        windowSeconds: 10 * 60,
      });
      if (!emailRate.allowed) {
        redirect(`/login?tab=signin&error=${encodeURIComponent(isEn ? "Too many sign in attempts. Try again later." : "Слишком много попыток входа. Попробуйте позже.")}`);
      }

      const account = await authenticateWithPassword(email, password);
      if (!account?.userId) {
        redirect(`/login?tab=signin&error=${encodeURIComponent(invalidDataMsg)}`);
      }

      const profile = await getProfileByUserId(account.userId);
      if (profile) {
        const now = Date.now();
        const isBanned =
          Boolean(profile.is_banned) ||
          (profile.banned_until ? new Date(profile.banned_until).getTime() > now : false);
        const isRestricted = profile.restricted_until ? new Date(profile.restricted_until).getTime() > now : false;

        if (isBanned || isRestricted) {
          await clearCurrentSession();
          const until = isBanned ? formatUntil(profile.banned_until, locale) : formatUntil(profile.restricted_until, locale);
          const message = blockedMessage(locale, isBanned, until);
          redirect(`/login?tab=signin&error=${encodeURIComponent(message)}`);
        }
      }

      await createSessionForUser(account.userId);
      redirect("/");
    } catch (e) {
      if (isRedirectException(e)) throw e;
      const message = isEn ? "Sign in error" : "Ошибка входа";
      redirect(`/login?tab=signin&error=${encodeURIComponent(message)}`);
    }
  }

  async function signUp(formData: FormData) {
    "use server";

    const locale = await getRequestLocale();
    const isEn = locale === "en";
    const invalidDataMsg = isEn
      ? "Incorrect data entered. Please check and try again."
      : "Вы ввели некорректные данные. Проверьте и попробуйте снова.";

    try {
      await assertSameOriginServerAction();

      const email = sanitizeTextInput(formData.get("email"), { maxLength: 160 }).toLowerCase();
      const password = String(formData.get("password") ?? "").trim();
      const usernameInput = sanitizeTextInput(formData.get("username"), { maxLength: 24 });
      const ip = await getServerActionIp();

      if (!email || !password || !isValidEmail(email) || password.length < 6) {
        redirect(`/login?tab=signup&error=${encodeURIComponent(invalidDataMsg)}`);
      }

      const signUpRate = await consumeRateLimit({
        action: "signup:ip",
        key: ip,
        limit: 5,
        windowSeconds: 30 * 60,
      });
      if (!signUpRate.allowed) {
        redirect(`/login?tab=signup&error=${encodeURIComponent(isEn ? "Too many registration attempts. Try again later." : "Слишком много попыток регистрации. Попробуйте позже.")}`);
      }

      await registerWithPassword({ email, password, usernameInput });
      redirect(
        `/login?tab=signin&ok=${encodeURIComponent(
          isEn ? "Registration successful. Now sign in." : "Регистрация прошла успешно. Теперь войдите в аккаунт."
        )}`
      );
    } catch (e) {
      if (isRedirectException(e)) throw e;
      const message = isEn ? "Sign up error" : "Ошибка регистрации";
      redirect(`/login?tab=signup&error=${encodeURIComponent(message)}`);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6">
        <h1 className="text-2xl font-bold title-glow">{isEn ? "Account" : "Аккаунт"}</h1>
        <p className="mt-2 text-sm muted">{isEn ? "Sign in or create a new account." : "Войдите или создайте новый аккаунт."}</p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/25 p-1">
          <Link
            href="/login?tab=signin"
            className={[
              "rounded-lg px-3 py-2 text-center text-sm font-semibold",
              tab === "signin" ? "bg-white text-black" : "text-white/75 hover:bg-white/5",
            ].join(" ")}
          >
            {isEn ? "Sign in" : "Вход"}
          </Link>
          <Link
            href="/login?tab=signup"
            className={[
              "rounded-lg px-3 py-2 text-center text-sm font-semibold",
              tab === "signup" ? "bg-white text-black" : "text-white/75 hover:bg-white/5",
            ].join(" ")}
          >
            {isEn ? "Sign up" : "Регистрация"}
          </Link>
        </div>

        {sp.error && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{sp.error}</div>}
        {sp.ok && <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{sp.ok}</div>}

        {tab === "signin" ? (
          <>
            <form action={signIn} className="mt-5 grid gap-3">
              <input name="email" type="email" required className="input" placeholder="you@mail.com" />
              <input name="password" type="password" required className="input" placeholder={isEn ? "Password" : "Пароль"} />
              <button type="submit" className="btn-primary mt-1 w-full">
                {isEn ? "Sign in" : "Войти"}
              </button>
            </form>
            <div className="mt-2 text-right text-xs text-white/60">
              <Link href="/reset-password" className="text-cyan-300 hover:text-cyan-200">
                {isEn ? "Forgot password?" : "Забыли пароль?"}
              </Link>
            </div>
          </>
        ) : (
          <form action={signUp} className="mt-5 grid gap-3">
            <input name="username" className="input" placeholder={isEn ? "Nickname (optional)" : "Ник (необязательно)"} />
            <input name="email" type="email" required className="input" placeholder="you@mail.com" />
            <input
              name="password"
              type="password"
              required
              className="input"
              placeholder={isEn ? "Password (min 6 chars)" : "Пароль (минимум 6 символов)"}
            />
            <button type="submit" className="btn-primary mt-1 w-full">
              {isEn ? "Create account" : "Создать аккаунт"}
            </button>
          </form>
        )}

        <div className="pt-4 text-center text-xs text-white/60">
          {isEn ? "After sign in, you can manage your profile, teams and tournament activity." : "После входа вы сможете управлять профилем, командами и участием в турнирах."}
        </div>
      </div>
    </div>
  );
}
