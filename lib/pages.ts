import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function getSitePage(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("site_pages")
    .select("slug, title, content_md, updated_at")
    .eq("slug", slug)
    .single();

  if (error) throw new Error(error.message);
  return data;
}