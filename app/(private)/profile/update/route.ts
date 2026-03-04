import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseRouteClient } from "@/lib/supabaseRoute";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { localeCookieName, resolveLocale } from "@/lib/i18n";

const AVATAR_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET || "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

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

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
}

async function uploadAvatar(file: File, userId: string, request: Request) {
  const ext = sanitizeFileName(file.name).split(".").pop() || "bin";
  const path = `${userId}/${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const upload = await supabaseAdmin.storage.from(AVATAR_BUCKET).upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });

  if (upload.error) {
    const message = upload.error.message || msg(request, "Avatar upload error", "Ошибка загрузки аватара");
    if (message.toLowerCase().includes("bucket")) {
      throw new Error(msg(request, `Storage bucket '${AVATAR_BUCKET}' was not found. Create it in Supabase.`, `Не найден Storage bucket '${AVATAR_BUCKET}'. Создайте его в Supabase.`));
    }
    throw new Error(message);
  }

  const { data } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = new URL(request.url);
    return NextResponse.redirect(`${url.origin}/login`, { status: 303 });
  }

  const formData = await request.formData();
  const username = String(formData.get("username") ?? "").trim();
  const avatarFile = formData.get("avatar_file");
  const removeAvatar = String(formData.get("remove_avatar") ?? "") === "on";

  if (username.length < 2 || username.length > 24) {
    return redirectWith(request, `error=${encodeURIComponent(msg(request, "Username must be 2-24 characters", "Ник должен быть от 2 до 24 символов"))}`);
  }

  if (!/^[a-zA-Z0-9_\-а-яА-ЯёЁ\s]+$/.test(username)) {
    return redirectWith(request, `error=${encodeURIComponent(msg(request, "Username contains invalid characters", "Ник содержит недопустимые символы"))}`);
  }

  const { data: currentProfile } = await supabaseAdmin.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();

  let avatarUrl: string | null = currentProfile?.avatar_url ?? null;

  if (removeAvatar) avatarUrl = null;

  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (!avatarFile.type.startsWith("image/")) {
      return redirectWith(request, `error=${encodeURIComponent(msg(request, "Avatar file must be an image", "Файл аватара должен быть изображением"))}`);
    }

    if (avatarFile.size > MAX_AVATAR_BYTES) {
      return redirectWith(request, `error=${encodeURIComponent(msg(request, "Avatar is too large. Maximum is 5MB", "Аватар слишком большой. Максимум 5MB"))}`);
    }

    try {
      avatarUrl = await uploadAvatar(avatarFile, user.id, request);
    } catch (e) {
      const message = e instanceof Error ? e.message : msg(request, "Failed to upload avatar", "Не удалось загрузить аватар");
      return redirectWith(request, `error=${encodeURIComponent(message)}`);
    }
  }

  const { error } = await supabaseAdmin.from("profiles").upsert(
    {
      id: user.id,
      username,
      avatar_url: avatarUrl,
    },
    { onConflict: "id" }
  );

  if (error) {
    return redirectWith(request, `error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/profile");
  return redirectWith(request, `ok=${encodeURIComponent(msg(request, "Profile updated", "Профиль обновлен"))}`);
}
