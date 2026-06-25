import type { IntakeData } from "@/types/career";

export type InterviewRole = "assistant" | "user" | "system";

export type InterviewStageId =
  | "role_targeting"
  | "background_overview"
  | "current_or_recent_role"
  | "responsibilities"
  | "achievements"
  | "metrics"
  | "tools_and_skills"
  | "projects_or_portfolio"
  | "education_and_certifications"
  | "gaps_and_positioning"
  | "final_resume_review";

export type InterviewFieldStrength = "empty" | "weak" | "usable" | "strong";

export type InterviewMessage = {
  id: string;
  role: InterviewRole;
  content: string;
  createdAt: string;
};

export type InterviewFieldStatus = {
  fieldKey: keyof IntakeData | keyof InterviewResumeDraft | string;
  label: string;
  status: InterviewFieldStrength;
  evidenceFromMessages: string[];
  notes: string;
};

export type InterviewRoleDraft = {
  title: string;
  company: string;
  timeInRole: string;
  notes: string[];
};

export type InterviewResumeDraft = {
  targetRole: string;
  targetIndustry: string;
  experienceLevel: string;
  roles: InterviewRoleDraft[];
  responsibilities: string[];
  achievements: string[];
  tools: string[];
  skills: string[];
  metrics: string[];
  education: string;
  certifications: string[];
  projects: string[];
  gapsOrWeakAreas: string[];
  confidenceScore: number;
};

export type InterviewStage = {
  id: InterviewStageId;
  label: string;
  goal: string;
  requiredFields: Array<keyof InterviewResumeDraft | string>;
  exampleAssistantQuestion: string;
  completionCriteria: string;
};

export type InterviewSession = {
  id: string;
  messages: InterviewMessage[];
  resumeDraft: InterviewResumeDraft;
  fieldStatuses: InterviewFieldStatus[];
  currentStage: InterviewStageId;
  completedStages: InterviewStageId[];
  createdAt: string;
  updatedAt: string;
};
