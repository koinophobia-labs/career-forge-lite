"use client";

import { track } from "@vercel/analytics";

type AnalyticsValue = string | number | boolean;
type AnalyticsProperties = Record<string, AnalyticsValue>;

export type CareerForgeEventName =
  | "dossier_started"
  | "dossier_evidence_added"
  | "resume_pack_imported"
  | "dossier_completed"
  | "lane_recommended"
  | "lane_activated"
  | "landing_primary_cta_clicked"
  | "import_started"
  | "import_completed"
  | "proposal_review_started"
  | "first_evidence_approved"
  | "dossier_activation_reached"
  | "first_lane_activated"
  | "resume_pack_started"
  | "resume_pack_completed"
  | "resume_variant_viewed"
  | "resume_variant_opened"
  | "resume_exported"
  | "pack_bundle_exported"
  | "full_pack_exported"
  | "job_tailor_started"
  | "tailor_started"
  | "application_pack_completed"
  | "tailored_resume_completed"
  | "application_saved"
  | "activation_feedback_submitted";

function cleanProperties(properties?: AnalyticsProperties) {
  if (!properties) return undefined;

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== ""),
  ) as AnalyticsProperties;
}

export function trackProductEvent(event: string, properties?: AnalyticsProperties) {
  track(event, cleanProperties(properties));
}

// Career-workflow analytics are deliberately event-name only. Never add a
// dossier, résumé, job-post, person, employer, or proof value here.
export function trackCareerEvent(event: CareerForgeEventName) {
  track(event);
}

export function trackLandingVisit() {
  trackProductEvent("landing_page_visit", { product: "career_forge_lite" });
}

export function trackCtaClick(label: string, target: string) {
  trackProductEvent("cta_click", {
    product: "career_forge_lite",
    label,
    target,
  });
}

export function trackCareerForgeStart(mode: "guided" | "interview" | "story") {
  trackProductEvent("career_forge_start", {
    product: "career_forge_lite",
    mode,
  });
}

export function trackCareerForgeCompletion(mode: "guided" | "interview" | "story") {
  trackProductEvent("career_forge_completion", {
    product: "career_forge_lite",
    mode,
  });
}

export function trackResumeGeneration(mode: "guided" | "interview" | "story") {
  trackProductEvent("resume_generation", {
    product: "career_forge_lite",
    mode,
  });
}
