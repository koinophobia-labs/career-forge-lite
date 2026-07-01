export type RoleFamily =
  | "Tech"
  | "Business"
  | "Operations"
  | "Customer Success"
  | "Admin"
  | "Healthcare"
  | "Sales"
  | "Security"
  | "Project Coordination"
  | "IT Support";

export type TemplateStyle = "Corporate" | "Modern ATS" | "Tech ATS";

export type IntakeData = {
  fullName: string;
  email: string;
  phone: string;
  website: string;
  targetJobTitle: string;
  roleFamily: RoleFamily;
  currentTitle: string;
  currentCompany: string;
  currentTime: string;
  previousTitle: string;
  previousCompany: string;
  previousTime: string;
  additionalTitle: string;
  additionalCompany: string;
  additionalTime: string;
  tools: string;
  selectedAiWorkflows: string[];
  independentWorkType: string;
  selectedIndependentWorkSignals: string[];
  responsibilities: string;
  selectedResponsibilities: string[];
  selectedActions: string[];
  customRoleIndustry: string;
  customRoleWorkStyles: string[];
  customRoleTransferableSkills: string[];
  customRoleNotes: string;
  customersServed: string;
  ticketsHandled: string;
  projectsSupported: string;
  teamSizeSupported: string;
  callsHandled: string;
  revenueInfluenced: string;
  reportsCreated: string;
  selectedOutcomes: string[];
  outcomes: string;
  education: string;
};

export type IntakeErrors = Partial<Record<keyof IntakeData, string>>;

export type ExperienceRole = {
  title: string;
  company: string;
  time: string;
  bullets: string[];
};

export type ResumePackage = {
  summary: string;
  coreSkills: string[];
  experience: ExperienceRole[];
  education: string;
  linkedinHeadline: string;
  linkedinSummary: string;
};

export type AtsCheckStatus = "PASS" | "WARNING";

export type AtsCheck = {
  label: string;
  status: AtsCheckStatus;
  detail: string;
};
