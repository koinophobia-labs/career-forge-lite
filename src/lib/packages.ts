// Career Forge paid packaging — the single source of truth for what is sold,
// what it costs, and what each purchase unlocks. Server routes price from this
// config; the client renders from it; entitlements grant from it. Nothing
// about packaging should be decided anywhere else.
//
// Prices are PRODUCT HYPOTHESES, not validated commercial truth. No
// willingness-to-pay evidence exists yet (docs/CAREER_FORGE_MARKET_MAP_2026.md
// deliberately proposes no price). Change them here and they change everywhere.

export type PackageTier = "reset" | "job-search" | "career-switch";

// Machine-checkable grants. UI gates check these — never tier names — so
// repackaging deliverables never requires touching gate logic.
export type EntitledFeature =
  | "export_baseline_pack" // PDF/DOCX/ZIP + full-text copy of baseline lane packs
  | "tailored_resume_export" // job-specific tailored résumé generation + export
  | "outreach_toolkit" // recruiter / hiring-manager message templates
  | "interview_unlimited" // conversational interview mode beyond the free preview
  | "career_switch_toolkit"; // transferable-skills, transition narrative, objection prep

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
      "Turn your real history into one approved, reusable foundation: a polished master résumé, LinkedIn positioning, and answers you can reuse on every application.",
    deliverables: [
      "Polished master résumé (ATS and recruiter versions)",
      "Professional summary grounded in your approved facts",
      "LinkedIn headline and About section",
      "Target-role recommendations with reasons",
      "Reusable application answers",
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
      "Everything in Career Reset, plus job-specific tailoring, outreach messages, and interview preparation for the lane you are actually pursuing.",
    deliverables: [
      "Everything in Career Reset Pack",
      "Tailored résumé for each job post you analyze",
      "Cover letter foundation",
      "Recruiter outreach message templates",
      "Hiring-manager outreach message templates",
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
      "Everything in Job Search, plus transferable-skills analysis, a transition narrative, and objection handling for up to three credible directions.",
    deliverables: [
      "Everything in Job Search Pack",
      "Transferable-skills analysis",
      "Transition narrative for interviews and outreach",
      "Interview objection handling",
      "Up to three résumé lanes with full packs",
      "Career-switch positioning for LinkedIn"
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

// Feature checks always go through the tier's package definition, so a
// tampered tier string grants nothing and upgrades are pure config.
export function tierHasFeature(tier: PackageTier | null, feature: EntitledFeature): boolean {
  if (!tier) return false;
  return PACKAGES[tier].features.includes(feature);
}

export function tierLaneLimit(tier: PackageTier | null): number {
  if (!tier) return 1; // Free: build and preview one lane before buying.
  return PACKAGES[tier].laneLimit;
}
