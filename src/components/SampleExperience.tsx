"use client";

import { useState } from "react";

const sample = {
  evidence: [
    ["Direct match", "Resolved difficult SaaS customer issues and documented repeatable fixes."],
    ["Transferred match", "A searchable knowledge-base project supports technical troubleshooting and written communication."],
    ["Explicit gap", "No approved evidence proves Salesforce administration or formal engineering experience."]
  ],
  variants: {
    ats: "ATS Submission · conventional sections, evidence-backed support terms, and compact skills for employer portals.",
    recruiter: "Recruiter / Networking · a human-first story that leads with customer problem-solving and the knowledge-base project."
  }
};

export function SampleExperience() {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<"ats" | "recruiter">("ats");

  return (
    <section className="trust-panel p-5 sm:p-6" aria-labelledby="sample-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="trust-kicker text-xs font-bold uppercase">Disposable sample · never saved</p>
          <h2 id="sample-title" className="mt-2 text-xl font-bold text-paper">See the truth workflow before sharing anything</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-paper/60">Synthetic support experience shows one direct match, one honest transfer, one gap, and why two résumé variants exist.</p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex min-h-11 items-center rounded-md border border-cyan/40 bg-cyan/10 px-4 py-2 text-sm font-bold text-cyan">
          {open ? "Close sample" : "Explore sample pack"}
        </button>
      </div>
      {open && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2" aria-label="Sample data preview">
          <div className="rounded-xl border border-white/12 bg-obsidian/35 p-4">
            <h3 className="font-bold text-paper">Approved evidence and limits</h3>
            <ul className="mt-3 grid gap-2">
              {sample.evidence.map(([label, detail]) => <li key={label} className="rounded-lg border border-white/10 p-3 text-sm leading-5 text-paper/68"><strong className="text-cyan">{label}:</strong> {detail}</li>)}
            </ul>
          </div>
          <div className="rounded-xl border border-white/12 bg-obsidian/35 p-4">
            <h3 className="font-bold text-paper">Two baselines, two jobs</h3>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Choose sample résumé variant">
              {(["ats", "recruiter"] as const).map((kind) => <button key={kind} type="button" aria-pressed={variant === kind} onClick={() => setVariant(kind)} className={`min-h-11 rounded-md border px-4 py-2 text-sm font-bold ${variant === kind ? "border-gold bg-gold/10 text-gold" : "border-white/15 text-paper/65"}`}>{kind === "ats" ? "ATS Submission" : "Recruiter / Networking"}</button>)}
            </div>
            <p className="mt-4 rounded-lg border border-gold/25 bg-gold/10 p-4 text-sm leading-6 text-paper/75">{sample.variants[variant]}</p>
            <p className="mt-3 text-xs leading-5 text-paper/50">Sample next action: paste a real Product Support posting, select the ATS baseline, generate a job-specific variant, and save the application.</p>
          </div>
        </div>
      )}
    </section>
  );
}
