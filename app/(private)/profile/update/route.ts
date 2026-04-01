import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { localeCookieName, resolveLocale } from "@/lib/i18n";
import { savePublicUpload } from "@/lib/localUploads";
import { ensureProfilePayoutColumns } from "@/lib/profilePayouts";
import { pgMaybeOne, pgQuery } from "@/lib/postgres";
import { assertSameOriginRequest, consumeRateLimit, getRequestIp, sanitizeTextInput } from "@/lib/security";
import { getCurrentSession } from "@/lib/sessionAuth";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

function getLocale(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  const match = raw.match(new RegExp(`${localeCookieName}=([^;]+)`));
  return resolveLocale(match?.[1]);
}

function msg(request: Request, en: string, ru: string) {
  return getLocale(request) === "en" ? en : ru;
}

function redirectWith(request: Request, query: string) {
  const url = new URL(request.url);
  return NextResponse.redirect(`${url.origin}/profile?${query}`, { status: 303 });
}

async function uploadAvatar(file: File, userId: string) {
  return savePublicUpload({ folder: "avatars", entityId: userId, file });
}

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch {
    const url = new URL(request.url);
    return NextResponse.redirect(`${url.origin}/profile?error=${encodeURIComponent("Forbidden")}`, { status: 303 });
  }

  const session = await getCurrentSession();
  const user = session?.user;

  if (!user) {
    const url = new URL(request.url);
    return NextResponse.redirect(`${url.origin}/login`, { status: 303 });
  }

  await ensureProfilePayoutColumns();

  const ip = getRequestIp(request);
  const profileRate = await consumeRateLimit({
    action: "profile-update:ip-user",
    key: `${ip}:${user.id}`,
    limit: 20,
    windowSeconds: 60 * 60,
  });
  if (!profileRate.allowed) {
    return redirectWith(request, `error=${encodeURIComponent(msg(request, "Too many profile updates. Try again later.", "Слишком много обновлений профиля. Попробуйте позже."))}`);
  }

  const formData = await request.formData();
  const username = sanitizeTextInput(formData.get("username"), { maxLength: 24 });
  const payoutIban = sanitizeTextInput(formData.get("payout_iban"), { maxLength: 34 }).toUpperCase();
  const avatarFile = formData.get("avatar_file");
  const removeAvatar = String(formData.get("remove_avatar") ?? "") === "on";

  if (username.length < 2 || username.length > 24) {
    return redirectWith(
      request,
      `error=${encodeURIComponent(msg(request, "Username must be 2-24 characters", "Ник должен быть от 2 до 24 символов"))}`
    );
  }

  if (!/^[a-zA-Z0-9_\-\u0400-\u04FF\s]+$/.test(username)) {
    return redirectWith(
      request,
      `error=${encodeURIComponent(msg(request, "Username contains invalid characters", "Ник содержит недопустимые символы"))}`
    );
  }

  if (payoutIban && !/^[A-Z0-9\s]{10,34}$/.test(payoutIban)) {
    return redirectWith(
      request,
      `error=${encodeURIComponent(msg(request, "IBAN format is invalid", "Некорректный формат IBAN"))}`
    );
  }

  const currentProfile = await pgMaybeOne<{ avatar_url: string | null }>(
    `
      select avatar_url
      from profiles
      where id = $1
      limit 1
    `,
    [user.id]
  );

  let avatarUrl: string | null = currentProfile?.avatar_url ?? null;
  if (removeAvatar) avatarUrl = null;

  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (!ALLOWED_AVATAR_TYPES.has(avatarFile.type)) {
      return redirectWith(
        request,
        `error=${encodeURIComponent(msg(request, "Avatar file must be PNG, JPG, WEBP, GIF or AVIF", "Файл аватара должен быть PNG, JPG, WEBP, GIF или AVIF"))}`
      );
    }
    if (avatarFile.size > MAX_AVATAR_BYTES) {
      return redirectWith(
        request,
        `error=${encodeURIComponent(msg(request, "Avatar is too large. Maximum is 5MB", "Аватар слишком большой. Максимум 5MB"))}`
      );
    }
    try {
      avatarUrl = await uploadAvatar(avatarFile, user.id);
    } catch {
      return redirectWith(
        request,
        `error=${encodeURIComponent(msg(request, "Failed to upload avatar", "Не удалось загрузить аватар"))}`
      );
    }
  }

  try {
    await pgQuery(
      `
        insert into profiles (id, username, avatar_url, payout_iban)
        values ($1, $2, $3, $4)
        on conflict (id) do update
        set username = excluded.username,
            avatar_url = excluded.avatar_url,
            payout_iban = excluded.payout_iban
      `,
      [user.id, username, avatarUrl, payoutIban || null]
    );
  } catch (error) {
    return redirectWith(request, `error=${encodeURIComponent(error instanceof Error ? error.message : "Profile update error")}`);
  }

  revalidatePath("/profile");
  revalidatePath("/admin/users");
  revalidatePath("/admin/payments");
  return redirectWith(request, `ok=${encodeURIComponent(msg(request, "Profile updated", "Профиль обновлен"))}`);
}
