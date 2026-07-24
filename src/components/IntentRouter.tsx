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
import { useCurrentTime } from "@/lib/use-current-time";
import type { CareerGoalKind } from "@/types/command-center";

const FIRST_RUN_GOALS: Array<{ kind: CareerGoalKind; label: string; description: string }> = [
  { kind: "new-job", label: "Get a job", description: "Use my experience for a real job I want." },
  { kind: "update-resume", label: "Build or update my résumé", description: "Start from my work history or an existing résumé." },
  { kind: "practice-interview", label: "Practice for an interview", description: "Prepare for a specific role or interview." }
];

export function IntentRouter() {
  const { state, update, hydrated } = useCommandCenter();
  const router = useRouter();
  const nowIso = useCurrentTime();
  if (!hydrated) return <section className="mx-auto min-h-52 max-w-4xl px-5 pt-8 sm:px-8" aria-label="Loading career goal" />;

  const firstRun = isIntentFirstRun(state);
  const goal = inferCareerGoal(state);
  const nextMove = intentNextMove(state, goal, nowIso);
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
      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14" id="intent-router" aria-labelledby="intent-title">
        <div className="trust-panel p-5 sm:p-8">
          <p className="trust-kicker text-xs font-bold uppercase">Start here</p>
          <h1 id="intent-title" className="mt-2 text-3xl font-bold text-paper sm:text-4xl">What are you trying to do?</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-paper/65">Pick one. Career Forge will take you to the next step.</p>
          <div className="mt-6 grid gap-3">
            {FIRST_RUN_GOALS.map((option) => (
              <button
                key={option.kind}
                type="button"
                onClick={() => selectGoal(option.kind)}
                className="group flex min-h-20 items-center justify-between gap-4 rounded-xl border border-white/15 bg-obsidian/35 p-4 text-left transition hover:border-cyan/60 hover:bg-cyan/10 focus-visible:border-gold"
              >
                <span>
                  <span className="block text-lg font-black text-paper group-hover:text-cyan">{option.label}</span>
                  <span className="mt-1 block text-sm leading-6 text-paper/60">{option.description}</span>
                </span>
                <span className="shrink-0 text-xl text-cyan" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-paper/48">No account. Your résumé and career data stay on this device.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-5 pt-6 sm:px-8 sm:pt-10" id="intent-router" aria-labelledby="intent-title">
      <div className="trust-panel p-5 sm:p-7">
        <p className="trust-kicker text-xs font-bold uppercase">Continue: {careerGoalLabel(state, goal)}</p>
        <div className="mt-3 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gold">Do this next</p>
            <h1 id="intent-title" className="mt-2 text-3xl font-bold text-paper">{nextMove.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-paper/65">{nextMove.detail}</p>
            <Link href={nextMove.href} onClick={() => trackCareerEvent("intent_goal_resumed")} className="lab-pill-button mt-5 inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-black">
              {nextMove.actionLabel} →
            </Link>
          </div>
          <details className="rounded-xl border border-white/12 bg-obsidian/30 p-4 lg:open">
            <summary className="cursor-pointer text-sm font-bold text-paper">Your progress</summary>
            <ul className="mt-3 grid gap-2">
              {milestones.map((milestone) => <li key={milestone.label} className="text-sm text-paper/70"><span className={milestone.complete ? "text-mint" : "text-paper/35"}>{milestone.complete ? "✓" : "○"}</span> {milestone.label}</li>)}
            </ul>
          </details>
        </div>

        {recent.length > 0 && (
          <details className="mt-6 border-t border-white/10 pt-4">
            <summary className="cursor-pointer text-sm font-bold text-cyan">Recent work</summary>
            <ul className="mt-3 grid gap-2 md:grid-cols-3">
              {recent.map((item) => (
                <li key={`${item.id}-${item.href}`}>
                  <Link href={item.href} className="block rounded-lg border border-white/12 bg-white/5 p-3 transition hover:border-cyan/45">
                    <span className="block text-sm font-bold text-paper">{item.label}</span>
                    <span className="mt-1 block text-xs text-paper/50">{item.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}

        <details className="mt-4 border-t border-white/10 pt-4">
          <summary className="cursor-pointer text-sm font-bold text-paper/60">Change goal</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {CAREER_GOALS.filter((option) => option.kind !== goal).map((option) => (
              <button key={option.kind} type="button" onClick={() => selectGoal(option.kind)} className="rounded-md border border-white/15 px-3 py-2 text-sm font-bold text-paper/70 transition hover:border-gold hover:text-gold">
                {option.label}
              </button>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
