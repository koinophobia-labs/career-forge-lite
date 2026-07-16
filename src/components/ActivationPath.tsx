import Link from "next/link";
import { activationStages, currentActivationStage } from "@/lib/activation";
import type { CommandCenterState } from "@/types/command-center";

export function ActivationPath({ state, compact = false }: { state: CommandCenterState; compact?: boolean }) {
  const stages = activationStages(state);
  const current = currentActivationStage(state);
  const completed = stages.filter((stage) => stage.complete).length;

  return (
    <section className="rounded-xl border border-cyan/25 bg-cyan/10 p-5 sm:p-6" aria-labelledby="activation-path-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="trust-kicker text-xs font-bold uppercase">Your five-step path</p>
          <h2 id="activation-path-title" className="mt-2 text-xl font-bold text-paper">
            {completed === stages.length ? "Your workflow is active" : `Next: ${current.label}`}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-paper/65">{current.detail}. Complete steps stay saved on this device.</p>
        </div>
        <Link href={current.href} className="lab-pill-button inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-black transition">
          {current.action} →
        </Link>
      </div>
      <ol className={`mt-5 grid gap-2 ${compact ? "sm:grid-cols-5" : "md:grid-cols-5"}`} aria-label={`${completed} of ${stages.length} activation stages complete`}>
        {stages.map((stage, index) => {
          const isCurrent = stage.id === current.id && !stage.complete;
          return (
            <li key={stage.id} className={`rounded-lg border px-3 py-3 ${stage.complete ? "border-mint/35 bg-mint/10" : isCurrent ? "border-gold/45 bg-gold/10" : "border-white/12 bg-obsidian/25"}`}>
              <span className="lab-mono block text-[0.65rem] font-bold uppercase text-paper/55">
                Step {index + 1} · {stage.complete ? "Complete" : isCurrent ? "Current" : "Upcoming"}
              </span>
              <span className="mt-1 block text-xs font-bold leading-5 text-paper">{stage.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
