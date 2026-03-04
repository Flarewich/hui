"use client";

import { useRouter } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();

  async function setLocale(nextLocale: Locale) {
    if (nextLocale === locale) return;
    await fetch("/api/lang", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: nextLocale }),
      cache: "no-store",
    });
    router.refresh();
  }

  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-white/15 bg-black/30 text-xs">
      {locales.map((item) => {
        const active = item === locale;
        return (
          <button
            key={item}
            type="button"
            onClick={() => setLocale(item)}
            className={[
              "px-2.5 py-1.5 uppercase transition",
              active ? "bg-white text-black" : "text-white/75 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
