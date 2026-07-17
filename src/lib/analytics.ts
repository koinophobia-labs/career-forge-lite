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
  | "truth_inbox_created"
  | "truth_inbox_resumed"
  | "truth_inbox_completed"
  | "truth_inbox_discarded"
  | "truth_map_opened"
  | "evidence_usage_opened"
  | "claim_provenance_opened"
  | "defensibility_receipt_opened"
  | "differentiation_section_cta_clicked"
  | "intent_goal_selected"
  | "intent_goal_resumed"
  | "activation_feedback_submitted"
  // Commerce funnel — event names only, like everything above. Which package
  // was viewed/bought is a product fact, not a person fact, so the tier rides
  // in the event name itself rather than as a property.
  | "pricing_viewed"
  | "checkout_started_reset"
  | "checkout_started_job_search"
  | "checkout_started_career_switch"
  | "checkout_completed"
  | "license_activated"
  | "license_invalid"
  | "locked_feature_viewed";

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
