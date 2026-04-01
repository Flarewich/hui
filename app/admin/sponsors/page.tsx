import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getUserEmail, queueEmail } from "@/lib/email";
import { ensureSponsorRecordForProfile } from "@/lib/sponsorSync";
import { ensureSponsorRequestsTable, listSponsorRequests, updateSponsorRequestStatus, type SponsorRequestRow } from "@/lib/sponsorRequests";
import { getRequestLocale } from "@/lib/i18nServer";
import { savePublicUpload } from "@/lib/localUploads";
import { createNotification } from "@/lib/notifications";
import { pgMaybeOne, pgQuery, pgRows } from "@/lib/postgres";

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
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

function toDate(ts: string, locale: "ru" | "en") {
  return new Date(ts).toLocaleString(locale === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function requestStatusLabel(status: string, locale: "ru" | "en") {
  if (locale === "en") return status;
  if (status === "pending_review") return "на проверке";
  if (status === "reviewed") return "просмотрено";
  if (status === "approved") return "одобрено";
  if (status === "rejected") return "отклонено";
  return status;
}

async function uploadSponsorLogo(file: File, sponsorId: string) {
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("Sponsor logo file is too large");
  }
  return savePublicUpload({
    folder: "sponsors",
    entityId: sponsorId,
    file,
  });
}

function RequestCard({
  item,
  locale,
  setRequestStatus,
  approveRequest,
  deleteRequest,
}: {
  item: SponsorRequestRow;
  locale: "ru" | "en";
  setRequestStatus: (formData: FormData) => Promise<void>;
  approveRequest: (formData: FormData) => Promise<void>;
  deleteRequest: (formData: FormData) => Promise<void>;
}) {
  const isEn = locale === "en";

  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{item.full_name}</div>
          <div className="mt-1 text-xs text-white/60">
            {item.username ? `@${item.username}` : item.user_id.slice(0, 8)} • {toDate(item.created_at, locale)}
          </div>
        </div>
        <div className="rounded-xl border border-white/15 bg-black/25 px-3 py-1 text-xs">
          {requestStatusLabel(item.status, locale)}
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-[11px] uppercase tracking-wide text-white/45">{isEn ? "Brand" : "Бренд"}</div>
          <div className="mt-1 text-sm">{item.brand_name || "-"}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-[11px] uppercase tracking-wide text-white/45">{isEn ? "Email" : "Email"}</div>
          <div className="mt-1 text-sm break-all">{item.contact_email}</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-[11px] uppercase tracking-wide text-white/45">{isEn ? "Contacts" : "Контакты"}</div>
        <div className="mt-1 whitespace-pre-wrap text-sm text-white/85">{item.contact_details}</div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-[11px] uppercase tracking-wide text-white/45">{isEn ? "Offer / motivation" : "Что предлагает / почему хочет стать спонсором"}</div>
        <div className="mt-1 whitespace-pre-wrap text-sm text-white/85">{item.offer_summary}</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={approveRequest}>
          <input type="hidden" name="request_id" value={item.id} />
          <input type="hidden" name="user_id" value={item.user_id} />
          <input type="hidden" name="username" value={item.username ?? ""} />
          <button type="submit" className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20">
            {isEn ? "Approve + sponsor role" : "Одобрить + выдать роль sponsor"}
          </button>
        </form>

        <form action={setRequestStatus}>
          <input type="hidden" name="request_id" value={item.id} />
          <input type="hidden" name="status" value="reviewed" />
          <button type="submit" className="rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/20">
            {isEn ? "Mark reviewed" : "Отметить просмотренной"}
          </button>
        </form>

        <form action={setRequestStatus}>
          <input type="hidden" name="request_id" value={item.id} />
          <input type="hidden" name="status" value="rejected" />
          <button type="submit" className="rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-1.5 text-xs text-red-100 hover:bg-red-500/20">
            {isEn ? "Reject" : "Отклонить"}
          </button>
        </form>

        <form action={setRequestStatus}>
          <input type="hidden" name="request_id" value={item.id} />
          <input type="hidden" name="status" value="pending_review" />
          <button type="submit" className="rounded-xl border border-white/20 bg-black/25 px-3 py-1.5 text-xs hover:bg-white/5">
            {isEn ? "Return to pending" : "Вернуть в pending"}
          </button>
        </form>

        <form action={deleteRequest}>
          <input type="hidden" name="request_id" value={item.id} />
          <button type="submit" className="rounded-xl border border-red-500/45 bg-red-600/15 px-3 py-1.5 text-xs text-red-100 hover:bg-red-600/25">
            {isEn ? "Delete request" : "Удалить заявку"}
          </button>
        </form>
      </div>
    </article>
  );
}

export default async function AdminSponsorsPage() {
  const locale = await getRequestLocale();
  const isEn = locale === "en";
  const { user } = await requireAdmin();

  await ensureSponsorRequestsTable();

  const [sponsors, users, requests] = await Promise.all([
    pgRows<SponsorRow>(
      `
        select id, name, href, tier, logo_url, is_active
        from sponsors
        order by tier asc, name asc
      `
    ),
    pgRows<UserRow>(
      `
        select id, username, role
        from profiles
        order by created_at desc nulls last
        limit 200
      `
    ),
    listSponsorRequests(),
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
    const created = await pgMaybeOne<{ id: string }>(
      `
        insert into sponsors (name, href, tier, is_active)
        values ($1, $2, $3, $4)
        returning id
      `,
      [name, hrefRaw || null, tier, isActive]
    );
    if (!created?.id) return;

    if (logoFile instanceof File && logoFile.size > 0) {
      if (!logoFile.type.startsWith("image/")) return;
      if (logoFile.size > MAX_LOGO_BYTES) return;

      const logoUrl = await uploadSponsorLogo(logoFile, created.id);
      await pgQuery(`update sponsors set logo_url = $2 where id = $1`, [created.id, logoUrl]);
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

    await pgQuery(
      `
        update sponsors
        set name = $2, href = $3, logo_url = $4, tier = $5, is_active = $6
        where id = $1
      `,
      [id, name, hrefRaw || null, logoUrl, tier, isActive]
    );

    revalidatePath("/admin/sponsors");
    revalidatePath("/sponsors");
  }

  async function deleteSponsor(formData: FormData) {
    "use server";

    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return;

    await pgQuery(`delete from sponsors where id = $1`, [id]);
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

    await pgQuery(`update profiles set role = $2 where id = $1`, [id, role]);

    if (role === "sponsor") {
      const username = users.find((item) => item.id === id)?.username ?? null;
      await ensureSponsorRecordForProfile({ userId: id, username });
      revalidatePath("/sponsors");
    }

    revalidatePath("/admin/sponsors");
    revalidatePath("/admin/users");
  }

  async function setRequestStatus(formData: FormData) {
    "use server";

    await requireAdmin();
    const requestId = String(formData.get("request_id") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    if (!requestId) return;

    await updateSponsorRequestStatus(requestId, status);
    const requestItem = requests.find((item) => item.id === requestId);
    if (requestItem && (status === "reviewed" || status === "rejected")) {
      await createNotification({
        userId: requestItem.user_id,
        type: "sponsor_request_status",
        title: status === "rejected" ? (isEn ? "Sponsor request rejected" : "Заявка на спонсорство отклонена") : (isEn ? "Sponsor request reviewed" : "Заявка на спонсорство просмотрена"),
        body: isEn ? `Status: ${status}` : `Статус: ${status}`,
        href: "/sponsors",
      });
    }
    revalidatePath("/admin/sponsors");
  }

  async function approveRequest(formData: FormData) {
    "use server";

    await requireAdmin();
    const requestId = String(formData.get("request_id") ?? "").trim();
    const userId = String(formData.get("user_id") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim();
    if (!requestId || !userId) return;

    await pgQuery(`update profiles set role = 'sponsor' where id = $1`, [userId]);
    await ensureSponsorRecordForProfile({ userId, username: username || null });
    await updateSponsorRequestStatus(requestId, "approved");
    await createNotification({
      userId,
      type: "sponsor_request_approved",
      title: isEn ? "Sponsor request approved" : "Заявка на спонсорство одобрена",
      body: isEn ? "Your account received sponsor role." : "Вашему аккаунту выдана роль sponsor.",
      href: "/sponsors",
    });
    const email = await getUserEmail(userId);
    if (email) {
      await queueEmail({
        toEmail: email,
        subject: isEn ? "Sponsor request approved" : "Заявка на спонсорство одобрена",
        textBody: isEn ? "Your sponsor request was approved and sponsor role was added to your account." : "Ваша заявка на спонсорство одобрена, роль sponsor добавлена в аккаунт.",
        kind: "sponsor_request_approved",
        userId,
      });
    }

    revalidatePath("/admin/sponsors");
    revalidatePath("/admin/users");
    revalidatePath("/sponsors");
  }

  async function deleteRequest(formData: FormData) {
    "use server";

    await requireAdmin();
    const requestId = String(formData.get("request_id") ?? "").trim();
    if (!requestId) return;

    await pgQuery(`delete from sponsor_requests where id = $1`, [requestId]);
    revalidatePath("/admin/sponsors");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <h2 className="text-xl font-bold">{isEn ? "Sponsors and roles" : "Спонсоры и роли"}</h2>
        <p className="mt-2 text-sm text-white/60">
          {isEn ? "Manage sponsor requests, sponsors table and sponsor role assignment." : "Управление заявками на спонсорство, таблицей sponsors и выдачей роли sponsor пользователям."}
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{isEn ? "Sponsor requests" : "Заявки на спонсорство"}</h3>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
            {isEn ? "Total" : "Всего"}: {requests.length}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {requests.map((item) => (
            <RequestCard
              key={item.id}
              item={item}
              locale={locale}
              setRequestStatus={setRequestStatus}
              approveRequest={approveRequest}
              deleteRequest={deleteRequest}
            />
          ))}
          {requests.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
              {isEn ? "No sponsor requests yet." : "Пока нет заявок на спонсорство."}
            </div>
          )}
        </div>
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

      <div className="rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4">
        <h3 className="px-2 py-1 text-lg font-semibold">{isEn ? "Sponsors list" : "Список спонсоров"}</h3>
        <div className="mt-2 space-y-3">
          {sponsors.map((s) => (
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

          {sponsors.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
              {isEn ? "No records in sponsors table yet." : "В таблице sponsors пока нет записей."}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4">
        <h3 className="px-2 py-1 text-lg font-semibold">{isEn ? "Assign sponsor role" : "Выдать роль sponsor"}</h3>
        <div className="mt-2 space-y-3 sm:hidden">
          {users.map((u) => (
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
          {users.length === 0 && (
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
              {users.map((u) => (
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
              {users.length === 0 && (
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
