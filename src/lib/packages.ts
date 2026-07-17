// Career Forge packaging configuration. Prices remain product hypotheses until
// production re-audits and human willingness-to-pay evidence support them.
// Server routes, client rendering, and entitlement grants read from this file.

export type PackageTier = "reset" | "job-search" | "career-switch";

export type EntitledFeature =
  | "export_baseline_pack"
  | "tailored_resume_export"
  | "outreach_toolkit"
  | "interview_unlimited"
  | "career_switch_toolkit";

export type PackageDefinition = {
  tier: PackageTier;
  name: string;
  priceUsd: number;
  audience: string;
  summary: string;
  deliverables: string[];
  features: EntitledFeature[];
  laneLimit: number;
};

export const PACKAGES: Record<PackageTier, PackageDefinition> = {
  reset: {
    tier: "reset",
    name: "Career Reset Pack",
    priceUsd: 49,
    audience: "You need to clean up or restart your job search.",
    summary:
      "Build one reviewed, reusable career foundation with distinct résumé drafts, LinkedIn positioning drafts, and source-linked evidence you can inspect.",
    deliverables: [
      "ATS and recruiter résumé drafts for one lane",
      "Professional-summary draft grounded in reviewed evidence",
      "LinkedIn headline and About drafts",
      "Role-direction suggestions with reasons",
      "Reusable application-answer drafts",
      "PDF, DOCX, and bundle export"
    ],
    features: ["export_baseline_pack"],
    laneLimit: 1
  },
  "job-search": {
    tier: "job-search",
    name: "Job Search Pack",
    priceUsd: 79,
    audience: "You are actively applying to a specific kind of role.",
    summary:
      "Adds job-specific tailoring, evidence-backed outreach drafting, and interview practice to the reviewed Career Reset foundation.",
    deliverables: [
      "Everything in the Career Reset scope",
      "Job-specific résumé drafts for analyzed postings",
      "Cover-letter evidence foundation",
      "Recruiter outreach drafting workflow",
      "Hiring-manager outreach drafting workflow",
      "Interview story bank and practice interview",
      "Second résumé lane for a backup direction"
    ],
    features: ["export_baseline_pack", "tailored_resume_export", "outreach_toolkit", "interview_unlimited"],
    laneLimit: 2
  },
  "career-switch": {
    tier: "career-switch",
    name: "Career Switch Pack",
    priceUsd: 99,
    audience: "You are moving into a new industry or kind of work.",
    summary:
      "Adds transferable-skill analysis, transition-narrative drafting, and objection practice for up to three role directions.",
    deliverables: [
      "Everything in the Job Search scope",
      "Transferable-skill analysis",
      "Transition-narrative draft for interviews and outreach",
      "Interview objection practice",
      "Up to three résumé lanes with draft packs",
      "Career-switch positioning drafts for LinkedIn"
    ],
    features: [
      "export_baseline_pack",
      "tailored_resume_export",
      "outreach_toolkit",
      "interview_unlimited",
      "career_switch_toolkit"
    ],
    laneLimit: 3
  }
};

export const PACKAGE_ORDER: PackageTier[] = ["reset", "job-search", "career-switch"];

export function isPackageTier(value: unknown): value is PackageTier {
  return value === "reset" || value === "job-search" || value === "career-switch";
}

export function getPackage(tier: PackageTier): PackageDefinition {
  return PACKAGES[tier];
}

export function tierHasFeature(tier: PackageTier | null, feature: EntitledFeature): boolean {
  if (!tier) return false;
  return PACKAGES[tier].features.includes(feature);
}

export function tierLaneLimit(tier: PackageTier | null): number {
  if (!tier) return 1;
  return PACKAGES[tier].laneLimit;
}
