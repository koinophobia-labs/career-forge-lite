"use client";

import { runAtsChecks } from "@/lib/ats";
import type { IntakeData, ResumePackage } from "@/types/career";

type ATSValidationPanelProps = {
  data: IntakeData;
  resume: ResumePackage;
};

export function ATSValidationPanel({ data, resume }: ATSValidationPanelProps) {
  const checks = runAtsChecks(data, resume);
  const checkStyle = (status: (typeof checks)[number]["status"]) => {
    if (status === "PASS") return { border: "border-cyan/30", badge: "bg-cyan/12 text-cyan" };
    if (status === "NOT APPLICABLE") return { border: "border-white/15", badge: "bg-white/10 text-paper/60" };
    if (status === "NEEDS REVIEW" || status === "WARNING") return { border: "border-gold/45", badge: "bg-gold/10 text-gold" };
    return { border: "border-ember/45", badge: "bg-ember/12 text-ember" };
  };

  return (
    <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8" id="ats-checks">
      <div className="mb-5 max-w-3xl">
        <p className="trust-kicker text-sm font-bold uppercase">ats://receipts</p>
        <h2 className="mt-3 text-3xl font-bold text-paper">Structure checks, no fake score.</h2>
        <p className="mt-3 text-paper/70">
          A practical audit for headings, structure, skills, action verbs, contact info, and measurable context.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {checks.map((check) => {
          const style = checkStyle(check.status);
          return (
          <div
            key={check.label}
            className={`trust-card rounded-md p-4 ${style.border}`}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-bold text-paper">{check.label}</h3>
              <span
                className={`rounded-md px-2 py-1 text-xs font-bold ${style.badge}`}
              >
                {check.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-paper/70">{check.detail}</p>
          </div>
          );
        })}
      </div>
    </section>
  );
}
