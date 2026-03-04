import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureSponsorRecordForProfile } from "@/lib/sponsorSync";
import { getRequestLocale } from "@/lib/i18nServer";

type UserRow = {
  id: string;
  username: string | null;
  role: string | null;
  created_at: string | null;
};

function toDate(ts: string | null | undefined, locale: "ru" | "en") {
  if (!ts) return "-";
  return new Date(ts).toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function AdminUsersPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const { supabase, user } = await requireAdmin();

  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, username, role, created_at")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<UserRow[]>();

  async function setRole(formData: FormData) {
    "use server";

    const { user } = await requireAdmin();

    const id = String(formData.get("id") ?? "").trim();
    const role = String(formData.get("role") ?? "user").trim();

    if (!id) return;
    if (role !== "admin" && role !== "user" && role !== "sponsor") return;

    if (id === user.id && role !== "admin") return;

    await supabaseAdmin.from("profiles").update({ role }).eq("id", id);

    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(id);
    const appMetadata = { ...(authUserData.user?.app_metadata ?? {}), role };
    await supabaseAdmin.auth.admin.updateUserById(id, { app_metadata: appMetadata });

    if (role === "sponsor") {
      const username =
        (users ?? []).find((u) => u.id === id)?.username ??
        authUserData.user?.user_metadata?.username ??
        authUserData.user?.email ??
        null;
      await ensureSponsorRecordForProfile({ userId: id, username: typeof username === "string" ? username : null });
      revalidatePath("/sponsors");
    }

    revalidatePath("/admin/users");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-bold">{isEn ? "Users and roles" : "Пользователи и роли"}</h2>
        <p className="mt-2 text-sm text-white/60">{isEn ? "Manage user roles: user, sponsor, admin." : "Управление ролями пользователей: user, sponsor, admin."}</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{isEn ? "Failed to load users" : "Ошибка загрузки пользователей"}: {error.message}</div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-white/50">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">{isEn ? "Username" : "Ник"}</th>
                <th className="px-3 py-2">{isEn ? "Role" : "Роль"}</th>
                <th className="px-3 py-2">{isEn ? "Created" : "Создан"}</th>
                <th className="px-3 py-2">{isEn ? "Actions" : "Действия"}</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-white/10">
                  <td className="px-3 py-2 font-mono text-xs text-white/70">{u.id.slice(0, 8)}...</td>
                  <td className="px-3 py-2">{u.username ?? "-"}</td>
                  <td className="px-3 py-2">{u.role ?? "user"}</td>
                  <td className="px-3 py-2 text-white/70">{toDate(u.created_at, locale)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <form action={setRole}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="role" value="user" />
                        <button
                          type="submit"
                          disabled={u.id === user.id}
                          className="rounded-lg border border-white/20 bg-black/20 px-3 py-1 text-xs hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          user
                        </button>
                      </form>

                      <form action={setRole}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="role" value="sponsor" />
                        <button type="submit" className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-100 hover:bg-fuchsia-500/20">
                          sponsor
                        </button>
                      </form>

                      <form action={setRole}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="role" value="admin" />
                        <button type="submit" className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-500/20">
                          admin
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}

              {(users?.length ?? 0) === 0 && !error && (
                <tr>
                  <td className="px-3 py-4 text-sm text-white/60" colSpan={5}>
                    {isEn ? "No users found." : "Пользователи не найдены."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
