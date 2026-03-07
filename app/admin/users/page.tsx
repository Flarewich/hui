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
  is_banned: boolean | null;
  banned_until: string | null;
  restricted_until: string | null;
};

function toDate(ts: string | null | undefined, locale: "ru" | "en") {
  if (!ts) return "-";
  return new Date(ts).toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function activeRestrictionLabel(
  user: Pick<UserRow, "is_banned" | "banned_until" | "restricted_until">,
  locale: "ru" | "en"
) {
  const now = Date.now();
  const bannedActive =
    Boolean(user.is_banned) || (user.banned_until ? new Date(user.banned_until).getTime() > now : false);
  if (bannedActive) return locale === "en" ? "Banned" : "Забанен";

  const restrictedActive = user.restricted_until ? new Date(user.restricted_until).getTime() > now : false;
  if (restrictedActive) return locale === "en" ? "Restricted" : "Ограничен";

  return locale === "en" ? "Active" : "Активен";
}

export default async function AdminUsersPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const { supabase, user } = await requireAdmin();

  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, username, role, created_at, is_banned, banned_until, restricted_until")
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

  async function setBan(formData: FormData) {
    "use server";

    const { user } = await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const mode = String(formData.get("mode") ?? "ban").trim();

    if (!id || id === user.id) return;

    if (mode === "unban") {
      await supabaseAdmin
        .from("profiles")
        .update({ is_banned: false, banned_until: null, restricted_until: null })
        .eq("id", id);
      revalidatePath("/admin/users");
      return;
    }

    await supabaseAdmin
      .from("profiles")
      .update({ is_banned: true, banned_until: null, restricted_until: null })
      .eq("id", id);

    revalidatePath("/admin/users");
  }

  async function setRestriction(formData: FormData) {
    "use server";

    const { user } = await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const amount = Number(formData.get("amount") ?? 0);
    const unit = String(formData.get("unit") ?? "minutes").trim();
    const mode = String(formData.get("mode") ?? "set").trim();

    if (!id || id === user.id) return;

    if (mode === "clear") {
      await supabaseAdmin.from("profiles").update({ restricted_until: null }).eq("id", id);
      revalidatePath("/admin/users");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) return;
    const maxAmount = Math.min(amount, 3650);

    let ms = maxAmount * 60 * 1000;
    if (unit === "hours") ms = maxAmount * 60 * 60 * 1000;
    if (unit === "days") ms = maxAmount * 24 * 60 * 60 * 1000;

    const restrictedUntil = new Date(Date.now() + ms).toISOString();
    await supabaseAdmin
      .from("profiles")
      .update({ restricted_until: restrictedUntil, is_banned: false, banned_until: null })
      .eq("id", id);

    revalidatePath("/admin/users");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="text-xl font-bold">{isEn ? "Users and roles" : "Пользователи и роли"}</h2>
        <p className="mt-2 text-sm text-white/60">
          {isEn
            ? "Manage user roles and moderation: ban or temporary restrictions."
            : "Управление ролями пользователей и модерацией: бан и временные ограничения."}
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{isEn ? "Failed to load users" : "Ошибка загрузки пользователей"}: {error.message}</div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4">
        <div className="space-y-3 sm:hidden">
          {(users ?? []).map((u) => (
            <article key={u.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{u.username ?? "-"}</div>
                  <div className="mt-1 text-xs text-white/60">{u.id.slice(0, 8)}...</div>
                </div>
                <div className="rounded-lg border border-white/15 bg-black/25 px-2 py-1 text-xs">{u.role ?? "user"}</div>
              </div>
              <div className="mt-2 text-xs text-white/60">{isEn ? "Created" : "Создан"}: {toDate(u.created_at, locale)}</div>
              <div className="mt-1 text-xs text-white/70">
                {isEn ? "Status" : "Статус"}: {activeRestrictionLabel(u, locale)}
                {u.restricted_until ? ` • ${isEn ? "Until" : "До"} ${toDate(u.restricted_until, locale)}` : ""}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={setRole}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="role" value="user" />
                  <button
                    type="submit"
                    disabled={u.id === user.id}
                    className="rounded-lg border border-white/20 bg-black/20 px-2.5 py-1 text-xs hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    user
                  </button>
                </form>
                <form action={setRole}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="role" value="sponsor" />
                  <button type="submit" className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-1 text-xs text-fuchsia-100 hover:bg-fuchsia-500/20">
                    sponsor
                  </button>
                </form>
                <form action={setRole}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="role" value="admin" />
                  <button type="submit" className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100 hover:bg-cyan-500/20">
                    admin
                  </button>
                </form>
                <form action={setBan}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="mode" value={u.is_banned ? "unban" : "ban"} />
                  <button
                    type="submit"
                    disabled={u.id === user.id}
                    className={[
                      "rounded-lg px-2.5 py-1 text-xs",
                      u.is_banned
                        ? "border border-emerald-400/35 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                        : "border border-red-400/35 bg-red-500/10 text-red-100 hover:bg-red-500/20",
                    ].join(" ")}
                  >
                    {u.is_banned ? (isEn ? "unban" : "разбан") : (isEn ? "ban" : "бан")}
                  </button>
                </form>
                <form action={setRestriction} className="flex items-center gap-1.5">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="number" name="amount" min={1} max={3650} defaultValue={60} className="w-16 rounded-lg border border-white/15 bg-black/25 px-2 py-1 text-xs" />
                  <select name="unit" className="rounded-lg border border-white/15 bg-black/25 px-2 py-1 text-xs">
                    <option value="minutes">{isEn ? "min" : "мин"}</option>
                    <option value="hours">{isEn ? "hours" : "часы"}</option>
                    <option value="days">{isEn ? "days" : "дни"}</option>
                  </select>
                  <button type="submit" className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-500/20">
                    {isEn ? "restrict" : "ограничить"}
                  </button>
                </form>
                <form action={setRestriction}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="mode" value="clear" />
                  <button type="submit" className="rounded-lg border border-white/20 bg-black/20 px-2.5 py-1 text-xs hover:bg-white/5">
                    {isEn ? "clear" : "снять"}
                  </button>
                </form>
              </div>
            </article>
          ))}
          {(users?.length ?? 0) === 0 && !error && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
              {isEn ? "No users found." : "Пользователи не найдены."}
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-full text-left text-sm">
            <thead className="text-white/50">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">{isEn ? "Username" : "Ник"}</th>
                <th className="px-3 py-2">{isEn ? "Role" : "Роль"}</th>
                <th className="px-3 py-2">{isEn ? "Status" : "Статус"}</th>
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
                  <td className="px-3 py-2 text-xs text-white/80">
                    {activeRestrictionLabel(u, locale)}
                    {u.restricted_until ? <div className="text-white/55">{isEn ? "Until" : "До"}: {toDate(u.restricted_until, locale)}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-white/70">{toDate(u.created_at, locale)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
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

                      <form action={setBan}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="mode" value={u.is_banned ? "unban" : "ban"} />
                        <button
                          type="submit"
                          disabled={u.id === user.id}
                          className={[
                            "rounded-lg px-3 py-1 text-xs",
                            u.is_banned
                              ? "border border-emerald-400/35 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                              : "border border-red-400/35 bg-red-500/10 text-red-100 hover:bg-red-500/20",
                          ].join(" ")}
                        >
                          {u.is_banned ? (isEn ? "unban" : "разбан") : (isEn ? "ban" : "бан")}
                        </button>
                      </form>

                      <form action={setRestriction} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={u.id} />
                        <input type="number" name="amount" min={1} max={3650} defaultValue={60} className="w-16 rounded-lg border border-white/15 bg-black/25 px-2 py-1 text-xs" />
                        <select name="unit" className="rounded-lg border border-white/15 bg-black/25 px-2 py-1 text-xs">
                          <option value="minutes">{isEn ? "min" : "мин"}</option>
                          <option value="hours">{isEn ? "hours" : "часы"}</option>
                          <option value="days">{isEn ? "days" : "дни"}</option>
                        </select>
                        <button type="submit" className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-xs text-amber-100 hover:bg-amber-500/20">
                          {isEn ? "restrict" : "ограничить"}
                        </button>
                      </form>

                      <form action={setRestriction}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="mode" value="clear" />
                        <button type="submit" className="rounded-lg border border-white/20 bg-black/20 px-3 py-1 text-xs hover:bg-white/5">
                          {isEn ? "clear" : "снять"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}

              {(users?.length ?? 0) === 0 && !error && (
                <tr>
                  <td className="px-3 py-4 text-sm text-white/60" colSpan={6}>
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
