"use client";

import { useEffect, useState } from "react";

/** Refreshes date-sensitive recommendations without requiring another data edit. */
export function useCurrentTime(refreshMs = 60_000): string {
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());

  useEffect(() => {
    const refresh = () => setNowIso(new Date().toISOString());
    const timer = window.setInterval(refresh, refreshMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshMs]);

  return nowIso;
}
