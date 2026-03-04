import { NextResponse } from "next/server";
import { getTournamentRegistrationRows } from "@/lib/registrationTable";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const rows = await getTournamentRegistrationRows(id);
  return NextResponse.json({ rows });
}
