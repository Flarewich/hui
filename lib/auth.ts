import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
};

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, role")
    .eq("id", user.id)
    .single<Profile>();

  return { supabase, user, profile: profile ?? null };
}

export async function requireAdmin() {
  const { supabase, user, profile } = await requireUser();
  const metadataRole =
    user.app_metadata && typeof user.app_metadata === "object" && user.app_metadata.role === "admin"
      ? "admin"
      : null;

  if (profile?.role !== "admin" && metadataRole !== "admin") redirect("/");
  return { supabase, user, profile };
}
