import { NextResponse } from "next/server";
import { localeCookieName, resolveLocale } from "@/lib/i18n";

export async function POST(request: Request) {
  let locale = "ru";

  try {
    const body = (await request.json()) as { locale?: string };
    locale = resolveLocale(body?.locale);
  } catch {
    locale = "ru";
  }

  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
