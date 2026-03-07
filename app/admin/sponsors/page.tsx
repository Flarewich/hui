import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureSponsorRecordForProfile } from "@/lib/sponsorSync";
import { getRequestLocale } from "@/lib/i18nServer";

type SponsorRow = {
  id: string;
  name: string;
  href: string | null;
  tier: string | null;
  logo_url: string | null;
  is_active: boolean | null;
};

type UserRow = {
  id: string;
  username: string | null;
  role: string | null;
};

const tierOptions = ["title", "gold", "silver", "partner"] as const;
const SPONSOR_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_SPONSOR_BUCKET || "sponsors";
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
}

async function uploadSponsorLogo(file: File, sponsorId: string) {
  const ext = sanitizeFileName(file.name).split(".").pop() || "bin";
  const path = `${sponsorId}/${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  let upload = await supabaseAdmin.storage.from(SPONSOR_BUCKET).upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });

  // Create bucket on first use if it does not exist, then retry upload once.
  if (upload.error?.message?.toLowerCase().includes("bucket not found")) {
    const { error: createBucketError } = await supabaseAdmin.storage.createBucket(SPONSOR_BUCKET, {
      public: true,
      fileSizeLimit: `${MAX_LOGO_BYTES}`,
    });
    if (!createBucketError) {
      upload = await supabaseAdmin.storage.from(SPONSOR_BUCKET).upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
    }
  }

  if (upload.error) {
    throw new Error(upload.error.message || "Failed to upload sponsor logo");
  }

  const { data } = supabaseAdmin.storage.from(SPONSOR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default async function AdminSponsorsPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const { supabase, user } = await requireAdmin();

  const [{ data: sponsors, error: sponsorsError }, { data: users, error: usersError }] = await Promise.all([
    supabase
      .from("sponsors")
      .select("id, name, href, tier, logo_url, is_active")
      .order("tier", { ascending: true })
      .order("name", { ascending: true })
      .returns<SponsorRow[]>(),
    supabase
      .from("profiles")
      .select("id, username, role")
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<UserRow[]>(),
  ]);

  async function createSponsor(formData: FormData) {
    "use server";

    await requireAdmin();

    const name = String(formData.get("name") ?? "").trim();
    const hrefRaw = String(formData.get("href") ?? "").trim();
    const logoFile = formData.get("logo_file");
    const tierRaw = String(formData.get("tier") ?? "partner").trim().toLowerCase();
    const isActive = formData.get("is_active") === "on";

    if (!name) return;
    const tier = tierOptions.includes(tierRaw as (typeof tierOptions)[number]) ? tierRaw : "partner";

    const { data: created, error: createError } = await supabaseAdmin
      .from("sponsors")
      .insert({
        name,
        href: hrefRaw || null,
        tier,
        is_active: isActive,
      })
      .select("id")
      .single();

    if (createError || !created?.id) return;

    if (logoFile instanceof File && logoFile.size > 0) {
      if (!logoFile.type.startsWith("image/")) return;
      if (logoFile.size > MAX_LOGO_BYTES) return;

      const logoUrl = await uploadSponsorLogo(logoFile, created.id);
      await supabaseAdmin.from("sponsors").update({ logo_url: logoUrl }).eq("id", created.id);
    }

    revalidatePath("/admin/sponsors");
    revalidatePath("/sponsors");
  }

  async function updateSponsor(formData: FormData) {
    "use server";

    await requireAdmin();

    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const hrefRaw = String(formData.get("href") ?? "").trim();
    const currentLogoUrl = String(formData.get("current_logo_url") ?? "").trim();
    const logoFile = formData.get("logo_file");
    const removeLogo = formData.get("remove_logo") === "on";
    const tierRaw = String(formData.get("tier") ?? "partner").trim().toLowerCase();
    const isActive = formData.get("is_active") === "on";

    if (!id || !name) return;
    const tier = tierOptions.includes(tierRaw as (typeof tierOptions)[number]) ? tierRaw : "partner";

    let logoUrl: string | null = removeLogo ? null : currentLogoUrl || null;
    if (logoFile instanceof File && logoFile.size > 0) {
      if (!logoFile.type.startsWith("image/")) return;
      if (logoFile.size > MAX_LOGO_BYTES) return;
      logoUrl = await uploadSponsorLogo(logoFile, id);
    }

    await supabaseAdmin
      .from("sponsors")
      .update({
        name,
        href: hrefRaw || null,
        logo_url: logoUrl,
        tier,
        is_active: isActive,
      })
      .eq("id", id);

    revalidatePath("/admin/sponsors");
    revalidatePath("/sponsors");
  }

  async function deleteSponsor(formData: FormData) {
    "use server";

    await requireAdmin();

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    await supabaseAdmin.from("sponsors").delete().eq("id", id);

    revalidatePath("/admin/sponsors");
    revalidatePath("/sponsors");
  }

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

    revalidatePath("/admin/sponsors");
    revalidatePath("/admin/users");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="text-xl font-bold">{isEn ? "Sponsors and roles" : "Спонсоры и роли"}</h2>
        <p className="mt-2 text-sm text-white/60">
          {isEn ? "Manage sponsors table and assign sponsor role to users." : "Управление таблицей sponsors и выдача роли sponsor пользователям."}
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h3 className="text-lg font-semibold">{isEn ? "Add sponsor" : "Добавить спонсора"}</h3>
        <form action={createSponsor} className="mt-4 grid gap-3 md:grid-cols-2">
          <input name="name" required placeholder={isEn ? "Name" : "Название"} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
          <select name="tier" defaultValue="partner" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
            {tierOptions.map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
          <input name="href" placeholder="https://..." className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" />
          <input
            name="logo_file"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black"
          />
          <label className="inline-flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 accent-cyan-400" />
            {isEn ? "Active" : "Активный"}
          </label>
          <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
            {isEn ? "Create" : "Создать"}
          </button>
        </form>
      </div>

      {sponsorsError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {isEn ? "Failed to load sponsors" : "Ошибка загрузки спонсоров"}: {sponsorsError.message}
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4">
        <h3 className="px-2 py-1 text-lg font-semibold">{isEn ? "Sponsors list" : "Список спонсоров"}</h3>
        <div className="mt-2 space-y-3">
          {(sponsors ?? []).map((s) => (
            <form key={s.id} action={updateSponsor} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="current_logo_url" value={s.logo_url ?? ""} />
              <div className="grid gap-3 md:grid-cols-2">
                <input name="name" defaultValue={s.name} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />
                <select name="tier" defaultValue={(s.tier ?? "partner").toLowerCase()} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
                  {tierOptions.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
                <input name="href" defaultValue={s.href ?? ""} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm" />
                <input
                  name="logo_file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black"
                />
                <label className="inline-flex items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" name="is_active" defaultChecked={Boolean(s.is_active)} className="h-4 w-4 accent-cyan-400" />
                  {isEn ? "Active" : "Активный"}
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" name="remove_logo" className="h-4 w-4 accent-cyan-400" />
                  {isEn ? "Remove logo" : "Удалить логотип"}
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
                  {isEn ? "Save" : "Сохранить"}
                </button>
                <button formAction={deleteSponsor} className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 hover:bg-red-500/20">
                  {isEn ? "Delete" : "Удалить"}
                </button>
              </div>
            </form>
          ))}

          {(sponsors?.length ?? 0) === 0 && !sponsorsError && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
              {isEn ? "No records in sponsors table yet." : "В таблице sponsors пока нет записей."}
            </div>
          )}
        </div>
      </div>

      {usersError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {isEn ? "Failed to load users" : "Ошибка загрузки пользователей"}: {usersError.message}
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4">
        <h3 className="px-2 py-1 text-lg font-semibold">{isEn ? "Assign sponsor role" : "Выдать роль sponsor"}</h3>
        <div className="mt-2 space-y-3 sm:hidden">
          {(users ?? []).map((u) => (
            <article key={u.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{u.username ?? "-"}</div>
                  <div className="mt-1 text-xs text-white/60">{u.id.slice(0, 8)}...</div>
                </div>
                <div className="rounded-lg border border-white/15 bg-black/25 px-2 py-1 text-xs">{u.role ?? "user"}</div>
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
              </div>
            </article>
          ))}
          {(users?.length ?? 0) === 0 && !usersError && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
              {isEn ? "No users found." : "Пользователи не найдены."}
            </div>
          )}
        </div>
        <div className="mt-2 hidden overflow-x-auto sm:block">
          <table className="min-w-full text-left text-sm">
            <thead className="text-white/50">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">{isEn ? "Username" : "Ник"}</th>
                <th className="px-3 py-2">{isEn ? "Current role" : "Текущая роль"}</th>
                <th className="px-3 py-2">{isEn ? "Actions" : "Действия"}</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-white/10">
                  <td className="px-3 py-2 font-mono text-xs text-white/70">{u.id.slice(0, 8)}...</td>
                  <td className="px-3 py-2">{u.username ?? "-"}</td>
                  <td className="px-3 py-2">{u.role ?? "user"}</td>
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
                    </div>
                  </td>
                </tr>
              ))}
              {(users?.length ?? 0) === 0 && !usersError && (
                <tr>
                  <td className="px-3 py-4 text-sm text-white/60" colSpan={4}>
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
