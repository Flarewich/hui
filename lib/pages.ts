import { getDefaultSitePage } from "@/lib/defaultSitePages";
import type { Locale } from "@/lib/i18n";
import { pgMaybeOne } from "@/lib/postgres";

function hasCyrillic(value: string | null | undefined) {
  if (!value) return false;
  return /[А-Яа-яЁё]/.test(value);
}

export async function getSitePage(slug: string, locale: Locale = "ru") {
  const data = await pgMaybeOne<{
    slug: string;
    title: string;
    content_md: string;
    updated_at: string | null;
  }>(
    `
      select slug, title, content_md, updated_at
      from site_pages
      where slug = $1
      limit 1
    `,
    [slug]
  );

  if (!data) {
    const fallback = getDefaultSitePage(slug, locale);
    if (fallback) {
      return {
        slug,
        title: fallback.title,
        content_md: fallback.content_md,
        updated_at: null,
      };
    }
    throw new Error(`Site page '${slug}' was not found`);
  }

  // If EN requested but DB content is still RU-only, use EN fallback.
  if (locale === "en") {
    const fallbackEn = getDefaultSitePage(slug, "en");
    if (fallbackEn && (hasCyrillic(data.title) || hasCyrillic(data.content_md))) {
      return {
        slug,
        title: fallbackEn.title,
        content_md: fallbackEn.content_md,
        updated_at: data.updated_at ?? null,
      };
    }
  }

  return data;
}
