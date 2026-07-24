import type { ApplicationRecord } from "@/types/command-center";

const JOB_TEXT_PREFIX = "career-forge-job-text:v1:";

// ApplicationRecord already has a durable, backed-up jobPostUrl field that was
// unused by the current UI. Store pasted posting text there with an explicit
// prefix while keeping discoveryUrl/applicationUrl reserved for real links.
export function encodeJobPostText(jobPost: string): string {
  const trimmed = jobPost.trim();
  return trimmed ? `${JOB_TEXT_PREFIX}${encodeURIComponent(trimmed)}` : "";
}

export function decodeJobPostText(value: string): string {
  if (!value.startsWith(JOB_TEXT_PREFIX)) return "";
  try {
    return decodeURIComponent(value.slice(JOB_TEXT_PREFIX.length));
  } catch {
    return "";
  }
}

export function applicationJobPost(application: ApplicationRecord): string {
  return decodeJobPostText(application.jobPostUrl);
}

export function hasSavedJobWorkspace(application: ApplicationRecord): boolean {
  return Boolean(applicationJobPost(application));
}
