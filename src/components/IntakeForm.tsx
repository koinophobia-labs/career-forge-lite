"use client";

import { useMemo, useState } from "react";
import {
  careerTargets,
  companySuggestions,
  findJobArsenal,
  type CareerTarget,
  outcomeSuggestionsByFamily,
  roleFamilies,
  roleIntelligence,
  templates,
  allToolOptions,
  toolSuggestionsByFamily
} from "@/lib/career-data";
import {
  aiWorkflowOptions,
  aiWorkflowSuggestionsByFamily,
  getAiWorkflowArsenalForContext,
  selectedAiTools
} from "@/lib/modern-work-intelligence";
import {
  educationPromptForSelection,
  findEducationSuggestions,
  normalizeEducationEntry
} from "@/lib/education-intelligence";
import {
  findIndependentWorkRole,
  independentWorkArsenals,
  inferIndependentWorkCategory
} from "@/lib/independent-work-intelligence";
import { hasEnoughResumeSignal, mergeReactiveSignals } from "@/lib/interview-state";
import { isUncertaintyStatement } from "@/lib/truth-guards";
import { formatParsedRoleConfirmation, parseRoleAnswer, type ParsedRoleAnswer } from "@/lib/natural-role-parser";
import { buildCareerEvidence, buildCareerRecommendations, type CareerRecommendation } from "@/lib/career-recommendations";
import type { IntakeData, IntakeErrors, RoleFamily, TemplateStyle } from "@/types/career";

type IntakeFormProps = {
  data: IntakeData;
  errors: IntakeErrors;
  selectedTemplate: TemplateStyle;
  onTemplateSelect: (template: TemplateStyle) => void;
  onChange: (data: IntakeData) => void;
  onValidate: (keys: Array<keyof IntakeData>) => boolean;
  onGenerate: () => void;
};

type Question = {
  id:
    | "quick_start"
    | "name"
    | "email"
    | "contact"
    | "target"
    | "current_role"
    | "current_company"
    | "previous_role"
    | "additional_role"
    | "tools"
    | "responsibilities"
    | "scope"
    | "outcomes"
    | "education"
    | "template"
    | "review";
  title: string;
  helper: string;
  validate: Array<keyof IntakeData>;
};

type QuickStartPath =
  | "first_resume"
  | "career_change"
  | "old_resume"
  | "knows_experience"
  | "project_based"
  | "internal_application"
  | "other";

type MomentumStage = "Identity" | "Target" | "Experience" | "Arsenal" | "Proof" | "Review";
type RoleSlot = "current" | "previous" | "additional";

type RoleSlotConfig = {
  companyKey: "currentCompany" | "previousCompany" | "additionalCompany";
  inputPlaceholder: string;
  timeKey: "currentTime" | "previousTime" | "additionalTime";
  titleKey: "currentTitle" | "previousTitle" | "additionalTitle";
};

const requiredKeys: Array<keyof IntakeData> = ["targetJobTitle", "currentTitle"];
const defaultQuestionIds: Question["id"][] = [
  "quick_start",
  "target",
  "current_role",
  "responsibilities",
  "tools",
  "outcomes",
  "review"
];
const optionalQuestionIds = new Set<Question["id"]>([
  "name",
  "email",
  "contact",
  "current_company",
  "previous_role",
  "additional_role",
  "scope",
  "education",
  "template"
]);

const questions: Question[] = [
  {
    id: "quick_start",
    title: "What do you need help with?",
    helper: "Pick the closest option.",
    validate: []
  },
  {
    id: "name",
    title: "What's your full name?",
    helper: "Use the name recruiters should see.",
    validate: ["fullName"]
  },
  {
    id: "email",
    title: "What email should recruiters use?",
    helper: "Use your job-search email.",
    validate: ["email"]
  },
  {
    id: "contact",
    title: "Want to add phone or portfolio?",
    helper: "Optional.",
    validate: []
  },
  {
    id: "target",
    title: "What job do you want next?",
    helper: "Search or type your own.",
    validate: ["targetJobTitle"]
  },
  {
    id: "current_role",
    title: "What did you actually do there?",
    helper: "A few plain sentences are enough.",
    validate: ["currentTitle"]
  },
  {
    id: "current_company",
    title: "Where and when was that?",
    helper: "Optional.",
    validate: []
  },
  {
    id: "previous_role",
    title: "Add another experience",
    helper: "Optional.",
    validate: []
  },
  {
    id: "additional_role",
    title: "Add a project or extra role",
    helper: "Optional.",
    validate: []
  },
  {
    id: "tools",
    title: "What tools did you use?",
    helper: "Pick any that apply.",
    validate: []
  },
  {
    id: "responsibilities",
    title: "Which skills and responsibilities match your work?",
    helper: "Pick what is true. Add your own only if needed.",
    validate: []
  },
  {
    id: "scope",
    title: "Add proof or numbers",
    helper: "Optional.",
    validate: []
  },
  {
    id: "outcomes",
    title: "What did your work improve?",
    helper: "Pick any result that is true. Skip anything you cannot defend.",
    validate: []
  },
  {
    id: "education",
    title: "Add certifications or education",
    helper: "Optional.",
    validate: []
  },
  {
    id: "template",
    title: "Pick a resume style",
    helper: "All options are ATS-safe.",
    validate: []
  },
  {
    id: "review",
    title: "Ready to generate?",
    helper: "Review or continue.",
    validate: []
  }
];

const quickStartPaths: Array<{ id: QuickStartPath; label: string; helper: string }> = [
  { id: "knows_experience", label: "Get a new job", helper: "Use recent work." },
  { id: "career_change", label: "Change careers", helper: "Switch lanes." },
  { id: "old_resume", label: "Update my resume", helper: "Refresh it." },
  { id: "first_resume", label: "First resume", helper: "Start simple." },
  { id: "other", label: "Other", helper: "Type it out." }
];

const commonToolChips = [
  "Cash Register",
  "POS",
  "Excel",
  "Scanner",
  "Scheduling Software",
  "Company App",
  "Inventory System",
  "Microsoft Office",
  "Google Workspace",
  "Other"
];

const questionStages: Record<Question["id"], MomentumStage> = {
  quick_start: "Identity",
  name: "Identity",
  email: "Identity",
  contact: "Identity",
  target: "Target",
  current_role: "Experience",
  current_company: "Experience",
  previous_role: "Experience",
  additional_role: "Experience",
  tools: "Arsenal",
  responsibilities: "Arsenal",
  scope: "Proof",
  outcomes: "Proof",
  education: "Proof",
  template: "Review",
  review: "Review"
};

const stageConfirmations: Record<MomentumStage, string> = {
  Identity: "Dossier started",
  Target: "Career lane locked",
  Experience: "Experience frame captured",
  Arsenal: "Experience signals captured",
  Proof: "Proof signals added",
  Review: "Resume package ready"
};

const roleSlotConfigs: Record<RoleSlot, RoleSlotConfig> = {
  current: {
    companyKey: "currentCompany",
    inputPlaceholder: "I drive for DoorDash and handle orders, routes, and customer messages.",
    timeKey: "currentTime",
    titleKey: "currentTitle"
  },
  previous: {
    companyKey: "previousCompany",
    inputPlaceholder: "I was a cashier at Target for two years.",
    timeKey: "previousTime",
    titleKey: "previousTitle"
  },
  additional: {
    companyKey: "additionalCompany",
    inputPlaceholder: "I built websites for local projects in 2025.",
    timeKey: "additionalTime",
    titleKey: "additionalTitle"
  }
};

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}` : ""))
    .join(" ");
}

function inferRoleTitleFromExperienceText(value: string) {
  const lower = value.toLowerCase();
  const knownRoles: Array<[RegExp, string]> = [
    [/\bdoordash|delivery driver|delivered orders|delivery app\b/i, "Delivery Driver"],
    [/\bretail cashier|cashier\b/i, "Retail Cashier"],
    [/\bwarehouse associate|warehouse\b/i, "Warehouse Associate"],
    [/\bfood service|server|cook|restaurant|barista\b/i, "Food Service Worker"],
    [/\bbarber\b/i, "Barber"],
    [/\bsoftware engineer|developer|built apps?|built websites?\b/i, "Software Engineer"],
    [/\bbartender|bar tender\b/i, "Bartender"]
  ];
  const known = knownRoles.find(([pattern]) => pattern.test(lower));
  if (known) return known[1];

  const match = value.match(/\b(?:as|was|am|worked as|work as|role was|job was)\s+(?:a|an)?\s*([a-z][a-z /-]{2,36}?)(?:\.|,|;|\band\b|\bwhere\b|\bfor\b|\bat\b|$)/i);
  if (!match?.[1]) return "";
  return titleCase(match[1].replace(/\b(i|we|my|the|this|that)$/i, "").trim());
}

const allScopeFields: Array<{ key: keyof IntakeData; label: string }> = [
  { key: "customersServed", label: "Customers/users" },
  { key: "ticketsHandled", label: "Tickets/requests" },
  { key: "projectsSupported", label: "Projects" },
  { key: "teamSizeSupported", label: "Team size" },
  { key: "callsHandled", label: "Calls/follow-ups" },
  { key: "reportsCreated", label: "Reports/docs" },
  { key: "revenueInfluenced", label: "Revenue/budget" }
];

const industryOptions = [
  "Retail",
  "Customer Service",
  "Hospitality",
  "Gaming / Sportsbook",
  "Healthcare",
  "Finance",
  "Banking",
  "Insurance",
  "Logistics",
  "Warehouse",
  "Manufacturing",
  "Technology",
  "Education",
  "Government",
  "Security",
  "Food Service",
  "Entertainment",
  "Nonprofit",
  "Other"
];

type AdaptiveExperienceSignal = {
  id: string;
  label: string;
  patterns: RegExp[];
  chips: string[];
  toolHints?: string[];
};

const adaptiveExperienceSignals: AdaptiveExperienceSignal[] = [
  {
    id: "customers",
    label: "customer service",
    patterns: [/\bcustomers?\b/i, /\bclients?\b/i, /\bguests?\b/i, /\bpatients?\b/i, /\bvisitors?\b/i, /\bmembers?\b/i, /\bfood service\b/i, /\bservice worker\b/i],
    chips: ["Handled high-volume customers", "Answered customer questions", "Supported customer handoffs", "Kept service friendly and accurate"]
  },
  {
    id: "payments",
    label: "payment handling",
    patterns: [/\bpayments?\b/i, /\bcash\b/i, /\bcashier\b/i, /\bcard\b/i, /\bregister\b/i, /\bpos\b/i, /\btabs?\b/i, /\bcheckout\b/i, /\brefunds?\b/i],
    chips: ["Processed payments", "Balanced cash or register activity", "Managed tabs/orders", "Handled checkout accuracy"],
    toolHints: ["POS Systems", "Cash Drawer", "Payment Systems"]
  },
  {
    id: "conflict",
    label: "conflict resolution",
    patterns: [/\bupset\b/i, /\bangry\b/i, /\bcomplaints?\b/i, /\bconflict\b/i, /\bde-?escalat/i, /\bissues?\b/i, /\bescalat/i],
    chips: ["Resolved customer issues", "De-escalated tense situations", "Escalated issues when needed", "Followed policies during customer concerns"]
  },
  {
    id: "scheduling",
    label: "scheduling",
    patterns: [/\bschedul/i, /\bappointments?\b/i, /\bcalendar\b/i, /\bshift\b/i, /\bcoverage\b/i, /\bbookings?\b/i],
    chips: ["Coordinated schedules", "Managed appointments or bookings", "Supported shift coverage", "Kept timing organized"],
    toolHints: ["Google Calendar", "Outlook Calendar", "Booking Software"]
  },
  {
    id: "inventory",
    label: "inventory handling",
    patterns: [/\binventory\b/i, /\bstock/i, /\bshelves\b/i, /\bsupplies\b/i, /\bwarehouse\b/i, /\borders?\b/i, /\bfulfillment\b/i],
    chips: ["Tracked inventory", "Prepared orders", "Stocked or replenished supplies", "Checked order accuracy"],
    toolHints: ["Inventory Systems", "RF Scanners", "WMS"]
  },
  {
    id: "reports",
    label: "reports or documentation",
    patterns: [/\breports?\b/i, /\bdocument/i, /\brecords?\b/i, /\blogs?\b/i, /\bnotes?\b/i, /\bpaperwork\b/i, /\bfiles?\b/i],
    chips: ["Updated records", "Documented issues", "Prepared reports", "Kept logs accurate"],
    toolHints: ["Excel", "Google Sheets", "Internal Software"]
  },
  {
    id: "technical",
    label: "technical support",
    patterns: [/\btechnical\b/i, /\btroubleshoot/i, /\bsoftware\b/i, /\bsystems?\b/i, /\btickets?\b/i, /\bpassword\b/i, /\bdevices?\b/i],
    chips: ["Troubleshot technical issues", "Supported internal systems", "Documented support requests", "Escalated technical problems"],
    toolHints: ["Ticketing Systems", "ServiceNow", "Jira"]
  },
  {
    id: "tools",
    label: "tools or equipment",
    patterns: [/\btools?\b/i, /\bequipment\b/i, /\bscanner\b/i, /\bvehicle\b/i, /\bapp\b/i, /\bradio\b/i, /\bmachine\b/i],
    chips: ["Operated tools or equipment", "Used job-specific systems", "Followed equipment procedures", "Maintained safe tool use"]
  },
  {
    id: "policies",
    label: "policies or safety",
    patterns: [/\bpolic(?:y|ies)\b/i, /\bsafety\b/i, /\bcompliance\b/i, /\bprocedures?\b/i, /\brules?\b/i, /\bclean\b/i, /\bsanit/i],
    chips: ["Followed policies", "Maintained safe work areas", "Followed shift procedures", "Supported quality and compliance"]
  }
];

function formatList(items: string[]) {
  return items.filter(Boolean).join(", ") || "Not added yet";
}

function formatReviewItems(items: string[]) {
  const cleanItems = items.map(normalizeSelection).filter(Boolean);
  return cleanItems.length ? cleanItems.map((item) => `- ${item}`).join("\n") : "Not added yet";
}

function normalizeSelection(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function splitSelections(value: string) {
  return value
    .split(",")
    .map(normalizeSelection)
    .filter(Boolean);
}

function mergeSelection(current: string, item: string) {
  const normalized = normalizeSelection(item);
  const next = splitSelections(current);
  const exists = next.some((value) => value.toLowerCase() === normalized.toLowerCase());
  return exists ? next.filter((value) => value.toLowerCase() !== normalized.toLowerCase()).join(", ") : [...next, normalized].join(", ");
}

function filterOptions(options: string[], query: string, limit = 6) {
  const normalizedQuery = query.trim().toLowerCase();
  return options
    .filter((option) => !normalizedQuery || option.toLowerCase().includes(normalizedQuery))
    .slice(0, limit);
}

function hasExactOption(options: string[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return Boolean(normalizedQuery) && options.some((option) => option.toLowerCase() === normalizedQuery);
}

function hasKnownRole(title: string) {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return true;
  return careerTargets.some((target) => target.title.toLowerCase() === normalized) || Boolean(findJobArsenal(title));
}

function progressiveRoleFollowUpKey(data: IntakeData, config: RoleSlotConfig) {
  if (!String(data[config.titleKey]).trim()) return config.titleKey;
  if (!String(data[config.companyKey]).trim()) return config.companyKey;
  if (!String(data[config.timeKey]).trim()) return config.timeKey;
  return null;
}

function progressiveRoleFollowUpLabel(slot: RoleSlot, key: keyof IntakeData) {
  const field = String(key);
  if (field.endsWith("Title")) return slot === "additional" ? "What was this project or role called?" : "What was this role called?";
  if (field.endsWith("Company")) return "Where did it happen?";
  return "When did you do it?";
}

function progressiveRoleFollowUpPlaceholder(slot: RoleSlot, key: keyof IntakeData) {
  const field = String(key);
  if (field.endsWith("Title")) return slot === "additional" ? "Small betting odds tracker" : "Sportsbook Ticket Writer";
  if (field.endsWith("Company")) return slot === "additional" ? "Personal project, school, client, or company" : "DraftKings";
  return "2024, two years, or last summer";
}

export function IntakeForm({
  data,
  errors,
  selectedTemplate,
  onTemplateSelect,
  onChange,
  onValidate,
  onGenerate
}: IntakeFormProps) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [showRoleFamilyOptions, setShowRoleFamilyOptions] = useState(false);
  const [targetSearchOpen, setTargetSearchOpen] = useState(false);
  const [activeCompanyKey, setActiveCompanyKey] = useState<"currentCompany" | "previousCompany" | "additionalCompany" | null>(null);
  const [customCompany, setCustomCompany] = useState("");
  const [toolSearch, setToolSearch] = useState("");
  const [toolSearchOpen, setToolSearchOpen] = useState(false);
  const [customTool, setCustomTool] = useState("");
  const [educationSearch, setEducationSearch] = useState("");
  const [educationSearchOpen, setEducationSearchOpen] = useState(false);
  const [customEducation, setCustomEducation] = useState("");
  const [quickStartPath, setQuickStartPath] = useState<QuickStartPath>("first_resume");
  const [quickStartText, setQuickStartText] = useState("");
  // Raw proof/outcome text lives in local state so an honest "I don't know my
  // numbers" is never stored as scope or outcome evidence.
  const [scopeDraft, setScopeDraft] = useState(data.customRoleNotes || data.customersServed);
  const [outcomeDraft, setOutcomeDraft] = useState(data.outcomes);
  const [naturalRoleInputs, setNaturalRoleInputs] = useState<Record<RoleSlot, string>>({
    additional: "",
    current: "",
    previous: ""
  });
  const [parsedRoleAnswers, setParsedRoleAnswers] = useState<Partial<Record<RoleSlot, ParsedRoleAnswer>>>({});
  const [roleEditMode, setRoleEditMode] = useState<Record<RoleSlot, boolean>>({
    additional: false,
    current: false,
    previous: false
  });
  const question = questions[questionIndex];
  const roleOutcomes = outcomeSuggestionsByFamily[data.roleFamily];
  const independentCategory =
    findIndependentWorkRole(data.currentTitle)?.category ??
    findIndependentWorkRole(data.previousTitle)?.category ??
    findIndependentWorkRole(data.additionalTitle)?.category ??
    findIndependentWorkRole(data.targetJobTitle)?.category ??
    inferIndependentWorkCategory([
      data.currentTitle,
      data.previousTitle,
      data.additionalTitle,
      data.targetJobTitle,
      data.responsibilities
    ].join(" "));
  const independentArsenal = independentCategory ? independentWorkArsenals[independentCategory] : null;
  const unknownRoleTitles = [
    data.targetJobTitle,
    data.currentTitle,
    data.previousTitle,
    data.additionalTitle
  ].filter((title) => title.trim() && !hasKnownRole(title));
  const needsUnknownRoleContext = Boolean(unknownRoleTitles.length);
  const visibleOutcomes = roleOutcomes;
  const selectedTools = splitSelections(data.tools);
  const selectedAiToolNames = selectedAiTools(data.tools);
  const contextualAiWorkflows = getAiWorkflowArsenalForContext([
    data.targetJobTitle,
    data.currentTitle,
    data.previousTitle,
    data.additionalTitle,
    data.roleFamily
  ].join(" "));
  const aiWorkflowSuggestions = [
    ...contextualAiWorkflows,
    ...aiWorkflowSuggestionsByFamily[data.roleFamily],
    ...aiWorkflowOptions.filter((workflow) => !aiWorkflowSuggestionsByFamily[data.roleFamily].includes(workflow))
  ].slice(0, 6);
  const roleAwareToolOptions = toolSuggestionsByFamily[data.roleFamily];
  const roleQuickResponsibilities = roleIntelligence[data.roleFamily].responsibilities;
  const roleQuickSkills = roleIntelligence[data.roleFamily].skills;
  const visibleToolChips = Array.from(new Set([...roleAwareToolOptions.slice(0, 6), ...commonToolChips])).slice(0, 10);
  const toolMatches = filterOptions(toolSearch.trim() ? allToolOptions : roleAwareToolOptions, toolSearch, 6);
  const normalizedTargetQuery = data.targetJobTitle.trim().toLowerCase();
  const exactTargetMatch = careerTargets.find((target) => target.title.toLowerCase() === normalizedTargetQuery);
  const targetMatches = careerTargets
    .filter((target) => {
      if (!normalizedTargetQuery) return true;
      const title = target.title.toLowerCase();
      const family = target.roleFamily.toLowerCase();
      const aliases = target.aliases?.join(" ").toLowerCase() ?? "";
      return title.includes(normalizedTargetQuery) || family.includes(normalizedTargetQuery) || aliases.includes(normalizedTargetQuery);
    })
    .slice(0, normalizedTargetQuery ? 8 : 6);
  const showTargetMatches = targetSearchOpen && normalizedTargetQuery.length >= 2 && (!exactTargetMatch || Boolean(normalizedTargetQuery));
  const detectedExperienceSignals = adaptiveExperienceSignals.filter((signal) =>
    signal.patterns.some((pattern) => pattern.test(data.responsibilities))
  );
  const hasExperienceSignalText =
    data.responsibilities.trim().split(/\s+/).filter(Boolean).length >= 6 || detectedExperienceSignals.length > 0;
  const activeFollowUpSignal =
    detectedExperienceSignals.find((signal) =>
      signal.chips.some((chip) => !data.selectedResponsibilities.some((item) => item.toLowerCase() === chip.toLowerCase()))
    ) ?? detectedExperienceSignals[0];
  const detectedToolHints = Array.from(new Set(detectedExperienceSignals.flatMap((signal) => signal.toolHints ?? [])));
  const educationEntries = splitSelections(data.education.replace(/\n/g, ","));
  const educationSuggestions = findEducationSuggestions(educationSearch, educationSearch.trim() ? 8 : 6);
  const educationHelper = educationPromptForSelection(educationSearch || educationEntries[0] || "");
  const currentStage = questionStages[question.id];
  const defaultQuestionIndex = Math.max(0, defaultQuestionIds.indexOf(question.id));
  const isOptionalQuestion = optionalQuestionIds.has(question.id);
  const stageProgress = isOptionalQuestion
    ? 88
    : Math.round(((defaultQuestionIndex + 1) / defaultQuestionIds.length) * 100);

  const roleSummary = useMemo(() => {
    const roles = [
      [data.currentTitle, data.currentCompany, data.currentTime],
      [data.previousTitle, data.previousCompany, data.previousTime],
      [data.additionalTitle, data.additionalCompany, data.additionalTime]
    ];

    return roles
      .filter(([title]) => title.trim())
      .map(([title, company, time]) => [title, company, time].filter(Boolean).join(" / "));
  }, [
    data.additionalCompany,
    data.additionalTime,
    data.additionalTitle,
    data.currentCompany,
    data.currentTime,
    data.currentTitle,
    data.previousCompany,
    data.previousTime,
    data.previousTitle
  ]);

  const scopeSummary = allScopeFields
    .map((field) => {
      const value = String(data[field.key]).trim();
      return value ? `${field.label}: ${value}` : "";
    })
    .filter(Boolean);
  const hasEnoughSignal = hasEnoughResumeSignal(data);
  const careerEvidence = useMemo(() => buildCareerEvidence(data), [data]);
  const careerRecommendations = useMemo(() => buildCareerRecommendations(data), [data]);
  // Project/volunteer content described in the story deserves its own entry so
  // it renders in the draft instead of vanishing.
  const sideWorkPattern = /\b(volunteer(?:ed|ing)?|capstone|class project|personal project|side project|portfolio|built (?:a |an )?(?:website|app|site|page))\b/i;
  const detectedSideWorkSentence = sideWorkPattern.test(data.responsibilities)
    ? data.responsibilities.split(/(?<=[.!?])\s+|\n+/).find((sentence) => sideWorkPattern.test(sentence)) ?? ""
    : "";
  const shouldOfferSideWorkEntry = Boolean(detectedSideWorkSentence) && !data.additionalTitle.trim();

  function update<K extends keyof IntakeData>(key: K, value: IntakeData[K]) {
    onChange({ ...data, [key]: value });
  }

  function applyParsedRole(slot: RoleSlot, parsed: ParsedRoleAnswer, nextData = data) {
    const config = roleSlotConfigs[slot];
    return {
      ...nextData,
      [config.titleKey]: parsed.title || String(nextData[config.titleKey]),
      [config.companyKey]: parsed.company || String(nextData[config.companyKey]),
      [config.timeKey]: parsed.dates || String(nextData[config.timeKey])
    };
  }

  function updateNaturalRoleInput(slot: RoleSlot, value: string) {
    setNaturalRoleInputs((current) => ({ ...current, [slot]: value }));
    const parsed = parseRoleAnswer(value);
    setParsedRoleAnswers((current) => ({ ...current, [slot]: parsed }));
    setRoleEditMode((current) => ({ ...current, [slot]: parsed.confidence === "low" }));
    if (parsed.title || parsed.company || parsed.dates) {
      onChange(mergeReactiveSignals(applyParsedRole(slot, parsed), value));
    }
  }

  function commitNaturalRoleInput(slot: RoleSlot, value = naturalRoleInputs[slot]) {
    const parsed = parseRoleAnswer(value);
    if (parsed.title || parsed.company || parsed.dates) {
      onChange(mergeReactiveSignals(applyParsedRole(slot, parsed), value));
    }
  }

  function roleFollowUp(parsed: ParsedRoleAnswer) {
    if (parsed.missingField === "title") return "What was your title?";
    if (parsed.missingField === "company") return "What company was that with?";
    if (parsed.missingField === "dates") return "What dates or time in role should I use?";
    return "Confirm the details before moving on.";
  }

  function getMomentumConfirmation() {
    if (question.id === "target" && data.targetJobTitle.trim()) return `Lane locked: ${data.roleFamily}`;
    if (question.id === "tools" && selectedTools.length) return "Tools added to your dossier";
    if (question.id === "education" && data.education.trim()) return "Credential signals captured";
    if (question.id === "responsibilities" && (data.selectedResponsibilities.length || data.selectedActions.length)) {
      return "Experience signals captured";
    }
    if (question.id === "review") return "Ready to forge resume package";
    if (questionIndex > 0) return stageConfirmations[currentStage];
    return "Dossier started";
  }

  function getContinueLabel() {
    if (question.id === "quick_start") return "Start";
    if (question.id === "target") return "Next";
    if (question.id === "current_role") return "Next: skills";
    if (question.id === "responsibilities") return "Next: tools";
    if (question.id === "tools") return "Next: results";
    if (question.id === "outcomes") return "Review choices";
    if (question.id === "review") return "Generate draft";
    if (isOptionalQuestion) return "Save and review";
    return "Next";
  }

  function setRoleFamily(roleFamily: RoleFamily) {
    onChange({ ...data, roleFamily, selectedResponsibilities: [] });
    setShowRoleFamilyOptions(false);
  }

  function updateTargetRole(value: string) {
    setTargetSearchOpen(true);
    const exactMatch =
      careerTargets.find((target) => target.title.toLowerCase() === value.trim().toLowerCase() && target.roleFamily === data.roleFamily) ??
      careerTargets.find((target) => target.title.toLowerCase() === value.trim().toLowerCase());

    onChange({
      ...data,
      targetJobTitle: value,
      ...(exactMatch ? { roleFamily: exactMatch.roleFamily, selectedResponsibilities: [] } : {})
    });
  }

  function commitTargetRole(value = data.targetJobTitle) {
    const trimmed = value.trim();
    if (!trimmed) {
      update("targetJobTitle", "");
      return;
    }

    const exactMatch =
      careerTargets.find((target) => target.title.toLowerCase() === trimmed.toLowerCase() && target.roleFamily === data.roleFamily) ??
      careerTargets.find((target) => target.title.toLowerCase() === trimmed.toLowerCase());

    if (exactMatch) {
      selectCareerTarget(exactMatch);
      return;
    }

    const reactiveData = mergeReactiveSignals(data, trimmed);
    onChange({
      ...data,
      roleFamily: reactiveData.roleFamily,
      targetJobTitle: value
    });
  }

  function selectCareerTarget(target: CareerTarget) {
    onChange({
      ...data,
      targetJobTitle: target.title,
      roleFamily: target.roleFamily,
      selectedResponsibilities: []
    });
    setTargetSearchOpen(false);
    setShowRoleFamilyOptions(false);
  }

  function selectRecommendedCareer(recommendation: CareerRecommendation) {
    onChange({
      ...data,
      targetJobTitle: recommendation.title,
      roleFamily: recommendation.roleFamily,
      selectedResponsibilities: []
    });
    setShowRoleFamilyOptions(false);
  }

  function setCompany(key: "currentCompany" | "previousCompany" | "additionalCompany", value: string) {
    update(key, normalizeSelection(value));
    if (companySuggestions.some((company) => company.toLowerCase() === value.trim().toLowerCase())) {
      setActiveCompanyKey(null);
    }
  }

  function toggleTool(item: string) {
    update("tools", mergeSelection(data.tools, item));
    setToolSearch("");
  }

  function addEducationEntry(entry: string) {
    const normalized = normalizeEducationEntry(entry);
    if (!normalized) return;
    const next = [...educationEntries.filter((item) => item.toLowerCase() !== normalized.toLowerCase()), normalized];
    update("education", next.join("\n"));
    setEducationSearch("");
    setEducationSearchOpen(false);
  }

  function removeEducationEntry(entry: string) {
    update("education", educationEntries.filter((item) => item !== entry).join("\n"));
  }

  function addCustomEducation() {
    addEducationEntry(customEducation);
    setCustomEducation("");
  }

  function toggleAiWorkflow(item: string) {
    const selected = data.selectedAiWorkflows.includes(item)
      ? data.selectedAiWorkflows.filter((value) => value !== item)
      : [...data.selectedAiWorkflows, item];
    update("selectedAiWorkflows", selected);
  }

  function addCustomTool() {
    const normalized = normalizeSelection(customTool || toolSearch);
    if (!normalized) return;
    update("tools", mergeSelection(data.tools, normalized));
    setCustomTool("");
    setToolSearch("");
    setToolSearchOpen(false);
  }

  function toggleResponsibility(item: string) {
    const selected = data.selectedResponsibilities.includes(item)
      ? data.selectedResponsibilities.filter((value) => value !== item)
      : [...data.selectedResponsibilities, item];
    update("selectedResponsibilities", selected);
  }

  function toggleTransferableSkill(item: string) {
    const selected = data.customRoleTransferableSkills.includes(item)
      ? data.customRoleTransferableSkills.filter((value) => value !== item)
      : [...data.customRoleTransferableSkills, item];
    update("customRoleTransferableSkills", selected);
  }

  function toggleAdaptiveTool(item: string) {
    update("tools", mergeSelection(data.tools, item));
  }

  function updateExperienceStory(value: string) {
    const inferredTitle = !data.currentTitle.trim() ? inferRoleTitleFromExperienceText(value) : "";
    onChange({
      ...data,
      responsibilities: value,
      ...(inferredTitle ? { currentTitle: inferredTitle } : {})
    });
  }

  function toggleOutcome(item: string) {
    const selected = data.selectedOutcomes.includes(item)
      ? data.selectedOutcomes.filter((value) => value !== item)
      : [...data.selectedOutcomes, item];
    update("selectedOutcomes", selected);
  }

  function updateQuickStart(value: string) {
    setQuickStartText(value);
    const lower = value.toLowerCase();
    if (/project|founder|app|website|portfolio|built/.test(lower)) setQuickStartPath("project_based");
    else if (/change|switch|better job|new career|different/.test(lower)) setQuickStartPath("career_change");
    else if (/old|update|existing/.test(lower)) setQuickStartPath("old_resume");
    else if (/internal|promotion|same company/.test(lower)) setQuickStartPath("internal_application");
    else if (/quick|recommendation|know my experience/.test(lower)) setQuickStartPath("knows_experience");
    else if (/first|student|graduate|resume/.test(lower)) setQuickStartPath("first_resume");
  }

  function nextDefaultQuestionIndex() {
    const currentDefaultIndex = defaultQuestionIds.indexOf(question.id);
    const nextId = defaultQuestionIds[Math.min(currentDefaultIndex + 1, defaultQuestionIds.length - 1)] ?? "review";
    return questions.findIndex((item) => item.id === nextId);
  }

  function previousDefaultQuestionIndex() {
    const currentDefaultIndex = defaultQuestionIds.indexOf(question.id);
    const previousId = defaultQuestionIds[Math.max(0, currentDefaultIndex - 1)] ?? "quick_start";
    return questions.findIndex((item) => item.id === previousId);
  }

  function renderCompanyPicker(key: "currentCompany" | "previousCompany" | "additionalCompany", label: string) {
    const value = String(data[key]);
    const companyQuery = value || customCompany;
    const matches = filterOptions(companySuggestions, companyQuery, companyQuery.trim() ? 8 : 5);
    const showMatches = activeCompanyKey === key && companyQuery.trim().length >= 2;
    const hasExactCompany = hasExactOption(companySuggestions, value);

    return (
      <div className="rounded-md bg-white p-4">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-ink">{label}</span>
          <input
            type="text"
            value={value}
            onChange={(event) => setCompany(key, event.target.value)}
            onFocus={() => setActiveCompanyKey(key)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches[0]) {
                event.preventDefault();
                setCompany(key, matches[0]);
              }
            }}
            placeholder="Search company..."
            className="trust-input min-h-12 w-full rounded-md border px-4 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
          />
        </label>
        {showMatches && (
          <div className="mt-3 rounded-md bg-paper p-2 shadow-soft">
            <div className="grid gap-2">
              {matches.map((company) => (
                <button
                  key={company}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setCompany(key, company)}
                  className={`rounded-md border px-3 py-2 text-left text-sm font-semibold transition ${
                    value === company ? "border-gold bg-gold/20 text-ink" : "border-ink/12 bg-white text-ink hover:border-spruce"
                  }`}
                >
                  {company}
                </button>
              ))}
            </div>
            {!matches.length && (
              <p className="px-2 py-3 text-sm leading-6 text-ink/65">No catalog match. Add a custom company below.</p>
            )}
          </div>
        )}
        <div className="mt-4 pt-1">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={customCompany}
              onChange={(event) => setCustomCompany(event.target.value)}
              placeholder={hasExactCompany || !value ? "Add custom company" : value}
              className="trust-input min-h-10 flex-1 rounded-md border px-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
            />
            <button
              type="button"
              onClick={() => {
                setCompany(key, customCompany || value);
                setCustomCompany("");
                setActiveCompanyKey(null);
              }}
              className="rounded-md border border-ink/15 bg-ink px-4 py-2 text-sm font-bold text-paper transition hover:bg-gold hover:text-ink"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    );
  }

  function continueQuestion() {
    if (question.id === "current_role") {
      const inferredTitle = data.currentTitle.trim() || inferRoleTitleFromExperienceText(data.responsibilities) || "Recent Work";
      onChange({ ...data, currentTitle: inferredTitle });
      const nextIndex = nextDefaultQuestionIndex();
      setQuestionIndex(nextIndex);
      window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
      return;
    }
    if (!onValidate(question.validate)) return;
    if (isOptionalQuestion) {
      goToQuestionId("review");
      return;
    }
    if (question.id !== "review") {
      const nextIndex = nextDefaultQuestionIndex();
      setQuestionIndex(nextIndex);
      window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
      return;
    }

    if (!onValidate(["targetJobTitle", "currentTitle"])) return;
    generateWithOptionalDefaults();
  }

  function generateWithOptionalDefaults() {
    if (!data.currentCompany.trim() && data.currentTitle.trim()) {
      onChange({
        ...mergeReactiveSignals(data, [data.currentTitle, data.targetJobTitle].join(" ")),
        currentCompany: data.currentCompany || "Recent Work"
      });
      window.setTimeout(onGenerate, 0);
      return;
    }
    onGenerate();
  }

  function backQuestion() {
    if (isOptionalQuestion) {
      goToQuestionId("review");
      return;
    }
    setQuestionIndex(previousDefaultQuestionIndex());
    window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
  }

  function goToQuestion(index: number) {
    setQuestionIndex(index);
    window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
  }

  function goToQuestionId(id: Question["id"]) {
    goToQuestion(Math.max(0, questions.findIndex((item) => item.id === id)));
  }

  function inputClass(key: keyof IntakeData) {
    return `trust-input min-h-12 w-full rounded-md border px-4 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15 ${
      errors[key] ? "border-coral" : "border-ink/15"
    }`;
  }

  function renderField(
    fieldKey: keyof IntakeData,
    label: string,
    placeholder?: string,
    type = "text",
    helper?: string
  ) {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-ink">
          {label}
          {requiredKeys.includes(fieldKey) && <span className="text-coral"> *</span>}
        </span>
        {helper && <span className="mb-2 block text-sm leading-5 text-ink/60">{helper}</span>}
        <input
          type={type}
          value={String(data[fieldKey])}
          onChange={(event) => update(fieldKey, event.target.value as never)}
          placeholder={placeholder}
          aria-invalid={Boolean(errors[fieldKey])}
          className={inputClass(fieldKey)}
        />
        {errors[fieldKey] && <span className="mt-2 block text-sm font-semibold text-coral">{errors[fieldKey]}</span>}
      </label>
    );
  }

  function renderNaturalRoleQuestion(slot: RoleSlot, label: string) {
    const config = roleSlotConfigs[slot];
    const parsed = parsedRoleAnswers[slot];
    const editMode = roleEditMode[slot];
    const hasNaturalInput = naturalRoleInputs[slot].trim().length > 0;
    const hasStructuredValue = Boolean(
      String(data[config.titleKey]).trim() || String(data[config.companyKey]).trim() || String(data[config.timeKey]).trim()
    );
    const nextFollowUpKey = progressiveRoleFollowUpKey(data, config);

    return (
      <div className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-ink">{label}</span>
          <span className="mb-2 block text-sm leading-5 text-ink/60">
            Say it like you would explain it to a friend.
          </span>
          <textarea
            value={naturalRoleInputs[slot]}
            onChange={(event) => updateNaturalRoleInput(slot, event.target.value)}
            onBlur={(event) => commitNaturalRoleInput(slot, event.target.value)}
            placeholder={config.inputPlaceholder}
            rows={3}
            className="trust-input w-full rounded-md border px-4 py-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
          />
        </label>

        {parsed && hasStructuredValue && !editMode && (
          <div className="rounded-md border border-cyan/20 bg-cyan/10 p-4">
            <p className="text-sm font-bold text-ink">I read that as:</p>
            <p className="mt-2 text-base font-black text-spruce">{formatParsedRoleConfirmation(parsed)}</p>
            {parsed.confidence !== "high" && <p className="mt-2 text-sm leading-6 text-ink/65">{roleFollowUp(parsed)}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRoleEditMode((current) => ({ ...current, [slot]: false }))}
                className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-paper transition hover:bg-gold hover:text-ink"
              >
                Looks right
              </button>
              <button
                type="button"
                onClick={() => setRoleEditMode((current) => ({ ...current, [slot]: true }))}
                className="rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink transition hover:border-gold"
              >
                Edit details
              </button>
            </div>
          </div>
        )}

        {(editMode || (!hasStructuredValue && hasNaturalInput)) && nextFollowUpKey && (
          <div className={nextFollowUpKey === config.companyKey ? "space-y-4" : "rounded-md bg-white p-4"}>
            {nextFollowUpKey === config.companyKey
              ? renderCompanyPicker(config.companyKey, progressiveRoleFollowUpLabel(slot, nextFollowUpKey))
              : renderField(
                  nextFollowUpKey,
                  progressiveRoleFollowUpLabel(slot, nextFollowUpKey),
                  progressiveRoleFollowUpPlaceholder(slot, nextFollowUpKey)
                )}
            <button
              type="button"
              onClick={() => setRoleEditMode((current) => ({ ...current, [slot]: false }))}
              className="mt-4 min-h-11 w-full rounded-md border border-ink/12 bg-paper px-4 py-2 text-sm font-bold text-ink transition hover:border-gold"
            >
              Skip / I&apos;m not sure
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderAdaptiveExperienceQuestion() {
    const shouldAskIndustry = needsUnknownRoleContext && !data.customRoleIndustry && data.responsibilities.trim().length >= 24;
    const followUpChips = activeFollowUpSignal?.chips ?? [];

    return (
      <div className="space-y-4">
        <label className="block">
          <span className="sr-only">What did you actually do in this role?</span>
          <textarea
            value={data.responsibilities}
            onChange={(event) => updateExperienceStory(event.target.value)}
            placeholder="Example: Helped customers, stocked shelves."
            rows={7}
            className="trust-input w-full rounded-md border px-4 py-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
          />
        </label>

        {hasExperienceSignalText && detectedExperienceSignals.length > 0 && (
          <div className="rounded-md border border-cyan/20 bg-white p-3">
            <p className="text-sm font-bold text-ink">We heard:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {detectedExperienceSignals.map((signal) => (
                <span key={signal.id} className="rounded-full border border-cyan/25 bg-cyan/10 px-3 py-2 text-sm font-bold text-spruce">
                  {signal.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {hasExperienceSignalText && activeFollowUpSignal && (
          <div className="rounded-md bg-white p-3">
            <p className="text-sm font-bold text-ink">Which of these are true?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {followUpChips.map((chip) => {
                const selected = data.selectedResponsibilities.some((item) => item.toLowerCase() === chip.toLowerCase());
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => toggleResponsibility(chip)}
                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                      selected ? "border-gold bg-gold/25 text-ink" : "border-ink/10 bg-paper text-ink/80 hover:border-spruce"
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {hasExperienceSignalText && detectedToolHints.length > 0 && (
          <details className="rounded-md bg-white p-3">
            <summary className="cursor-pointer text-sm font-bold text-ink">+ Add tools used</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {detectedToolHints.map((tool) => {
                const selected = selectedTools.some((item) => item.toLowerCase() === tool.toLowerCase());
                return (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => toggleAdaptiveTool(tool)}
                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                      selected ? "border-gold bg-gold/25 text-ink" : "border-ink/10 bg-paper text-ink/80 hover:border-spruce"
                    }`}
                  >
                    {tool}
                  </button>
                );
              })}
            </div>
          </details>
        )}

        {shouldAskIndustry && (
          <details className="rounded-md bg-white p-3">
            <summary className="cursor-pointer text-sm font-bold text-ink">+ Add industry context</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {industryOptions.slice(0, 10).map((industry) => (
                <button
                  key={industry}
                  type="button"
                  onClick={() => update("customRoleIndustry", industry)}
                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    data.customRoleIndustry === industry ? "border-gold bg-gold/25 text-ink" : "border-ink/10 bg-paper text-ink/80 hover:border-spruce"
                  }`}
                >
                  {industry}
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  function renderEvidenceBackedRecommendations() {
    if (!careerEvidence.length || !careerRecommendations.length) return null;

    return (
      <div className="rounded-md border border-cyan/20 bg-cyan/10 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-spruce">Evidence-backed next moves</p>
        <h3 className="mt-2 text-xl font-bold text-ink">We found these strengths:</h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {careerEvidence.slice(0, 8).map((item) => (
            <span key={item.id} className="rounded-md border border-cyan/20 bg-white/75 px-3 py-2 text-sm font-semibold text-ink/78">
              &#10003; {item.label}
            </span>
          ))}
        </div>

        <div className="mt-5 grid gap-3">
          {careerRecommendations.map((recommendation) => (
            <article key={recommendation.title} className="rounded-md border border-ink/10 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-spruce">{recommendation.confidence}</p>
                  <h4 className="mt-1 text-lg font-black text-ink">{recommendation.title}</h4>
                  <p className="mt-1 text-sm font-semibold text-ink/58">{recommendation.roleFamily}</p>
                </div>
                <button
                  type="button"
                  onClick={() => selectRecommendedCareer(recommendation)}
                  className="min-h-10 rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm font-bold text-ink transition hover:border-gold hover:bg-gold/15"
                >
                  Use this target
                </button>
              </div>

              <div className="mt-4 rounded-md border border-ink/8 bg-paper/70 p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-ink/55">Evidence chain</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/72">{recommendation.evidenceChain.join(" -> ")}</p>
              </div>

              <div className="mt-4">
                <p className="text-sm font-black text-ink">Why this fits:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-ink/72">
                  {recommendation.why.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  function renderQuestion() {
    switch (question.id) {
      case "quick_start":
        return (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {quickStartPaths.map((path) => (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => setQuickStartPath(path.id)}
                  className={`min-h-12 rounded-md border px-4 text-left text-sm font-bold transition ${
                    quickStartPath === path.id
                      ? "border-gold bg-gold text-ink"
                      : "border-ink/12 bg-white text-ink hover:border-spruce"
                  }`}
                >
                  {path.label}
                </button>
              ))}
            </div>
            {quickStartPath === "other" && (
              <label className="block">
                <span className="sr-only">What are you trying to do with this resume?</span>
                <textarea
                  value={quickStartText}
                  onChange={(event) => updateQuickStart(event.target.value)}
                  placeholder="Example: Helped customers, stocked shelves."
                  rows={3}
                  className="trust-input w-full rounded-md border px-4 py-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
                />
              </label>
            )}
          </div>
        );
      case "name":
        return renderField("fullName", "What name should appear on the resume?", "Jordan Lee");
      case "email":
        return renderField("email", "What email should recruiters use?", "jordan@email.com", "email");
      case "contact":
        return (
          <div className="grid gap-5 md:grid-cols-2">
            {renderField("phone", "Phone number", "(555) 123-4567", "text", "Optional. Skip if you do not want it on the resume.")}
            {renderField("website", "Portfolio, LinkedIn, or website", "jordanlee.com", "text", "Optional. Add one clean link if it helps your candidacy.")}
          </div>
        );
      case "target":
        return (
          <div className="space-y-4">
            <label className="block">
              <span className="sr-only">Search or enter a target role</span>
              <input
                type="text"
                value={data.targetJobTitle}
                onChange={(event) => updateTargetRole(event.target.value)}
                onFocus={() => setTargetSearchOpen(true)}
                onBlur={(event) => commitTargetRole(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && targetMatches[0]) {
                    event.preventDefault();
                    selectCareerTarget(targetMatches[0]);
                  }
                }}
                placeholder="Example: Customer Support"
                aria-invalid={Boolean(errors.targetJobTitle)}
                className={inputClass("targetJobTitle")}
              />
              {errors.targetJobTitle && (
                <span className="mt-2 block text-sm font-semibold text-coral">{errors.targetJobTitle}</span>
              )}
            </label>
            {showTargetMatches && (
              <div className="rounded-md bg-white p-2 shadow-soft">
                {targetMatches.length ? (
                  <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
                    {targetMatches.map((target) => (
                      <button
                        key={`${target.title}-${target.roleFamily}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectCareerTarget(target)}
                        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition ${
                          data.targetJobTitle === target.title && data.roleFamily === target.roleFamily
                            ? "border-gold bg-gold/20"
                            : "border-ink/10 bg-paper hover:border-spruce"
                        }`}
                      >
                        <span className="text-sm font-bold text-ink">{target.title}</span>
                        <span className="shrink-0 rounded-full border border-cyan/20 bg-cyan/10 px-2 py-1 text-[0.68rem] font-bold text-spruce">
                          {target.roleFamily}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-2 py-3 text-sm text-ink/65">No match. Keep typing.</p>
                )}
              </div>
            )}
            {data.targetJobTitle.trim() && (
              <div className="rounded-md border border-cyan/20 bg-cyan/10 px-3 py-2 text-sm font-semibold text-ink">
                Lane: <span className="text-spruce">{data.roleFamily}</span>
                <button
                  type="button"
                  onClick={() => setShowRoleFamilyOptions((value) => !value)}
                  className="ml-2 font-black uppercase tracking-[0.1em] text-ink underline decoration-cyan/50 underline-offset-4 hover:text-spruce"
                >
                  Change lane
                </button>
              </div>
            )}
            {showRoleFamilyOptions && (
              <div className="rounded-md bg-white p-3">
                <div className="flex flex-wrap gap-2">
                  {roleFamilies.map((roleFamily) => (
                    <button
                      key={roleFamily}
                      type="button"
                      onClick={() => setRoleFamily(roleFamily)}
                      className={`rounded-full border px-3 py-2 text-sm font-bold transition ${
                        data.roleFamily === roleFamily
                          ? "border-gold bg-gold text-ink"
                          : "border-ink/15 bg-paper/70 text-ink hover:border-spruce"
                      }`}
                    >
                      {roleFamily}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case "current_role":
        return renderAdaptiveExperienceQuestion();
      case "current_company":
        return (
          <div className="grid gap-5">
            {renderCompanyPicker("currentCompany", "Where did you do that work?")}
            {renderField("currentTime", "Dates or time in role", "Jan 2024 - Present")}
          </div>
        );
      case "previous_role":
        return renderNaturalRoleQuestion("previous", "Tell me about a previous role.");
      case "additional_role":
        return renderNaturalRoleQuestion("additional", "Want to add one more role?");
      case "tools":
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {visibleToolChips.map((tool) => {
                const selected = selectedTools.some((item) => item.toLowerCase() === tool.toLowerCase());
                return (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => {
                      if (tool === "Other") {
                        setToolSearchOpen(true);
                        return;
                      }
                      toggleTool(tool);
                    }}
                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                      selected ? "border-gold bg-gold/25 text-ink" : "border-ink/10 bg-white text-ink/80 hover:border-spruce"
                    }`}
                  >
                    {tool}
                  </button>
                );
              })}
            </div>
            <div className="rounded-md bg-white p-3">
              <label htmlFor="tool-search" className="sr-only">Search tools</label>
              <input
                id="tool-search"
                type="text"
                value={toolSearch}
                onChange={(event) => {
                  setToolSearch(event.target.value);
                  setToolSearchOpen(true);
                }}
                onFocus={() => setToolSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && toolMatches[0]) {
                    event.preventDefault();
                    toggleTool(toolMatches[0]);
                  }
                }}
                placeholder="Add another tool"
                className="trust-input min-h-12 w-full rounded-md border px-4 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
              {toolSearchOpen && toolSearch.trim().length >= 2 && (
                <div className="mt-3 rounded-md bg-paper p-2 shadow-soft">
                  <div className="flex flex-wrap gap-2">
                    {toolMatches.map((tool) => (
                      <button
                        key={tool}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => toggleTool(tool)}
                        className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                          selectedTools.some((item) => item.toLowerCase() === tool.toLowerCase())
                            ? "border-gold bg-gold/20 text-ink"
                            : "border-ink/12 bg-white text-ink hover:border-spruce"
                        }`}
                      >
                        {tool}
                      </button>
                    ))}
                  </div>
                  {!toolMatches.length && <p className="px-2 py-3 text-sm leading-6 text-ink/65">No tool match. Add a custom tool below.</p>}
                </div>
              )}
              {toolSearchOpen && (
              <div className="mt-3 pt-1">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={customTool}
                    onChange={(event) => setCustomTool(event.target.value)}
                    placeholder="Custom tool"
                    className="trust-input min-h-10 flex-1 rounded-md border px-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
                  />
                  <button type="button" onClick={addCustomTool} className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-paper transition hover:bg-gold hover:text-ink">
                    Add
                  </button>
                </div>
              </div>
              )}
            </div>
            <div className="rounded-md bg-paper p-3">
              <h3 className="text-sm font-bold text-ink">Selected tools</h3>
              {selectedTools.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTools.map((tool) => (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => toggleTool(tool)}
                      className="rounded-full border border-gold/40 bg-gold/15 px-3 py-2 text-sm font-semibold text-ink"
                    >
                      {tool}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-ink/72">No tools selected yet.</p>
              )}
            </div>
            {selectedAiToolNames.length > 0 && (
              <div className="rounded-md border border-cyan/20 bg-white p-3">
                <p className="text-sm font-bold text-ink">How did you actually use AI?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {aiWorkflowSuggestions.map((workflow) => (
                    <button
                      key={workflow}
                      type="button"
                      onClick={() => toggleAiWorkflow(workflow)}
                      className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                        data.selectedAiWorkflows.includes(workflow)
                          ? "border-cyan bg-cyan/20 text-ink"
                          : "border-ink/10 bg-paper text-ink/80 hover:border-cyan"
                      }`}
                    >
                      {workflow}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case "responsibilities":
        return (
          <div className="space-y-4">
            <div className="rounded-md border border-cyan/20 bg-white p-3">
              <p className="text-sm font-bold text-ink">Pick responsibilities that are true</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {roleQuickResponsibilities.map((item) => {
                  const selected = data.selectedResponsibilities.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleResponsibility(item)}
                      className={selected
                        ? "rounded-full border border-gold bg-gold/25 px-3 py-2 text-sm font-semibold text-ink"
                        : "rounded-full border border-ink/10 bg-paper px-3 py-2 text-sm font-semibold text-ink/80 transition hover:border-spruce"}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-md border border-gold/20 bg-paper p-3">
              <p className="text-sm font-bold text-ink">Pick skills you actually used</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {roleQuickSkills.map((item) => {
                  const selected = data.customRoleTransferableSkills.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleTransferableSkill(item)}
                      className={selected
                        ? "rounded-full border border-gold bg-gold/25 px-3 py-2 text-sm font-semibold text-ink"
                        : "rounded-full border border-ink/10 bg-white px-3 py-2 text-sm font-semibold text-ink/80 transition hover:border-spruce"}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">Add anything missing (optional)</span>
              <textarea
                value={data.responsibilities}
                onChange={(event) => updateExperienceStory(event.target.value)}
                placeholder="Example: Helped customers, updated records."
                rows={5}
                className="trust-input w-full rounded-md border px-4 py-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
            </label>

            {hasExperienceSignalText && activeFollowUpSignal && (
              <div className="rounded-md bg-white p-3">
                <p className="text-sm font-bold text-ink">Pick what is true</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeFollowUpSignal.chips.slice(0, 6).map((chip) => {
                    const selected = data.selectedResponsibilities.some((item) => item.toLowerCase() === chip.toLowerCase());
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => toggleResponsibility(chip)}
                        className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                          selected ? "border-gold bg-gold/25 text-ink" : "border-ink/10 bg-paper text-ink/80 hover:border-spruce"
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {data.selectedResponsibilities.length > 0 && (
              <div className="rounded-md bg-paper p-3">
                <span className="mb-2 block text-sm font-bold text-ink">Selected responsibilities</span>
                <div className="flex flex-wrap gap-2">
                  {data.selectedResponsibilities.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleResponsibility(item)}
                      className="rounded-full border border-gold/40 bg-gold/15 px-3 py-2 text-sm font-semibold text-ink"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case "scope":
        return (
          <div className="space-y-4">
            <label className="block">
              <span className="sr-only">Any number or proof detail you honestly remember?</span>
              <textarea
                value={scopeDraft}
                onChange={(event) => {
                  const value = event.target.value;
                  setScopeDraft(value);
                  // Uncertainty is a valid answer, but it must never be saved
                  // as proof — the draft simply proceeds without numbers.
                  const stored = isUncertaintyStatement(value) ? "" : value;
                  onChange({ ...data, customRoleNotes: stored, customersServed: stored });
                }}
                placeholder="Example: 30+ customers per shift."
                rows={5}
                className="trust-input w-full rounded-md border px-4 py-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
            </label>
            {isUncertaintyStatement(scopeDraft) && (
              <p className="rounded-md border border-cyan/20 bg-cyan/10 px-3 py-2 text-sm leading-6 text-ink/75">
                No problem — Career Forge will write your draft without numbers. &quot;I don&apos;t know&quot; never becomes a claim on your resume.
              </p>
            )}
          </div>
        );
      case "outcomes":
        return (
          <div className="space-y-4">
            <label className="block">
              <span className="sr-only">Did your work improve anything?</span>
              <textarea
                value={outcomeDraft}
                onChange={(event) => {
                  const value = event.target.value;
                  setOutcomeDraft(value);
                  update("outcomes", isUncertaintyStatement(value) ? "" : value);
                }}
                placeholder="Example: fewer errors, faster service."
                rows={4}
                className="trust-input w-full rounded-md border px-4 py-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
            </label>
            {isUncertaintyStatement(outcomeDraft) && (
              <p className="rounded-md border border-cyan/20 bg-cyan/10 px-3 py-2 text-sm leading-6 text-ink/75">
                That&apos;s fine — the draft will skip results claims instead of turning this into one.
              </p>
            )}
            {visibleOutcomes.length > 0 && (
              <div className="rounded-md bg-white p-3">
                <p className="text-sm font-bold text-ink">Pick any results that are true</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visibleOutcomes.slice(0, 6).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleOutcome(item)}
                      className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                        data.selectedOutcomes.includes(item) ? "border-gold bg-gold/25 text-ink" : "border-ink/10 bg-paper text-ink/80 hover:border-spruce"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case "education":
        return (
          <div className="space-y-4">
            <div className="rounded-md bg-white p-3">
              <label htmlFor="education-search" className="sr-only">Any education, training, certification, or license to include?</label>
              <input
                id="education-search"
                type="text"
                value={educationSearch}
                onChange={(event) => {
                  setEducationSearch(event.target.value);
                  setEducationSearchOpen(true);
                }}
                onFocus={() => setEducationSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && educationSuggestions[0]) {
                    event.preventDefault();
                    addEducationEntry(educationSuggestions[0]);
                  }
                }}
                placeholder="Example: GED, ServSafe, Google Certificate"
                className="trust-input min-h-12 w-full rounded-md border px-4 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
              {educationSearchOpen && educationSearch.trim().length >= 2 && (
                <div className="mt-4 rounded-md bg-paper p-2 shadow-soft">
                  <div className="flex flex-wrap gap-2">
                    {educationSuggestions.slice(0, 6).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => addEducationEntry(item)}
                        className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                          educationEntries.includes(item)
                            ? "border-gold bg-gold/20 text-ink"
                            : "border-ink/12 bg-white text-ink hover:border-spruce"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  {!educationSuggestions.length && <p className="px-2 py-3 text-sm leading-6 text-ink/65">No match. Add a custom credential below.</p>}
                </div>
              )}
              {educationSearch.trim().length >= 2 && (
                <p className="mt-3 rounded-md border border-gold/20 bg-gold/10 px-3 py-2 text-sm leading-6 text-ink/70">
                  {educationHelper}
                </p>
              )}
            </div>

            <div className="rounded-md bg-paper p-3">
              <p className="text-sm font-bold text-ink">Selected education</p>
              {educationEntries.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {educationEntries.map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => removeEducationEntry(entry)}
                      className="rounded-full border border-gold/40 bg-gold/15 px-3 py-2 text-sm font-semibold text-ink"
                    >
                      {entry}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-ink/70">No education added yet. This is optional.</p>
              )}
            </div>

            <div className="rounded-md bg-white p-3">
              <label htmlFor="custom-education" className="text-sm font-bold text-ink">
                Add a custom education line
              </label>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  id="custom-education"
                  type="text"
                  value={customEducation}
                  onChange={(event) => setCustomEducation(event.target.value)}
                  placeholder="Custom education, certification, training, or credential"
                  className="trust-input min-h-10 flex-1 rounded-md border px-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
                />
                <button
                  type="button"
                  onClick={addCustomEducation}
                  className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-paper transition hover:bg-gold hover:text-ink"
                >
                  Add custom
                </button>
              </div>
            </div>
          </div>
        );
      case "template":
        return (
          <label className="block">
            <span className="sr-only">Which resume style do you want?</span>
            <select
              value={selectedTemplate}
              onChange={(event) => onTemplateSelect(event.target.value as TemplateStyle)}
              className="trust-input min-h-12 w-full rounded-md border px-4 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
            >
              {templates.map((template) => (
                <option key={template} value={template}>
                  {template}
                </option>
              ))}
            </select>
          </label>
        );
      default:
        return (
          <div className="space-y-5">
            <div className={`rounded-md border p-4 ${hasEnoughSignal ? "border-cyan/20 bg-cyan/10" : "border-gold/25 bg-gold/10"}`}>
              <p className={`text-xs font-black uppercase tracking-[0.14em] ${hasEnoughSignal ? "text-spruce" : "text-gold"}`}>
                {hasEnoughSignal ? "Resume package ready" : "Quick draft ready"}
              </p>
              <h3 className="mt-2 text-xl font-bold text-ink">
                {hasEnoughSignal
                  ? "You gave Career Forge enough signal to build your first resume package."
                  : "You can generate now or add one optional detail first."}
              </h3>
              {!hasEnoughSignal && (
                <p className="mt-2 text-sm leading-6 text-ink/70">
                  Add one more detail if you want a stronger draft.
                </p>
              )}
              <div className="mt-4 grid gap-2 text-sm font-semibold text-ink/75 sm:grid-cols-2">
                <span className="rounded-md bg-white/70 px-3 py-2">Role target: {data.targetJobTitle || "Not added yet"}</span>
                <span className="rounded-md bg-white/70 px-3 py-2">Career lane: {data.roleFamily}</span>
                <span className="rounded-md bg-white/70 px-3 py-2">Tools: {selectedTools.length || 0} captured</span>
                <span className="rounded-md bg-white/70 px-3 py-2">Proof: {scopeSummary.length + data.selectedOutcomes.length} signals</span>
              </div>
            </div>
            <div className="rounded-md border border-ink/10 bg-white p-4">
              <p className="text-sm font-bold text-ink">Optional add-ons</p>
              <p className="mt-1 text-sm leading-6 text-ink/60">
                Skip these if you just want quick recommendations.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  ["+ Add another experience", "previous_role"],
                  ["+ Add tools used", "tools"],
                  ["+ Add certifications", "education"],
                  ["+ Add projects", "additional_role"],
                  ["+ Add more details", "responsibilities"],
                  ["+ Add proof or numbers", "scope"]
                ].map(([label, id]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => goToQuestionId(id as Question["id"])}
                    className="min-h-11 rounded-md border border-ink/12 bg-paper px-3 py-2 text-left text-sm font-bold text-ink transition hover:border-gold hover:bg-gold/10"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {shouldOfferSideWorkEntry && (
              <div className="rounded-md border border-gold/25 bg-gold/10 p-4">
                <p className="text-sm font-bold text-ink">We noticed project or volunteer work in what you wrote.</p>
                <p className="mt-1 text-sm leading-6 text-ink/70">
                  &quot;{detectedSideWorkSentence.trim()}&quot; — add it as its own entry so it shows up clearly in your draft.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    updateNaturalRoleInput("additional", detectedSideWorkSentence.trim());
                    goToQuestionId("additional_role");
                  }}
                  className="mt-3 min-h-11 rounded-md border border-ink/12 bg-white px-4 py-2 text-sm font-bold text-ink transition hover:border-gold hover:bg-gold/15"
                >
                  + Add it as a project entry
                </button>
              </div>
            )}
            {renderEvidenceBackedRecommendations()}
            <div className="grid gap-3 md:grid-cols-2">
              <ReviewItem label="Quick start path" value={quickStartPaths.find((path) => path.id === quickStartPath)?.label ?? "First resume"} onEdit={() => goToQuestionId("quick_start")} />
              <ReviewItem label="Contact" value={[data.fullName, data.email, data.phone, data.website].filter(Boolean).join(" / ")} onEdit={() => goToQuestionId("name")} />
              <ReviewItem label="Selected target role" value={data.targetJobTitle || "Not added yet"} onEdit={() => goToQuestionId("target")} />
              <ReviewItem label="Tailored career lane" value={data.roleFamily} onEdit={() => goToQuestionId("target")} />
              <ReviewItem label="Roles" value={formatList(roleSummary)} onEdit={() => goToQuestionId("current_role")} />
              <ReviewItem label="Tools" value={formatReviewItems(selectedTools)} onEdit={() => goToQuestionId("tools")} />
              {independentArsenal && (
                <ReviewItem
                  label="Independent work context"
                  value={formatReviewItems([
                    data.independentWorkType ? `Work type: ${data.independentWorkType}` : "",
                    `Category: ${independentCategory}`,
                    ...data.selectedIndependentWorkSignals
                  ])}
                  onEdit={() => goToQuestionId("responsibilities")}
                />
              )}
              {selectedAiToolNames.length > 0 && (
                <ReviewItem
                  label="AI workflow use"
                  value={formatReviewItems(data.selectedAiWorkflows)}
                  onEdit={() => goToQuestionId("tools")}
                />
              )}
              <ReviewItem
                label="Responsibilities"
                value={formatReviewItems([...data.selectedResponsibilities, ...data.selectedActions, data.responsibilities])}
                onEdit={() => goToQuestionId("responsibilities")}
              />
              {needsUnknownRoleContext && (
                <ReviewItem
                  label="Custom role context"
                  value={formatReviewItems([
                    data.customRoleIndustry ? `Industry: ${data.customRoleIndustry}` : "",
                    data.customRoleWorkStyles.length ? `Work style: ${data.customRoleWorkStyles.join(", ")}` : "",
                    data.customRoleTransferableSkills.length ? `Transferable skills: ${data.customRoleTransferableSkills.join(", ")}` : "",
                    data.customRoleNotes ? `Notes: ${data.customRoleNotes}` : ""
                  ])}
                  onEdit={() => goToQuestionId("responsibilities")}
                />
              )}
              <ReviewItem label="Scope" value={formatReviewItems(scopeSummary)} onEdit={() => goToQuestionId("scope")} />
              <ReviewItem
                label="Outcomes"
                value={formatReviewItems([...data.selectedOutcomes, data.outcomes])}
                onEdit={() => goToQuestionId("outcomes")}
              />
              <ReviewItem label="Education & credentials" value={formatReviewItems(educationEntries)} onEdit={() => goToQuestionId("education")} />
              <ReviewItem
                label="Adaptive signals"
                value={`${data.roleFamily} scope prompts / ${roleOutcomes.join(", ")}`}
                onEdit={() => goToQuestionId("target")}
              />
              <ReviewItem label="Template" value={selectedTemplate} onEdit={() => goToQuestionId("template")} />
            </div>
          </div>
        );
    }
  }

  function renderLeftPanelSignalStatus() {
    return (
      <p className="mt-5 inline-flex rounded-md border border-cyan/20 bg-cyan/10 px-3 py-2 text-sm font-semibold text-cyan">
        {getMomentumConfirmation()}
      </p>
    );
  }

  return (
    <section className="mx-auto max-w-5xl scroll-mt-28 px-5 py-12 sm:px-8" id="intake">
      <form
        className="trust-panel p-4 shadow-glow sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          continueQuestion();
        }}
      >
        <div className="mb-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-label={`Interview progress ${stageProgress}%`}>
            <div className="completion-pulse h-full rounded-full bg-cyan transition-all duration-500" style={{ width: `${stageProgress}%` }} />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.58fr_1.42fr]">
          <aside className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gold">Module 05 intake</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-paper">{question.title}</h2>
            {renderLeftPanelSignalStatus()}
          </aside>

          <div className="dark-form-card p-4">
            {hasEnoughSignal && questionIndex < questions.length - 1 && (
              <div className="mb-4 rounded-md border border-cyan/25 bg-cyan/10 p-3">
                <p className="text-sm font-bold text-spruce">Ready to generate.</p>
                <button
                  type="button"
                  onClick={onGenerate}
                  className="lab-pill-button mt-3 px-4 py-2 text-sm font-black transition"
                >
                  Generate now
                </button>
              </div>
            )}
            {renderQuestion()}
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-ink/10 pt-4 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={backQuestion}
                disabled={questionIndex === 0}
                className="min-h-12 rounded-full border border-ink/15 bg-white px-6 font-bold text-ink transition hover:border-gold disabled:cursor-not-allowed disabled:opacity-45"
              >
                Back
              </button>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                {isOptionalQuestion && question.id !== "review" && (
                  <button
                    type="button"
                    onClick={() => goToQuestionId("review")}
                    className="min-h-12 rounded-full border border-ink/15 bg-white px-6 font-bold text-ink transition hover:border-gold"
                  >
                    Skip / I&apos;m not sure
                  </button>
                )}
                <button
                  type="submit"
                  className="min-h-12 rounded-full bg-ink px-6 font-bold text-paper transition hover:bg-gold hover:text-ink"
                >
                  {getContinueLabel()}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}

function ReviewItem({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="rounded-md border border-ink/10 bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-spruce">{label}</h3>
        <button type="button" onClick={onEdit} className="text-xs font-black uppercase tracking-[0.12em] text-ink hover:text-spruce">
          Edit
        </button>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink/72">{value || "Not added yet"}</p>
    </div>
  );
}
