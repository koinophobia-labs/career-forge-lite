"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackCareerEvent } from "@/lib/analytics";
import {
  CAREER_GOALS,
  careerGoalLabel,
  goalEntryAction,
  inferCareerGoal,
  intentMilestones,
  intentNextMove,
  isIntentFirstRun,
  recentCareerItems
} from "@/lib/intent-router";
import { useCommandCenter } from "@/lib/use-command-center";
import type { CareerGoalKind } from "@/types/command-center";

const FIRST_RUN_GOALS: Array<{ kind: CareerGoalKind; label: string; description: string }> = [
  { kind: "new-job", label: "Get a job", description: "Use my experience for a real job I want." },
  { kind: "update-resume", label: "Build or update my résumé", description: "Start from my work history or an existing résumé." },
  { kind: "practice-interview", label: "Practice for an interview", description: "Prepare for a specific role or interview." }
];

const OUTCOME_CHIPS = ["Role-fit map", "Truth-checked résumé", "Interview stories"];

export function IntentRouter() {
  const { state, update, hydrated } = useCommandCenter();
  const router = useRouter();
  if (!hydrated) return <section className="mx-auto min-h-52 max-w-4xl px-5 pt-8 sm:px-8" aria-label="Loading career goal" />;

  const firstRun = isIntentFirstRun(state);
  const goal = inferCareerGoal(state);
  const nextMove = intentNextMove(state, goal);
  const recent = recentCareerItems(state);
  const milestones = intentMilestones(state);

  function selectGoal(kind: CareerGoalKind) {
    const now = new Date().toISOString();
    const selectedAt = state.activeGoal?.kind === kind ? state.activeGoal.selectedAt : now;
    const nextState = { ...state, activeGoal: { kind, selectedAt, updatedAt: now } };
    update(() => nextState);
    trackCareerEvent("intent_goal_selected");
    router.push(goalEntryAction(nextState, kind).href);
  }

  if (firstRun) {
    return (
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14" id="intent-router" aria-labelledby="intent-title">
        <div className="career-hero-panel p-5 sm:p-8 lg:p-10">
          <div className="relative z-10 grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-12">
            <div>
              <p className="trust-kicker text-xs font-bold uppercase">Your private career studio</p>
              <p className="mt-5 max-w-md text-sm font-bold uppercase tracking-[0.14em] text-cyan">Experience becomes evidence. Evidence becomes momentum.</p>
              <h1 id="intent-title" className="mt-3 max-w-xl text-4xl font-bold leading-[1.04] text-paper sm:text-5xl">
                What are you trying to do?
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-paper/65">
                Pick one. Career Forge will take you to the next step. From there, it turns the experience you approve into the next useful piece of your job search.
              </p>

              <div className="mt-6 flex flex-wrap gap-2" aria-label="Career Forge outcomes">
                {OUTCOME_CHIPS.map((chip) => <span key={chip} className="career-proof-chip">{chip}</span>)}
              </div>

              <div className="career-paper-card mt-7 max-w-xl p-4">
                <p className="text-sm font-bold text-paper">Built around your real work, not invented polish.</p>
                <p className="mt-1 text-xs leading-5 text-paper/52">No account required. Your résumé and career data stay on this device, and you approve every claim before it enters a draft.</p>
              </div>
            </div>

            <div className="grid gap-3">
              <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-paper/42">Choose your starting point</p>
              {FIRST_RUN_GOALS.map((option, index) => (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => selectGoal(option.kind)}
                  className="career-path-card group flex min-h-24 items-center gap-4 p-4 text-left sm:p-5"
                >
                  <span className="career-path-number" aria-hidden="true">0{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-black text-paper transition group-hover:text-cyan sm:text-xl">{option.label}</span>
                    <span className="mt-1 block text-sm leading-6 text-paper/58">{option.description}</span>
                  </span>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/10 text-lg text-cyan transition group-hover:border-cyan/60 group-hover:bg-cyan/20" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-5 pt-6 sm:px-8 sm:pt-10" id="intent-router" aria-labelledby="intent-title">
      <div className="career-hero-panel p-5 sm:p-8">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="trust-kicker text-xs font-bold uppercase">Continue: {careerGoalLabel(state, goal)}</p>
            <span className="career-proof-chip">One clear next step</span>
          </div>

          <div className="mt-5 grid gap-7 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan">Do this next</p>
              <h1 id="intent-title" className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-paper sm:text-4xl">{nextMove.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/65">{nextMove.detail}</p>
              <Link href={nextMove.href} onClick={() => trackCareerEvent("intent_goal_resumed")} className="lab-pill-button mt-6 inline-flex min-h-12 items-center px-5 py-3 text-sm font-black">
                {nextMove.actionLabel} →
              </Link>
            </div>

            <div className="career-paper-card p-4 sm:p-5">
              <p className="text-sm font-bold text-paper">Your progress</p>
              <ul className="mt-4 grid gap-2.5">
                {milestones.map((milestone) => (
                  <li key={milestone.label} className="flex items-center gap-3 text-sm text-paper/70">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black ${milestone.complete ? "border-mint/40 bg-mint/10 text-mint" : "border-white/12 bg-white/5 text-paper/32"}`}>
                      {milestone.complete ? "✓" : "○"}
                    </span>
                    {milestone.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {recent.length > 0 && (
            <details className="mt-7 border-t border-white/10 pt-5">
              <summary className="cursor-pointer text-sm font-bold text-cyan">Recent work</summary>
              <ul className="mt-3 grid gap-3 md:grid-cols-3">
                {recent.map((item) => (
                  <li key={`${item.id}-${item.href}`}>
                    <Link href={item.href} className="career-paper-card block p-4 transition hover:border-cyan/45 hover:bg-cyan/5">
                      <span className="block text-sm font-bold text-paper">{item.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-paper/50">{item.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <details className="mt-5 border-t border-white/10 pt-5">
            <summary className="cursor-pointer text-sm font-bold text-paper/58">Change goal</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {CAREER_GOALS.filter((option) => option.kind !== goal).map((option) => (
                <button key={option.kind} type="button" onClick={() => selectGoal(option.kind)} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-paper/70 transition hover:border-gold hover:text-gold">
                  {option.label}
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
