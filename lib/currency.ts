import type { Locale } from "@/lib/i18n";

export function formatEuro(amount: number | null | undefined, locale: Locale) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(amount ?? 0));
}

export function euroLabel() {
  return "EUR";
}
