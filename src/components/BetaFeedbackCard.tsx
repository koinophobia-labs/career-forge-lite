"use client";

import { useState } from "react";
import { trackCareerEvent } from "@/lib/analytics";
import {
  hasSubmittedBetaFeedback,
  saveBetaFeedbackEntry,
  type BetaEasier,
  type BetaWouldUseAgain
} from "@/lib/beta-feedback-store";

// Shown only after the user has a finished artifact in hand, so value always
// comes before the ask. One quick required tap (easier?), everything else
// optional, then a thank-you. Persists locally via beta-feedback-store.
export function BetaFeedbackCard({ milestone }: { milestone: string }) {
  const [dismissed, setDismissed] = useState(() => hasSubmittedBetaFeedback(milestone));
  const [easier, setEasier] = useState<BetaEasier | null>(null);
  const [wouldUseAgain, setWouldUseAgain] = useState<BetaWouldUseAgain | null>(null);
  const [blocker, setBlocker] = useState("");
  const [testimonial, setTestimonial] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (dismissed && !submitted) return null;

  if (submitted) {
    return (
      <aside className="rounded-xl border border-mint/35 bg-mint/10 p-4" aria-label="Beta feedback submitted">
        <p className="text-sm font-bold text-paper">Thank you — your feedback is saved on this device.</p>
        <p className="mt-1 text-xs leading-5 text-paper/55">It helps shape Career Forge before the wider launch. Nothing left your device.</p>
      </aside>
    );
  }

  function submit() {
    if (!easier || !wouldUseAgain) return;
    saveBetaFeedbackEntry({ milestone, easier, wouldUseAgain, blocker, testimonial });
    trackCareerEvent("beta_feedback_submitted");
    setSubmitted(true);
  }

  const easierOptions: Array<{ value: BetaEasier; label: string }> = [
    { value: "yes", label: "Yes, easier" },
    { value: "same", label: "About the same" },
    { value: "no", label: "No, harder" }
  ];
  const useAgainOptions: Array<{ value: BetaWouldUseAgain; label: string }> = [
    { value: "yes", label: "Yes" },
    { value: "maybe", label: "Maybe" },
    { value: "no", label: "No" }
  ];

  return (
    <aside className="rounded-xl border border-cyan/25 bg-cyan/5 p-5" aria-labelledby="beta-feedback-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="trust-kicker text-xs font-bold uppercase text-cyan">Help shape the beta</p>
          <h3 id="beta-feedback-title" className="mt-1 text-lg font-bold text-paper">You have a finished résumé — how did that go?</h3>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="min-h-11 rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold text-paper/55 transition hover:border-cyan hover:text-cyan"
        >
          Skip
        </button>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-paper">Was this easier than your usual process?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {easierOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={easier === option.value}
              onClick={() => setEasier(option.value)}
              className={`min-h-11 rounded-md border px-3 py-2 text-sm font-bold transition ${easier === option.value ? "border-mint bg-mint/15 text-paper" : "border-white/15 text-paper/65 hover:border-cyan"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-paper">Would you use this for your next application?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {useAgainOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={wouldUseAgain === option.value}
              onClick={() => setWouldUseAgain(option.value)}
              className={`min-h-11 rounded-md border px-3 py-2 text-sm font-bold transition ${wouldUseAgain === option.value ? "border-mint bg-mint/15 text-paper" : "border-white/15 text-paper/65 hover:border-cyan"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className="text-sm font-bold text-paper">What almost stopped you? <span className="font-normal text-paper/45">(optional)</span></span>
        <textarea
          value={blocker}
          onChange={(event) => setBlocker(event.target.value)}
          rows={2}
          className="trust-input mt-1 w-full border px-3 py-2 text-sm text-ink"
          placeholder="A confusing step, a missing option, a moment you nearly gave up…"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-sm font-bold text-paper">Anything you&rsquo;d say about Career Forge? <span className="font-normal text-paper/45">(optional testimonial)</span></span>
        <textarea
          value={testimonial}
          onChange={(event) => setTestimonial(event.target.value)}
          rows={2}
          className="trust-input mt-1 w-full border px-3 py-2 text-sm text-ink"
          placeholder="Only shared if you choose to send it to the owner."
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!easier || !wouldUseAgain}
          className="lab-pill-button min-h-11 px-5 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send feedback
        </button>
        <span className="text-xs text-paper/45">Stored locally · pick the two taps, the rest is optional.</span>
      </div>
    </aside>
  );
}
