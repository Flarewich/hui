import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseRoute";

export async function POST(request: Request) {
  const supabase = await createSupabaseRouteClient();
  await supabase.auth.signOut();

  const url = new URL(request.url);
  return NextResponse.redirect(`${url.origin}/`, { status: 303 });
}