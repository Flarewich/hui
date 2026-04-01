import { NextResponse, type NextRequest } from "next/server";
import { resolveLocale } from "@/lib/i18n";
import { getSessionByToken, SESSION_COOKIE_NAME } from "@/lib/sessionAuth";

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

function banMessage(locale: "ru" | "en", until: string | null) {
  if (locale === "en") {
    return until ? `Your account is banned until ${until}.` : "Your account is banned.";
  }
  return until ? `Ваш аккаунт забанен до ${until}.` : "Ваш аккаунт забанен.";
}

function restrictionMessage(locale: "ru" | "en", until: string | null) {
  if (locale === "en") {
    return until ? `Your account is temporarily restricted until ${until}.` : "Your account is temporarily restricted.";
  }
  return until ? `Ваш аккаунт временно ограничен до ${until}.` : "Ваш аккаунт временно ограничен.";
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isPublicAuthPath = pathname === "/login" || pathname.startsWith("/auth/") || pathname.startsWith("/api/lang");
  if (isPublicAuthPath) {
    return NextResponse.next({ request: { headers: req.headers } });
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionByToken(token);
  if (!session?.user || !session.profile) {
    return NextResponse.next({ request: { headers: req.headers } });
  }

  const profile = session.profile;
  const now = Date.now();
  const isBanned =
    Boolean(profile.is_banned) ||
    (profile.banned_until ? new Date(profile.banned_until).getTime() > now : false);
  const isRestricted = profile.restricted_until ? new Date(profile.restricted_until).getTime() > now : false;

  if (isBanned || isRestricted) {
    const locale = resolveLocale(req.cookies.get("lang")?.value);
    const until = isBanned
      ? formatUntil(profile.banned_until, locale)
      : formatUntil(profile.restricted_until, locale);
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", isBanned ? banMessage(locale, until) : restrictionMessage(locale, until));
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers: req.headers } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
