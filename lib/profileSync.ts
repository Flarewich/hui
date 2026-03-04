import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "user" | "admin";

function getUsernameFromEmail(email?: string | null) {
  if (!email) return "player";
  const [name] = email.split("@");
  return (name || "player").slice(0, 24);
}

function normalizeRole(role: unknown): Role {
  return role === "admin" ? "admin" : "user";
}

export async function ensureProfileForAuthUser(params: {
  userId: string;
  email?: string | null;
  usernameInput?: string | null;
  roleFromMetadata?: unknown;
}) {
  const { userId, email, usernameInput, roleFromMetadata } = params;
  const safeRole = normalizeRole(roleFromMetadata);
  const username = (usernameInput?.trim() || getUsernameFromEmail(email)).slice(0, 24);

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle<{ id: string; role: string | null }>();

  if (existing?.id) {
    // Never downgrade admin to user.
    if (existing.role !== "admin" && safeRole === "admin") {
      await supabaseAdmin.from("profiles").update({ role: "admin" }).eq("id", userId);
    }
    return;
  }

  await supabaseAdmin.from("profiles").insert({
    id: userId,
    username,
    role: safeRole,
  });
}

