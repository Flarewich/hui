import "./globals.css";
import type { Metadata } from "next";
import Header from "@/components/Header";
import SupportChatWidgetGate from "@/components/SupportChatWidgetGate";
import { getMessages } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18nServer";

const siteName = "WinStrike";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://winstrike.gg";
const metaDescription =
  "WinStrike is a cyber tournament platform with registration, schedules, match rooms, and live competition updates.";

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: metaDescription,
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [{ url: "/ava-v2.png", type: "image/png" }],
    shortcut: [{ url: "/ava-v2.png", type: "image/png" }],
    apple: [{ url: "/ava-v2.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName,
    title: siteName,
    description: metaDescription,
    images: [
      {
        url: "/ava-v2.png",
        width: 512,
        height: 512,
        alt: `${siteName} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: metaDescription,
    images: ["/ava-v2.png"],
  },
};

function SocialIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-500/15 hover:text-cyan-100"
    >
      {children}
    </a>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale();
  const t = getMessages(locale);

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-black text-white flex flex-col">
        <div aria-hidden className="site-global-bg" />
        <div aria-hidden className="site-global-stripes" />
        <div aria-hidden className="site-global-vignette" />

        <div className="relative z-10 flex min-h-screen flex-col">
        <Header />

        <main className="site-neon mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-4 sm:py-6">{children}</main>

        <footer className="relative w-full overflow-hidden border-t border-white/10 bg-black/30">
          <div className="pointer-events-none absolute -left-14 top-0 h-32 w-32 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 bottom-0 h-28 w-28 rounded-full bg-fuchsia-500/15 blur-3xl" />

          <div className="relative mx-auto max-w-6xl px-3 py-6 text-sm text-white/70 sm:px-4 sm:py-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="font-semibold text-white/90">(c) {new Date().getFullYear()} {t.footer.brand}</div>
                <div className="text-white/60">tourniers@win-strike.com</div>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-white/65">
                  <a href="/privacy" className="hover:text-cyan-200">
                    Privacy Policy
                  </a>
                  <a href="/terms" className="hover:text-cyan-200">
                    Terms of Service
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <SocialIconLink href="https://t.me/" label="Telegram">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                    <path d="M20.7 3.3a1.3 1.3 0 0 0-1.35-.23L3.5 9.18a1 1 0 0 0 .05 1.9l3.8 1.15 1.34 4.12a1 1 0 0 0 1.8.27l2.14-2.93 3.72 2.73a1.3 1.3 0 0 0 2.04-.77l2.6-10.9a1.3 1.3 0 0 0-.29-1.45ZM8.3 11.75l8.6-5.25-6.77 6.82-.3 2.4-1.53-3.97Z" />
                  </svg>
                </SocialIconLink>

                <SocialIconLink href="https://discord.gg/wuNPVS7d" label="Discord">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                    <path d="M20.3 4.6a16.2 16.2 0 0 0-4.1-1.3l-.2.4-.5 1a14.7 14.7 0 0 0-6.9 0l-.5-1-.2-.4A16.2 16.2 0 0 0 3.8 4.6C1.2 8.4.5 12.1.9 15.7a16.5 16.5 0 0 0 5 2.5l1.1-1.7a10.6 10.6 0 0 1-1.7-.8l.4-.3a11.8 11.8 0 0 0 10.6 0l.4.3a10.6 10.6 0 0 1-1.7.8l1.1 1.7a16.5 16.5 0 0 0 5-2.5c.5-4.1-.9-7.8-2.8-11.1ZM9.3 13.4c-.8 0-1.4-.8-1.4-1.7s.6-1.7 1.4-1.7 1.4.8 1.4 1.7-.6 1.7-1.4 1.7Zm5.4 0c-.8 0-1.4-.8-1.4-1.7s.6-1.7 1.4-1.7 1.4.8 1.4 1.7-.6 1.7-1.4 1.7Z" />
                  </svg>
                </SocialIconLink>

                <SocialIconLink href="https://www.youtube.com/" label="YouTube">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                    <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31.5 31.5 0 0 0 .5 12a31.5 31.5 0 0 0 .5 4.8A3 3 0 0 0 3.1 19c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31.5 31.5 0 0 0 .5-4.8 31.5 31.5 0 0 0-.5-4.9ZM9.7 15.1V8.9l5.5 3.1-5.5 3.1Z" />
                  </svg>
                </SocialIconLink>
              </div>
            </div>
          </div>
        </footer>
        </div>
        <SupportChatWidgetGate />
      </body>
    </html>
  );
}
