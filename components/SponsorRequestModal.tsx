"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export default function SponsorRequestModal({
  locale,
  isAuthenticated,
  defaultEmail,
  defaultName,
}: {
  locale: Locale;
  isAuthenticated: boolean;
  defaultEmail?: string | null;
  defaultName?: string | null;
}) {
  const isEn = locale === "en";
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fullName, setFullName] = useState(defaultName ?? "");
  const [brandName, setBrandName] = useState("");
  const [contactEmail, setContactEmail] = useState(defaultEmail ?? "");
  const [contactDetails, setContactDetails] = useState("");
  const [offerSummary, setOfferSummary] = useState("");

  async function submit() {
    setError("");
    setSuccess("");

    if (!fullName.trim() || !contactEmail.trim() || !contactDetails.trim() || !offerSummary.trim()) {
      setError(isEn ? "Fill all required fields." : "Заполните все обязательные поля.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/sponsor-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          brandName,
          contactEmail,
          contactDetails,
          offerSummary,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || "Failed to send request");
      }

      setSuccess(isEn ? "Request sent to admins." : "Заявка отправлена администраторам.");
      setOfferSummary("");
      setContactDetails("");
      setBrandName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : isEn ? "Failed to send request." : "Не удалось отправить заявку.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90"
      >
        {isEn ? "Become sponsor" : "Стать спонсором"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#08101f] p-5 shadow-2xl shadow-cyan-950/30">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">{isEn ? "Sponsor request" : "Заявка на спонсорство"}</h3>
                <p className="mt-2 text-sm text-white/65">
                  {isEn
                    ? "Tell us about yourself, your contacts and what you can offer."
                    : "Расскажите о себе, оставьте контакты и опишите, что вы можете предложить."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5"
              >
                {isEn ? "Close" : "Закрыть"}
              </button>
            </div>

            {!isAuthenticated ? (
              <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                {isEn
                  ? "Sign in first so admins can link the request to your profile."
                  : "Сначала войдите в аккаунт, чтобы админы могли связать заявку с вашим профилем."}
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={120}
                    placeholder={isEn ? "Full name*" : "Имя / ФИО*"}
                    className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                  />
                  <input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    maxLength={160}
                    placeholder={isEn ? "Brand / company" : "Бренд / компания"}
                    className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    maxLength={160}
                    placeholder={isEn ? "Contact email*" : "Email для связи*"}
                    className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                  />
                  <input
                    value={contactDetails}
                    onChange={(e) => setContactDetails(e.target.value)}
                    maxLength={500}
                    placeholder={isEn ? "Telegram / Discord / phone / website*" : "Telegram / Discord / телефон / сайт*"}
                    className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                  />
                </div>

                <textarea
                  value={offerSummary}
                  onChange={(e) => setOfferSummary(e.target.value)}
                  maxLength={3000}
                  rows={7}
                  placeholder={
                    isEn
                      ? "Describe why you want to become a sponsor and what you can offer.*"
                      : "Опишите, почему вы хотите стать спонсором и что вы можете предложить.*"
                  }
                  className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
                />

                {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
                {success && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</div>}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={sending}
                    className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? (isEn ? "Sending..." : "Отправка...") : isEn ? "Send request" : "Отправить заявку"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-white/15 bg-black/25 px-5 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/5"
                  >
                    {isEn ? "Cancel" : "Отмена"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
