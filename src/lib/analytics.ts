"use client";

import { track } from "@vercel/analytics";

type AnalyticsValue = string | number | boolean;
type AnalyticsProperties = Record<string, AnalyticsValue>;

function cleanProperties(properties?: AnalyticsProperties) {
  if (!properties) return undefined;

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== ""),
  ) as AnalyticsProperties;
}

export function trackProductEvent(event: string, properties?: AnalyticsProperties) {
  track(event, cleanProperties(properties));
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
