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

export function getInterviewModeLimitState(session: InterviewSession): InterviewModeLimitState {
  const feature = getFeatureAccess("interview_mode");
  const answerLimit = feature.previewLimit ?? interviewModePreviewLimit;
  const answerCount = session.messages.filter((message) => message.role === "user").length;
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
    label: isPreview ? `Beta Preview: ${Math.min(answerCount, answerLimit)} of ${answerLimit} interview answers used` : feature.label
  };
}
