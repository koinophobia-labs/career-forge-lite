import type { InterviewSession } from "@/types/interview";

export type FeatureAccessLevel = "free" | "premium_preview" | "premium_locked";

export type CareerForgeFeature = {
  key: "static_builder" | "interview_mode";
  label: string;
  accessLevel: FeatureAccessLevel;
  previewLimit?: number;
};

export type InterviewModeLimitState = {
  accessLevel: FeatureAccessLevel;
  answerCount: number;
  answerLimit: number;
  remainingAnswers: number;
  isLimited: boolean;
  isLocked: boolean;
  label: string;
};

export const interviewModePreviewLimit = 6;

const features: Record<CareerForgeFeature["key"], CareerForgeFeature> = {
  static_builder: {
    key: "static_builder",
    label: "Static Builder",
    accessLevel: "free"
  },
  interview_mode: {
    key: "interview_mode",
    label: "Interview Mode",
    accessLevel: "premium_preview",
    previewLimit: interviewModePreviewLimit
  }
};

export function getFeatureAccess(featureKey: CareerForgeFeature["key"]) {
  return features[featureKey];
}

export function canUseInterviewMode() {
  return getFeatureAccess("interview_mode").accessLevel !== "premium_locked";
}

// unlimited: true when this browser holds a license whose pack includes
// interview_unlimited, or when commerce is off (free beta). The default keeps
// the historical preview behavior for callers that don't pass entitlement.
export function getInterviewModeLimitState(session: InterviewSession, unlimited = false): InterviewModeLimitState {
  const feature = getFeatureAccess("interview_mode");
  const answerLimit = feature.previewLimit ?? interviewModePreviewLimit;
  const answerCount = session.messages.filter((message) => message.role === "user").length;

  if (unlimited) {
    return {
      accessLevel: "free",
      answerCount,
      answerLimit: Number.POSITIVE_INFINITY,
      remainingAnswers: Number.POSITIVE_INFINITY,
      isLimited: false,
      isLocked: false,
      label: feature.label
    };
  }

  const remainingAnswers = Math.max(answerLimit - answerCount, 0);
  const isPreview = feature.accessLevel === "premium_preview";
  const isLocked = feature.accessLevel === "premium_locked" || (isPreview && answerCount >= answerLimit);

  return {
    accessLevel: feature.accessLevel,
    answerCount,
    answerLimit,
    remainingAnswers,
    isLimited: isPreview,
    isLocked,
    label: isPreview ? `Preview: ${Math.min(answerCount, answerLimit)} of ${answerLimit} interview answers used` : feature.label
  };
}
