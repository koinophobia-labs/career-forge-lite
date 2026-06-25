import Link from "next/link";
import type { InterviewModeLimitState } from "@/lib/feature-access";

export function PremiumBadge({ label = "Premium Preview" }: { label?: string }) {
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
        <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan">{state.label}</p>
        <span className="text-xs font-bold text-paper/50">{state.remainingAnswers} left</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-gold transition-all" style={{ width: `${usedPercent}%` }} />
      </div>
    </div>
  );
}

export function UpgradeCallout() {
  return (
    <div className="rounded-md border border-gold/25 bg-gold/10 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-gold">Upgrade-ready architecture</p>
      <p className="mt-2 text-sm leading-6 text-paper/70">
        Interview Mode is planned as a premium feature. This preview shows how the guided interview works without adding
        payments, accounts, or a checkout flow yet.
      </p>
    </div>
  );
}

export function PremiumLockedPanel({ onStartOver }: { onStartOver: () => void }) {
  return (
    <div className="rounded-md border border-gold/30 bg-gold/10 p-5">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-gold">Premium Preview Limit Reached</p>
      <h2 className="mt-3 text-2xl font-bold text-paper">Interview Mode is planned as a premium feature.</h2>
      <p className="mt-3 text-sm leading-6 text-paper/70">
        For now, this preview shows how the guided interview works. No payment system is connected yet.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onStartOver}
          className="rounded-md bg-gold px-4 py-2 text-sm font-black text-ink transition hover:bg-cyan"
        >
          Start Over
        </button>
        <Link
          href="/#demo"
          className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-paper/70 transition hover:border-cyan hover:text-cyan"
        >
          Use Static Builder
        </Link>
      </div>
      <p className="mt-4 text-xs leading-5 text-paper/45">
        TODO: connect this state to auth, billing, and entitlement checks when payments are added.
      </p>
    </div>
  );
}
