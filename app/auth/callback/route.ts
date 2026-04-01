import { NextResponse } from "next/server";
import { getSafeRequestUrl } from "@/lib/security";

export async function GET(request: Request) {
  return NextResponse.redirect(getSafeRequestUrl(request, "/login"), { status: 303 });
}
