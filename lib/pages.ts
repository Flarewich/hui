import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getDefaultSitePage } from "@/lib/defaultSitePages";
import type { Locale } from "@/lib/i18n";

function hasCyrillic(value: string | null | undefined) {
  if (!value) return false;
  return /[А-Яа-яЁё]/.test(value);
}

export async function getSitePage(slug: string, locale: Locale = "ru") {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("site_pages")
    .select("slug, title, content_md, updated_at")
    .eq("slug", slug)
    .single();

  if (error) {
    const fallback = getDefaultSitePage(slug, locale);
    if (fallback) {
      return {
        slug,
        title: fallback.title,
        content_md: fallback.content_md,
        updated_at: null,
      };
    }
    throw new Error(error.message);
  }

  // If EN requested but DB content is still RU-only, use EN fallback.
  if (locale === "en") {
    const fallbackEn = getDefaultSitePage(slug, "en");
    if (fallbackEn && (hasCyrillic(data?.title) || hasCyrillic(data?.content_md))) {
      return {
        slug,
        title: fallbackEn.title,
        content_md: fallbackEn.content_md,
        updated_at: data?.updated_at ?? null,
      };
    }
  }

  return data;
}
