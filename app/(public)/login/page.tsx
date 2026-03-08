import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseRouteClient } from "@/lib/supabaseRoute";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { ensureProfileForAuthUser } from "@/lib/profileSync";
import { getRequestLocale } from "@/lib/i18nServer";

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

  const serverSupabase = await createSupabaseServerClient();
  const sp = await searchParams;
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (user && !sp.error) redirect("/");
  const tab = sp.tab === "signup" ? "signup" : "signin";

  async function signIn(formData: FormData) {
    "use server";
    const locale = await getRequestLocale();
    const isEn = locale === "en";
    const invalidDataMsg = isEn
      ? "Incorrect data entered. Please check and try again."
      : "Вы ввели неправильные данные, перепроверьте.";

    try {
      const supabase = await createSupabaseRouteClient();
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      const password = String(formData.get("password") ?? "").trim();

      if (!email || !password) {
        redirect(`/login?tab=signin&error=${encodeURIComponent(invalidDataMsg)}`);
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) redirect(`/login?tab=signin&error=${encodeURIComponent(invalidDataMsg)}`);

      if (data.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_banned, banned_until, restricted_until")
          .eq("id", data.user.id)
          .maybeSingle<{ is_banned?: boolean | null; banned_until?: string | null; restricted_until?: string | null }>();

        const now = Date.now();
        const isBanned =
          Boolean(profile?.is_banned) ||
          (profile?.banned_until ? new Date(profile.banned_until).getTime() > now : false);
        const isRestricted = profile?.restricted_until ? new Date(profile.restricted_until).getTime() > now : false;

        if (isBanned || isRestricted) {
          await supabase.auth.signOut();
          const until = isBanned ? formatUntil(profile?.banned_until, locale) : formatUntil(profile?.restricted_until, locale);
          const message = blockedMessage(locale, isBanned, until);
          redirect(`/login?tab=signin&error=${encodeURIComponent(message)}`);
        }
      }

      if (data.user?.id) {
        try {
          await ensureProfileForAuthUser({ userId: data.user.id, email, roleFromMetadata: data.user.app_metadata?.role });
        } catch {}
      }
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
      : "Вы ввели неправильные данные, перепроверьте.";

    try {
      const supabase = await createSupabaseRouteClient();
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      const password = String(formData.get("password") ?? "").trim();
      const usernameInput = String(formData.get("username") ?? "").trim();

      if (!email || !password) {
        redirect(`/login?tab=signup&error=${encodeURIComponent(invalidDataMsg)}`);
      }
      if (password.length < 6) {
        redirect(`/login?tab=signup&error=${encodeURIComponent(invalidDataMsg)}`);
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback` },
      });
      if (error) redirect(`/login?tab=signup&error=${encodeURIComponent(invalidDataMsg)}`);

      if (data.session?.user?.id) {
        try {
          await ensureProfileForAuthUser({
            userId: data.session.user.id,
            email,
            usernameInput,
            roleFromMetadata: data.session.user.app_metadata?.role,
          });
        } catch {}
      }

      redirect(`/login?tab=signin&ok=${encodeURIComponent(isEn ? "Registration successful. Now sign in." : "Регистрация успешна. Теперь войдите в аккаунт.")}`);
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
          <Link href="/login?tab=signin" className={["rounded-lg px-3 py-2 text-center text-sm font-semibold", tab === "signin" ? "bg-white text-black" : "text-white/75 hover:bg-white/5"].join(" ")}>
            {isEn ? "Sign in" : "Вход"}
          </Link>
          <Link href="/login?tab=signup" className={["rounded-lg px-3 py-2 text-center text-sm font-semibold", tab === "signup" ? "bg-white text-black" : "text-white/75 hover:bg-white/5"].join(" ")}>
            {isEn ? "Sign up" : "Регистрация"}
          </Link>
        </div>

        {sp.error && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{sp.error}</div>}
        {sp.ok && <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{sp.ok}</div>}

        {tab === "signin" ? (
          <form action={signIn} className="mt-5 grid gap-3">
            <input name="email" type="email" required className="input" placeholder="you@mail.com" />
            <input name="password" type="password" required className="input" placeholder={isEn ? "Password" : "Пароль"} />
            <button type="submit" className="btn-primary mt-1 w-full">
              {isEn ? "Sign in" : "Войти"}
            </button>
          </form>
        ) : (
          <form action={signUp} className="mt-5 grid gap-3">
            <input name="username" className="input" placeholder={isEn ? "Nickname (optional)" : "Ник (необязательно)"} />
            <input name="email" type="email" required className="input" placeholder="you@mail.com" />
            <input name="password" type="password" required className="input" placeholder={isEn ? "Password (min 6 chars)" : "Пароль (минимум 6 символов)"} />
            <button type="submit" className="btn-primary mt-1 w-full">
              {isEn ? "Create account" : "Создать аккаунт"}
            </button>
          </form>
        )}

        <div className="pt-4 text-center text-xs text-white/60">
          {isEn ? "After sign in, available routes are " : "После входа доступны "}
          <Link href="/profile" className="text-cyan-300">
            /profile
          </Link>{" "}
          {isEn ? "and" : "и"}{" "}
          <Link href="/support" className="text-cyan-300">
            /support
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
