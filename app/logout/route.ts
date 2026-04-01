import { NextResponse } from "next/server";
import { clearCurrentSession } from "@/lib/sessionAuth";
import { assertSameOriginRequest, getSafeRequestUrl } from "@/lib/security";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await clearCurrentSession();
  return NextResponse.redirect(getSafeRequestUrl(request, "/"), { status: 303 });
}
