"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SAVE_ERROR_EVENT } from "@/lib/command-center-store";
import { useCommandCenter } from "@/lib/use-command-center";

// Affirmative save visibility: every write to the command center is
// synchronous localStorage persistence, but users can't see that — "did it
// save?" is a real first-time-user anxiety. This pill makes the state
// explicit on every page: green when saved (with a live timestamp after any
// change this session), red with a recovery path if a write ever fails.
export function SaveStatusPill() {
  const { state, hydrated } = useCommandCenter();
  const [changedAt, setChangedAt] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    // The first state observation is the initial load, not a user change.
    if (first.current) {
      first.current = false;
      return;
    }
    setChangedAt(new Date());
    setFailed(false);
  }, [state]);

  useEffect(() => {
    const onSaveError = () => setFailed(true);
    window.addEventListener(SAVE_ERROR_EVENT, onSaveError);
    return () => window.removeEventListener(SAVE_ERROR_EVENT, onSaveError);
  }, []);

  if (!hydrated) return null;

  if (failed) {
    return (
      <Link
        href="/settings"
        data-testid="save-status"
        className="lab-mono inline-flex items-center gap-1.5 rounded-full border border-ember/60 bg-ember/15 px-3 py-1 text-[0.62rem] font-bold uppercase text-ember"
      >
        <span aria-hidden="true">⚠</span> Save failed — back up now
      </Link>
    );
  }

  return (
    <span
      data-testid="save-status"
      role="status"
      className="lab-mono inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-[0.62rem] font-bold uppercase text-mint"
    >
      <span aria-hidden="true">✓</span>
      {changedAt
        ? `Saved on this device · ${changedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
        : "Saved on this device"}
    </span>
  );
}
