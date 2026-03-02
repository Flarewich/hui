import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function ProfilePage() {
   const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, role, created_at")
    .eq("id", user.id)
    .single();

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h1 className="text-xl font-bold">Профиль</h1>
      <div className="mt-4 space-y-2 text-sm text-white/80">
        <div>Email: {user.email}</div>
        <div>Username: {profile?.username ?? "—"}</div>
        <div>Role: {profile?.role ?? "—"}</div>
      </div>
    </div>
  );
}