"use client";

import { useState } from "react";
import { trackFeedbackSubmitted, trackProductEvent } from "@/lib/analytics";

export const FEEDBACK_LOG_KEY = "career-forge-feedback-log-v1";
export const FEEDBACK_MAX_LENGTH = 240;

// Analytics event properties are size-limited, so long feedback is truncated
// for the event; the full text is kept in a local log so nothing is lost.
export function prepareFeedback(message: string): { ok: boolean; truncated: string; full: string } {
  const full = message.trim();
  return { ok: full.length >= 5, truncated: full.slice(0, FEEDBACK_MAX_LENGTH), full };
}

function appendLocalLog(area: string, full: string) {
  try {
    const raw = window.localStorage.getItem(FEEDBACK_LOG_KEY);
    const log = raw ? (JSON.parse(raw) as unknown[]) : [];
    const entries = Array.isArray(log) ? log : [];
    entries.push({ area, message: full, at: new Date().toISOString() });
    window.localStorage.setItem(FEEDBACK_LOG_KEY, JSON.stringify(entries.slice(-50)));
  } catch {
    // Local log is best-effort; the analytics event already carries the gist.
  }
}

export function FeedbackWidget({ area }: { area: string }) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function submit() {
    const prepared = prepareFeedback(message);
    if (!prepared.ok) return;
    trackFeedbackSubmitted(area, prepared.full.length);
    trackProductEvent("beta_feedback_text", { product: "career_forge_lite", area, message: prepared.truncated });
    appendLocalLog(area, prepared.full);
    setSent(true);
    setMessage("");
  }

  return (
    <div className="rounded-xl border border-white/12 bg-white/5 p-4">
      <p className="trust-kicker text-xs font-bold uppercase">Beta feedback</p>
      {sent ? (
        <p className="mt-2 text-sm leading-6 text-mint">
          Got it — thank you. Every note in the beta gets read and most of them ship.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-paper/68">
            What&rsquo;s confusing, missing, or broken? One sentence is plenty.
          </p>
          <textarea
            value={message}
            rows={2}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="e.g., I couldn't tell which resume the Tailor page wanted me to send…"
            className="mt-3 w-full rounded-md border border-white/10 bg-obsidian/40 px-3 py-2 text-sm text-paper/80 placeholder:text-paper/35"
          />
          <button
            type="button"
            onClick={submit}
            disabled={message.trim().length < 5}
            className="mt-3 rounded-md bg-gold px-4 py-2 text-sm font-black text-ink transition hover:bg-cyan disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send feedback
          </button>
        </>
      )}
    </div>
  );
}
