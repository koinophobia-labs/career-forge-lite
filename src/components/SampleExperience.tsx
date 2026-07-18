"use client";

import { useState } from "react";
import { createVariantFile, downloadBlob } from "@/lib/pack-export";
import type { ResumeVariant } from "@/types/dossier";

// A complete, finished sample document built by the REAL export engine from
// synthetic data — pre-purchase (and pre-any-data-entry) visibility into the
// actual output quality, not a description of it.
const sampleDossier = {
  id: "sample", identity: { fullName: "Sample Candidate", email: "sample@example.com", phone: "(555) 010-0000", location: "Portland, OR", links: [] },
  roles: [], projects: [], education: [], responsibilities: [], tools: [], transferableSkills: [], outcomes: [], metrics: [],
  proofPoints: [], interviewStories: [], constraints: [], preferredWorkStyle: [], careerGoals: [], targetRoleInterests: [],
  approvedClaims: [], evidence: [], unstructuredNotes: [], migrationReview: [],
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
};
const sampleVariant = {
  id: "sample-variant", laneId: "sample-lane", kind: "ats", title: "Sample", status: "current", canonical: true, userEdited: false,
  resume: {
    summary: "Product Support candidate. Resolved 3,800 support tickets across four years with a 96% satisfaction rating. Wrote 45 knowledge-base articles adopted as team canon.",
    coreSkills: ["Ticket Triage", "Customer Communication", "Knowledge Base Writing", "Zendesk"],
    experience: [
      { title: "Customer Support Specialist", company: "HelpDesk Co", time: "2021–2025", bullets: ["Resolved 3,800 tickets with a 96% satisfaction rating", "Wrote 45 knowledge-base articles adopted as team canon", "Trained 6 new support agents through onboarding"], kind: "role" as const },
      { title: "Searchable Knowledge Base Rebuild", company: "", time: "2024", bullets: ["Reorganized 300 articles into a searchable taxonomy, cutting time-to-answer 40%"], kind: "project" as const }
    ],
    education: "B.A. Communications — State University | 2020",
    linkedinHeadline: "Product Support Specialist", linkedinSummary: ""
  },
  template: "Modern ATS", evidenceReferences: [], userAuthoredPaths: [],
  sectionOrder: ["summary", "skills", "experience", "projects", "education"],
  sourceDossierUpdatedAt: "2026-01-01T00:00:00.000Z", baselineVariantId: null, applicationId: null,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
} as unknown as ResumeVariant;

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
            <button
              type="button"
              onClick={() => {
                void createVariantFile(sampleVariant, sampleDossier, "Product Support", "pdf").then((file) =>
                  downloadBlob(file.blob, "Career-Forge-Sample-Resume.pdf")
                );
              }}
              className="mt-3 inline-flex min-h-11 items-center rounded-md border border-mint/40 bg-mint/10 px-4 py-2 text-sm font-bold text-mint transition hover:bg-mint hover:text-ink"
            >
              Download the finished sample PDF (synthetic data) ↓
            </button>
            <p className="mt-3 text-xs leading-5 text-paper/50">The PDF is generated right now by the same engine that will build yours — nothing is mocked. Sample next action: paste a real Product Support posting, select the ATS baseline, generate a job-specific variant, and save the application.</p>
          </div>
        </div>
      )}
    </section>
  );
}
