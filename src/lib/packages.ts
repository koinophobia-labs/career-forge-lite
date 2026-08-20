// Career Forge's self-service product contract. Checkout, fulfillment,
// entitlement grants, pricing copy, and release checks all read from here so a
// displayed offer cannot silently differ from the access that is minted.

export type PackageTier = "resume" | "job" | "career" | "all-access";

export type LegacyPackageTier = "reset" | "job-search" | "career-switch";

export type EntitledFeature =
  | "export_baseline_pack"
  | "tailored_resume_export"
  | "outreach_toolkit"
  | "interview_unlimited"
  | "career_bundle_export"
  | "all_access_workflows";

export type PackageDefinition = {
  tier: PackageTier;
  name: string;
  priceUsd: number;
  audience: string;
  summary: string;
  deliverables: string[];
  features: EntitledFeature[];
  laneLimit: number;
  durationDays: number | null;
  usageLimit: string;
  afterPurchase: string;
  badge?: string;
};

export const FREE_OFFER = {
  name: "Free",
  priceUsd: 0,
  audience: "Start with your real work history and see whether Career Forge helps.",
  summary:
    "Import or enter your history, review the evidence Career Forge may use, build one role direction, edit résumé drafts, analyze jobs, track applications, and try six interview answers.",
  usageLimit: "One active role direction. Premium file exports and advanced workflows stay locked.",
  afterPurchase: "No card or account required. Your career data stays in this browser."
} as const;

export const PACKAGES: Record<PackageTier, PackageDefinition> = {
  resume: {
    tier: "resume",
    name: "Resume Pack",
    priceUsd: 9,
    audience: "Best when you need a polished résumé file without rebuilding your whole job search.",
    summary:
      "Turn your reviewed evidence into clean ATS and recruiter résumé files you can edit, inspect, and reuse.",
    deliverables: [
      "ATS résumé export in PDF and DOCX",
      "Recruiter / networking résumé export",
      "Copyable résumé text with its supporting evidence receipt",
      "Repeat exports after you make corrections"
    ],
    features: ["export_baseline_pack"],
    laneLimit: 1,
    durationDays: null,
    usageLimit: "One active role direction. No per-export fee.",
    afterPurchase: "Activates immediately and stays available on devices where you redeem the access code."
  },
  job: {
    tier: "job",
    name: "Job Pack",
    priceUsd: 15,
    audience: "Best when you have a real job posting and want one focused application workflow.",
    summary:
      "Add job-specific résumé tailoring, useful application and outreach drafts, and deeper interview practice to the Resume Pack.",
    deliverables: [
      "Everything in the Resume Pack",
      "Tailored résumé export for a target posting",
      "Application-answer and cover-letter evidence foundation",
      "Recruiter and hiring-manager outreach drafts",
      "Unlimited answers in the conversational interview workflow"
    ],
    features: [
      "export_baseline_pack",
      "tailored_resume_export",
      "outreach_toolkit",
      "interview_unlimited"
    ],
    laneLimit: 1,
    durationDays: null,
    usageLimit: "One active role direction; reuse the workflow for jobs in that direction. No per-export fee.",
    afterPurchase: "Activates immediately and keeps the unlocked Job Pack tools available on redeemed devices.",
    badge: "Best for one application"
  },
  career: {
    tier: "career",
    name: "Career Pack",
    priceUsd: 25,
    audience: "Best when you want one reusable career foundation for several realistic directions.",
    summary:
      "Build the broader résumé, LinkedIn/profile, job-tailoring, outreach, and interview toolkit for an active search or career change.",
    deliverables: [
      "Everything in the Job Pack",
      "LinkedIn headline and About-section drafts",
      "Complete ZIP career bundle with LinkedIn materials",
      "Transferable-skill and transition-positioning sections in the career bundle",
      "Interview story bank and objection practice",
      "Up to three active role directions with résumé drafts"
    ],
    features: [
      "export_baseline_pack",
      "tailored_resume_export",
      "outreach_toolkit",
      "interview_unlimited",
      "career_bundle_export"
    ],
    laneLimit: 3,
    durationDays: null,
    usageLimit: "Up to three active role directions. No per-export fee.",
    afterPurchase: "Activates immediately and keeps the Career Pack features available on redeemed devices."
  },
  "all-access": {
    tier: "all-access",
    name: "30-Day All Access",
    priceUsd: 39,
    audience: "Best when you are applying broadly and want the least friction for the next month.",
    summary:
      "Use every paid Career Forge workflow across a generous set of role directions during a concentrated 30-day search.",
    deliverables: [
      "Every Resume, Job, and Career Pack workflow",
      "PDF, DOCX, ZIP, and tailored résumé exports",
      "Outreach, application, LinkedIn/profile, and interview tools",
      "Up to ten active role directions during the access window",
      "Clear expiration date shown wherever access is managed"
    ],
    features: [
      "export_baseline_pack",
      "tailored_resume_export",
      "outreach_toolkit",
      "interview_unlimited",
      "career_bundle_export",
      "all_access_workflows"
    ],
    laneLimit: 10,
    durationDays: 30,
    usageLimit: "Up to ten active role directions and no per-export fee for 30 days after purchase.",
    afterPurchase: "Activates immediately. Access expires exactly 30 days after the Stripe purchase time.",
    badge: "Best for an active search"
  }
};

export const PACKAGE_ORDER: PackageTier[] = ["resume", "job", "career", "all-access"];

export function isPackageTier(value: unknown): value is PackageTier {
  return value === "resume" || value === "job" || value === "career" || value === "all-access";
}

export function isLegacyPackageTier(value: unknown): value is LegacyPackageTier {
  return value === "reset" || value === "job-search" || value === "career-switch";
}

export function normalizePackageTier(value: unknown): PackageTier | null {
  if (isPackageTier(value)) return value;
  if (value === "reset") return "resume";
  if (value === "job-search") return "job";
  if (value === "career-switch") return "career";
  return null;
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

export function packageDurationSeconds(tier: PackageTier): number | null {
  const days = PACKAGES[tier].durationDays;
  return days === null ? null : days * 24 * 60 * 60;
}

export function highestPackageTier(tiers: Iterable<PackageTier>): PackageTier | null {
  const owned = new Set(tiers);
  for (let index = PACKAGE_ORDER.length - 1; index >= 0; index -= 1) {
    const tier = PACKAGE_ORDER[index];
    if (owned.has(tier)) return tier;
  }
  return null;
}
