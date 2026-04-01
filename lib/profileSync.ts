import { ensureProfileForAccount } from "@/lib/sessionAuth";

type Role = "user" | "admin";

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
  await ensureProfileForAccount({
    userId,
    email,
    usernameInput,
    role: normalizeRole(roleFromMetadata),
  });
}
