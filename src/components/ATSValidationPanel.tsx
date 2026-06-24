"use client";

import { runAtsChecks } from "@/lib/ats";
import type { IntakeData, ResumePackage } from "@/types/career";

type ATSValidationPanelProps = {
  data: IntakeData;
  resume: ResumePackage;
};

export function ATSValidationPanel({ data, resume }: ATSValidationPanelProps) {
  const checks = runAtsChecks(data, resume);

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
        {checks.map((check) => (
          <div
            key={check.label}
            className={`trust-card rounded-md p-4 ${
              check.status === "PASS" ? "border-cyan/30" : "border-ember/45"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-bold text-paper">{check.label}</h3>
              <span
                className={`rounded-md px-2 py-1 text-xs font-bold ${
                  check.status === "PASS" ? "bg-cyan/12 text-cyan" : "bg-ember/12 text-ember"
                }`}
              >
                {check.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-paper/70">{check.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
