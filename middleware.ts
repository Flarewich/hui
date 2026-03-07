import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // refresh session when needed
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  const pathname = req.nextUrl.pathname;
  const isPublicAuthPath = pathname === "/login" || pathname.startsWith("/auth/") || pathname.startsWith("/api/lang");

  if (user && !isPublicAuthPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_banned, banned_until, restricted_until")
      .eq("id", user.id)
      .maybeSingle<{ is_banned?: boolean | null; banned_until?: string | null; restricted_until?: string | null }>();

    const now = Date.now();
    const isBanned =
      Boolean(profile?.is_banned) ||
      (profile?.banned_until ? new Date(profile.banned_until).getTime() > now : false);
    const isRestricted = profile?.restricted_until ? new Date(profile.restricted_until).getTime() > now : false;

    if (isBanned || isRestricted) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", isBanned ? "Ваш аккаунт заблокирован" : "Доступ временно ограничен");
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
