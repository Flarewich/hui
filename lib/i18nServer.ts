import { cookies } from "next/headers";
import { resolveLocale, localeCookieName, type Locale } from "@/lib/i18n";

export async function getRequestLocale(): Promise<Locale> {
  const store = await cookies();
  return resolveLocale(store.get(localeCookieName)?.value);
}
