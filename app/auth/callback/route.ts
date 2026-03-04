import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseRoute";
import { ensureProfileForAuthUser } from "@/lib/profileSync";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseRouteClient();
    await supabase.auth.exchangeCodeForSession(code);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      try {
        await ensureProfileForAuthUser({
          userId: user.id,
          email: user.email,
          roleFromMetadata: user.app_metadata?.role,
        });
      } catch {
        // Profile sync failure should not block login redirect.
      }
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
