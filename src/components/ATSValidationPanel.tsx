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
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-coral">ATS validation</p>
        <h2 className="mt-3 text-3xl font-bold text-ink">Pass or warning checks only.</h2>
        <p className="mt-3 text-ink/70">
          This panel checks resume structure and keyword usefulness without inventing an ATS score.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <div
            key={check.label}
            className={`rounded-md border bg-white p-4 ${
              check.status === "PASS" ? "border-spruce/30" : "border-coral/45"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-bold text-ink">{check.label}</h3>
              <span
                className={`rounded-md px-2 py-1 text-xs font-bold ${
                  check.status === "PASS" ? "bg-mint text-spruce" : "bg-coral/10 text-coral"
                }`}
              >
                {check.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink/70">{check.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
