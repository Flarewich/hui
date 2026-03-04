"use client";

import { useEffect, useState } from "react";

export default function TeamSizeLive({
  teamId,
  initialCount,
  limit,
  locale = "ru",
}: {
  teamId: string;
  initialCount: number;
  limit: number;
  locale?: "ru" | "en";
}) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const response = await fetch(`/api/teams/${teamId}/size`, { cache: "no-store" });
      if (!response.ok) return;

      const payload = (await response.json()) as { count?: number };
      if (!cancelled && typeof payload.count === "number") {
        setCount(payload.count);
      }
    }

    const timer = window.setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [teamId]);

  return (
    <div className="mt-1 text-[11px] font-normal text-emerald-200/80">
      {locale === "en" ? "Team size" : "Состав команды"}: {count}/{limit}
    </div>
  );
}
