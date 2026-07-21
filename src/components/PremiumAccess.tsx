"use client";

import Link from "next/link";
import { useEntitlement } from "@/lib/entitlement";
import type { InterviewModeLimitState } from "@/lib/feature-access";
import { PACKAGES } from "@/lib/packages";

export function PremiumBadge({ label = "Beta Preview" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-cyan/25 bg-cyan/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan">
      {label}
    </span>
  );
}

export function PremiumPreviewMeter({ state }: { state: InterviewModeLimitState }) {
  const usedPercent = Math.min((state.answerCount / state.answerLimit) * 100, 100);

  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan">
          Preview answers used: {Math.min(state.answerCount, state.answerLimit)} of {state.answerLimit}
        </p>
        <span className="text-xs font-bold text-paper/50">{state.remainingAnswers} left</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-gold transition-all" style={{ width: `${usedPercent}%` }} />
      </div>
    </div>
  );
}

export function UpgradeCallout() {
  const { commerceEnabled } = useEntitlement();

  return (
    <div className="rounded-md border border-gold/25 bg-gold/10 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-gold">
        {commerceEnabled ? "Free preview" : "Beta Preview"}
      </p>
      <p className="mt-2 text-sm leading-6 text-paper/70">
        {commerceEnabled ? (
          <>
            Six free answers to see how the conversational interview works. The{" "}
            <Link href="/pricing" className="font-bold text-gold underline hover:text-cyan">
              Job Search Pack
            </Link>{" "}
            removes the limit.
          </>
        ) : (
          "This conversational path is still being tested. Use it for a quick preview, or use the guided builder for the clearest flow."
        )}
      </p>
    </div>
  );
}

export function PremiumLockedPanel({ hasGeneratedResume, onStartOver, onViewResume }: { hasGeneratedResume?: boolean; onStartOver: () => void; onViewResume?: () => void }) {
  const { commerceEnabled } = useEntitlement();
  const pack = PACKAGES["job-search"];

  return (
    <div className="rounded-md border border-gold/30 bg-gold/10 p-5">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-gold">Preview limit reached</p>
      <h2 className="mt-3 text-2xl font-bold text-paper">You have used the free interview preview.</h2>
      <p className="mt-3 text-sm leading-6 text-paper/70">
        {commerceEnabled
          ? `The full conversational interview — unlimited answers, deeper follow-ups — is part of the ${pack.name} ($${pack.priceUsd}, one-time). Your answers so far are saved on this device.`
          : "The preview is intentionally limited while this mode is being tested. The guided builder remains fully open."}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        {commerceEnabled && (
          <Link
            href="/pricing"
            className="rounded-md bg-gold px-4 py-2 text-sm font-black text-ink transition hover:bg-cyan"
          >
            See the {pack.name} →
          </Link>
        )}
        {hasGeneratedResume && onViewResume && (
          <button
            type="button"
            onClick={onViewResume}
            className="rounded-md bg-cyan px-4 py-2 text-sm font-black text-ink transition hover:bg-gold"
          >
            View Generated Resume
          </button>
        )}
        <button
          type="button"
          onClick={onStartOver}
          className={`rounded-md px-4 py-2 text-sm font-black transition ${commerceEnabled ? "border border-white/15 bg-white/5 text-paper/70 hover:border-cyan hover:text-cyan" : "bg-gold text-ink hover:bg-cyan"}`}
        >
          Start Over
        </button>
        <Link
          href="/resume-builder#demo"
          className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-paper/70 transition hover:border-cyan hover:text-cyan"
        >
          Use Guided Builder
        </Link>
      </div>
      <p className="mt-4 text-xs leading-5 text-paper/45">
        No account needed — a one-time access code unlocks your purchase, and your career data stays on this device.
      </p>
    </div>
  );
}
