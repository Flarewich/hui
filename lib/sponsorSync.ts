import { supabaseAdmin } from "@/lib/supabaseAdmin";

function buildSponsorName(userId: string, username?: string | null) {
  const trimmed = (username ?? "").trim();
  if (trimmed) return trimmed.slice(0, 64);
  return `Sponsor ${userId.slice(0, 8)}`;
}

export async function ensureSponsorRecordForProfile(params: {
  userId: string;
  username?: string | null;
}) {
  const { userId, username } = params;
  const fallbackName = buildSponsorName(userId, username);

  // Try to find an existing sponsor row by exact name first to avoid duplicates.
  const { data: existingByName } = await supabaseAdmin
    .from("sponsors")
    .select("id, is_active")
    .eq("name", fallbackName)
    .limit(1)
    .maybeSingle<{ id: string; is_active: boolean | null }>();

  if (existingByName?.id) {
    if (!existingByName.is_active) {
      await supabaseAdmin.from("sponsors").update({ is_active: true }).eq("id", existingByName.id);
    }
    return;
  }

  await supabaseAdmin.from("sponsors").insert({
    name: fallbackName,
    tier: "partner",
    href: null,
    logo_url: null,
    is_active: true,
  });
}
