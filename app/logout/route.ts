import { NextResponse } from "next/server";
import { clearCurrentSession } from "@/lib/sessionAuth";
import { assertSameOriginRequest } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await clearCurrentSession();
  const url = new URL(request.url);
  return NextResponse.redirect(`${url.origin}/`, { status: 303 });
}
