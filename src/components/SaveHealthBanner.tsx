"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SAVE_ERROR_EVENT } from "@/lib/command-center-store";

// Shown only after a localStorage write fails (almost always storage quota).
// The in-memory state is still intact at that moment, so the one useful move
// is downloading a backup before the tab closes.
export function SaveHealthBanner() {
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    const onSaveError = () => setSaveFailed(true);
    window.addEventListener(SAVE_ERROR_EVENT, onSaveError);
    return () => window.removeEventListener(SAVE_ERROR_EVENT, onSaveError);
  }, []);

  if (!saveFailed) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ember/50 bg-ink/95 px-5 py-3 text-sm text-paper backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="leading-6">
          <span className="font-black text-ember">Your latest changes could not be saved to this browser</span> — its
          storage is likely full. Your work is still open in this tab. Download a backup now so nothing is lost.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="rounded-md bg-ember px-4 py-2 text-sm font-black text-ink transition hover:bg-gold"
          >
            Download backup
          </Link>
          <button
            type="button"
            onClick={() => setSaveFailed(false)}
            className="rounded-md border border-white/20 px-3 py-2 text-xs font-bold text-paper/70 transition hover:text-paper"
            aria-label="Dismiss save warning"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
