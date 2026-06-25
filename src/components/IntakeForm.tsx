"use client";

import { useMemo, useState } from "react";
import {
  actionSuggestionsByFamily,
  careerTargets,
  companySuggestions,
  findJobArsenal,
  getExperienceArsenal,
  type CareerTarget,
  outcomeOptions,
  outcomeSuggestionsByFamily,
  responsibilitySuggestions,
  roleFamilies,
  scopePromptSets,
  templates,
  allToolOptions,
  toolSuggestionsByFamily
} from "@/lib/career-data";
import { formatParsedRoleConfirmation, parseRoleAnswer, type ParsedRoleAnswer } from "@/lib/natural-role-parser";
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
  | "internal_application";

type MomentumStage = "Identity" | "Target" | "Experience" | "Arsenal" | "Proof" | "Review";
type RoleSlot = "current" | "previous" | "additional";

type RoleSlotConfig = {
  companyKey: "currentCompany" | "previousCompany" | "additionalCompany";
  inputPlaceholder: string;
  timeKey: "currentTime" | "previousTime" | "additionalTime";
  titleKey: "currentTitle" | "previousTitle" | "additionalTitle";
};

const requiredKeys: Array<keyof IntakeData> = ["fullName", "email", "targetJobTitle", "currentTitle"];

const questions: Question[] = [
  {
    id: "quick_start",
    title: "What kind of resume are we building today?",
    helper: "Pick the closest path. This only changes examples and coaching, not the final resume rules.",
    validate: []
  },
  {
    id: "name",
    title: "What's your full name?",
    helper: "This becomes the name line at the top of the resume.",
    validate: ["fullName"]
  },
  {
    id: "email",
    title: "What email should recruiters use?",
    helper: "Use the address you want on the final resume header.",
    validate: ["email"]
  },
  {
    id: "contact",
    title: "Want to add phone or portfolio?",
    helper: "Skip anything that does not apply. One clean link is enough.",
    validate: []
  },
  {
    id: "target",
    title: "What role are you aiming for?",
    helper: "Search a specific title or type your own. Known titles map to the right role family automatically.",
    validate: ["targetJobTitle"]
  },
  {
    id: "current_role",
    title: "Tell me about your most recent role.",
    helper: "Example: I worked at DraftKings as a sportsbook writer from 2024 to now.",
    validate: ["currentTitle"]
  },
  {
    id: "current_company",
    title: "Where did you do that work?",
    helper: "Company and dates help the resume read like a real work history.",
    validate: []
  },
  {
    id: "previous_role",
    title: "Tell me about a previous role.",
    helper: "Natural answers are fine. Example: I was a security officer at Allied Universal for two years.",
    validate: []
  },
  {
    id: "additional_role",
    title: "Want to add one more role?",
    helper: "Optional. Describe it naturally or skip if this does not apply.",
    validate: []
  },
  {
    id: "tools",
    title: "What tools or platforms did you use?",
    helper: "Think software, systems, equipment, spreadsheets, CRMs, ticketing tools, or internal platforms.",
    validate: []
  },
  {
    id: "responsibilities",
    title: "What responsibilities did you actually handle?",
    helper: "You do not need resume language. Pick examples or write it the way you would say it.",
    validate: []
  },
  {
    id: "scope",
    title: "What kind of volume did you handle?",
    helper: "Approximate numbers are okay. Skip anything you do not remember.",
    validate: []
  },
  {
    id: "outcomes",
    title: "What did your work improve?",
    helper: "Select outcomes you can honestly stand behind.",
    validate: []
  },
  {
    id: "template",
    title: "Pick your resume module style.",
    helper: "All three are single-column, ATS-safe, and neutral in exported resume content.",
    validate: []
  },
  {
    id: "review",
    title: "Review the dossier.",
    helper: "Check the captured signals before generating the resume package.",
    validate: []
  }
];

const quickStartPaths: Array<{ id: QuickStartPath; label: string; helper: string }> = [
  { id: "first_resume", label: "I'm building my first resume", helper: "We will use simple examples and remind you that school, part-time work, and projects count." },
  { id: "career_change", label: "I'm changing careers", helper: "We will emphasize transferable skills and proof from past roles." },
  { id: "old_resume", label: "I'm updating an old resume", helper: "We will focus on recent work, cleaner bullets, and stronger numbers." },
  { id: "knows_experience", label: "I already know my experience", helper: "We will keep the flow quick and let you confirm key signals." },
  { id: "project_based", label: "I have projects instead of work experience", helper: "We will treat projects, coursework, shipped work, or volunteer work as usable proof." },
  { id: "internal_application", label: "I'm applying internally", helper: "We will look for reliability, process knowledge, and cross-team support." }
];

const momentumStages: MomentumStage[] = ["Identity", "Target", "Experience", "Arsenal", "Proof", "Review"];

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
    inputPlaceholder: "I worked at DraftKings as a sportsbook writer from 2024 to now.",
    timeKey: "currentTime",
    titleKey: "currentTitle"
  },
  previous: {
    companyKey: "previousCompany",
    inputPlaceholder: "I was a security officer at Allied Universal for two years.",
    timeKey: "previousTime",
    titleKey: "previousTitle"
  },
  additional: {
    companyKey: "additionalCompany",
    inputPlaceholder: "I founded Koinophobia Labs in 2025.",
    timeKey: "additionalTime",
    titleKey: "additionalTitle"
  }
};

const allScopeFields: Array<{ key: keyof IntakeData; label: string }> = [
  { key: "customersServed", label: "Customers/users" },
  { key: "ticketsHandled", label: "Tickets/requests" },
  { key: "projectsSupported", label: "Projects" },
  { key: "teamSizeSupported", label: "Team size" },
  { key: "callsHandled", label: "Calls/follow-ups" },
  { key: "reportsCreated", label: "Reports/docs" },
  { key: "revenueInfluenced", label: "Revenue/budget" }
];

const templateDescriptions: Record<TemplateStyle, string> = {
  Corporate: "Classic spacing and conservative headings for business-facing roles.",
  "Modern ATS": "Balanced whitespace with clean, readable section hierarchy.",
  "Tech ATS": "Compact and keyword-forward for tools, support workflows, and technical roles."
};

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

const workStyleOptions = [
  "Customer-facing",
  "Administrative",
  "Operations",
  "Sales",
  "Technical support",
  "Data / reporting",
  "Coordination",
  "Management / supervision",
  "Physical / field work",
  "Compliance / safety",
  "Cash handling",
  "Inventory / fulfillment",
  "Creative / content",
  "Other"
];

const transferableSkillOptions = [
  "Customer communication",
  "Cash handling",
  "Payment processing",
  "Documentation",
  "Scheduling",
  "Record keeping",
  "Issue escalation",
  "Conflict resolution",
  "Compliance",
  "Policy enforcement",
  "Inventory tracking",
  "Reporting",
  "Team coordination",
  "Training others",
  "Data entry",
  "Quality control",
  "Safety procedures",
  "Technical troubleshooting",
  "Process improvement",
  "High-volume service"
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
  const [showAllScope, setShowAllScope] = useState(false);
  const [showAllOutcomes, setShowAllOutcomes] = useState(false);
  const [showRoleFamilyOptions, setShowRoleFamilyOptions] = useState(false);
  const [targetSearchOpen, setTargetSearchOpen] = useState(false);
  const [activeCompanyKey, setActiveCompanyKey] = useState<"currentCompany" | "previousCompany" | "additionalCompany" | null>(null);
  const [customCompany, setCustomCompany] = useState("");
  const [toolSearch, setToolSearch] = useState("");
  const [toolSearchOpen, setToolSearchOpen] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [customTool, setCustomTool] = useState("");
  const [responsibilitySearch, setResponsibilitySearch] = useState("");
  const [responsibilitySearchOpen, setResponsibilitySearchOpen] = useState(false);
  const [customResponsibility, setCustomResponsibility] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [customWorkStyle, setCustomWorkStyle] = useState("");
  const [customTransferableSkill, setCustomTransferableSkill] = useState("");
  const [quickStartPath, setQuickStartPath] = useState<QuickStartPath>("first_resume");
  const [showHelpMeThink, setShowHelpMeThink] = useState(false);
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
  const suggestions = responsibilitySuggestions[data.roleFamily];
  const actionSuggestions = actionSuggestionsByFamily[data.roleFamily];
  const roleScopePrompts = scopePromptSets[data.roleFamily];
  const roleOutcomes = outcomeSuggestionsByFamily[data.roleFamily];
  const experienceArsenal = getExperienceArsenal([
    data.currentTitle,
    data.previousTitle,
    data.additionalTitle,
    data.targetJobTitle
  ]);
  const unknownRoleTitles = [
    data.targetJobTitle,
    data.currentTitle,
    data.previousTitle,
    data.additionalTitle
  ].filter((title) => title.trim() && !hasKnownRole(title));
  const needsUnknownRoleContext = Boolean(unknownRoleTitles.length);
  const visibleOutcomes = showAllOutcomes ? outcomeOptions : roleOutcomes;
  const selectedTools = splitSelections(data.tools);
  const roleAwareToolOptions = toolSuggestionsByFamily[data.roleFamily];
  const toolMatches = filterOptions(
    toolSearch.trim() ? allToolOptions : roleAwareToolOptions,
    toolSearch,
    toolSearch.trim() ? 8 : showMoreTools ? 12 : 6
  );
  const responsibilityMatches = filterOptions(suggestions, responsibilitySearch, responsibilitySearch.trim() ? 8 : 6);
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
  const showTargetMatches = targetSearchOpen && (!exactTargetMatch || Boolean(normalizedTargetQuery));
  const selectedSignals = data.selectedResponsibilities.length + data.selectedOutcomes.length;
  const pathGuidance = quickStartPaths.find((path) => path.id === quickStartPath)?.helper ?? quickStartPaths[0].helper;
  const currentStage = questionStages[question.id];
  const currentStageIndex = momentumStages.indexOf(currentStage);
  const stageProgress = Math.round(((currentStageIndex + 1) / momentumStages.length) * 100);

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
  const readiness = getReadiness();

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
      onChange(applyParsedRole(slot, parsed));
    }
  }

  function roleFollowUp(parsed: ParsedRoleAnswer) {
    if (parsed.missingField === "title") return "What was your title?";
    if (parsed.missingField === "company") return "What company was that with?";
    if (parsed.missingField === "dates") return "What dates or time in role should I use?";
    return "Confirm the details before moving on.";
  }

  function getSectionState(label: string, strong: boolean, good: boolean, needsMoreDetail = false) {
    if (strong) return { label, status: "Strong", tone: "border-cyan/35 bg-cyan/10 text-cyan" };
    if (good) return { label, status: "Good", tone: "border-gold/35 bg-gold/10 text-gold" };
    if (needsMoreDetail) return { label, status: "Needs More Detail", tone: "border-ember/35 bg-ember/10 text-ember" };
    return { label, status: "Missing", tone: "border-white/10 bg-white/5 text-paper/55" };
  }

  function getReadiness() {
    const hasScope = scopeSummary.length > 0;
    const hasOutcome = data.selectedOutcomes.length > 0 || data.outcomes.trim().length > 0;
    const sections = [
      getSectionState("Target Role", Boolean(data.targetJobTitle.trim()), Boolean(data.roleFamily)),
      getSectionState("Experience", Boolean(data.currentTitle.trim() && data.currentCompany.trim()), Boolean(data.currentTitle.trim() || data.previousTitle.trim() || data.additionalTitle.trim()), Boolean(data.currentTitle.trim())),
      getSectionState("Skills", selectedTools.length >= 3 || data.selectedResponsibilities.length >= 4, Boolean(selectedTools.length || data.selectedResponsibilities.length), Boolean(data.responsibilities.trim())),
      getSectionState("Achievements", hasOutcome && data.selectedActions.length > 0, hasOutcome || data.selectedActions.length > 0, Boolean(data.selectedActions.length)),
      getSectionState("Metrics", hasScope && scopeSummary.length >= 2, hasScope)
    ];
    const score = Math.round(
      (sections.reduce((sum, section) => sum + (section.status === "Strong" ? 1 : section.status === "Good" ? 0.68 : 0), 0) / sections.length) * 100
    );
    return { sections, score };
  }

  function getMomentumConfirmation() {
    if (question.id === "target" && data.targetJobTitle.trim()) return `Lane locked: ${data.roleFamily}`;
    if (question.id === "tools" && selectedTools.length) return "Tools added to your dossier";
    if (question.id === "responsibilities" && (data.selectedResponsibilities.length || data.selectedActions.length)) {
      return "Experience signals captured";
    }
    if (question.id === "review") return "Ready to forge resume package";
    if (questionIndex > 0) return stageConfirmations[currentStage];
    return "Dossier started";
  }

  function getContinueLabel() {
    if (question.id === "target") return "Lock career lane";
    if (question.id === "current_role" || question.id === "current_company") return "Add experience";
    if (question.id === "tools" || question.id === "responsibilities") return "Capture signals";
    if (question.id === "scope" || question.id === "outcomes" || question.id === "template") return "Review dossier";
    if (question.id === "review") return "Forge resume";
    return "Continue";
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

  function addConfirmedTool(item: string) {
    if (selectedTools.some((tool) => tool.toLowerCase() === item.toLowerCase())) return;
    update("tools", mergeSelection(data.tools, item));
  }

  function addCustomTool() {
    const normalized = normalizeSelection(customTool || toolSearch);
    if (!normalized) return;
    update("tools", mergeSelection(data.tools, normalized));
    setCustomTool("");
    setToolSearch("");
    setToolSearchOpen(false);
  }

  function addCustomResponsibility() {
    const normalized = normalizeSelection(customResponsibility || responsibilitySearch);
    if (!normalized) return;
    const selected = data.selectedResponsibilities.some((item) => item.toLowerCase() === normalized.toLowerCase())
      ? data.selectedResponsibilities
      : [...data.selectedResponsibilities, normalized];
    update("selectedResponsibilities", selected);
    setCustomResponsibility("");
    setResponsibilitySearch("");
    setResponsibilitySearchOpen(false);
  }

  function toggleResponsibility(item: string) {
    const selected = data.selectedResponsibilities.includes(item)
      ? data.selectedResponsibilities.filter((value) => value !== item)
      : [...data.selectedResponsibilities, item];
    update("selectedResponsibilities", selected);
    setResponsibilitySearch("");
  }

  function toggleArsenalSignal(item: string) {
    const selected = data.selectedResponsibilities.some((value) => value.toLowerCase() === item.toLowerCase())
      ? data.selectedResponsibilities.filter((value) => value.toLowerCase() !== item.toLowerCase())
      : [...data.selectedResponsibilities, item];
    update("selectedResponsibilities", selected);
  }

  function toggleOutcome(item: string) {
    const selected = data.selectedOutcomes.includes(item)
      ? data.selectedOutcomes.filter((value) => value !== item)
      : [...data.selectedOutcomes, item];
    update("selectedOutcomes", selected);
  }

  function toggleAction(item: string) {
    const selected = data.selectedActions.includes(item)
      ? data.selectedActions.filter((value) => value !== item)
      : [...data.selectedActions, item];
    update("selectedActions", selected);
  }

  function toggleFallbackList(key: "customRoleWorkStyles" | "customRoleTransferableSkills", item: string) {
    const selected = data[key].some((value) => value.toLowerCase() === item.toLowerCase())
      ? data[key].filter((value) => value.toLowerCase() !== item.toLowerCase())
      : [...data[key], item];
    update(key, selected);
  }

  function addCustomFallbackItem(key: "customRoleWorkStyles" | "customRoleTransferableSkills", value: string, clear: () => void) {
    const normalized = normalizeSelection(value);
    if (!normalized) return;
    if (!data[key].some((item) => item.toLowerCase() === normalized.toLowerCase())) {
      update(key, [...data[key], normalized]);
    }
    clear();
  }

  function exampleChipsForCurrentQuestion() {
    const examples: Partial<Record<Question["id"], string[]>> = {
      name: ["Jordan Lee", "Alex Rivera"],
      email: ["name@email.com", "first.last@gmail.com"],
      contact: ["(555) 123-4567", "linkedin.com/in/yourname", "yourportfolio.com"],
      target: ["Customer Success Associate", "Project Coordinator", "Help Desk Technician", "Administrative Assistant"],
      current_role: ["Retail Associate", "Security Officer", "Sportsbook Ticket Writer", "IT Support Intern", "Project Assistant"],
      current_company: ["DraftKings", "Target", "Local Business", "Contract Work", "Self-Employed"],
      previous_role: ["Cashier", "Front Desk Associate", "Customer Service Associate", "Campus Assistant"],
      additional_role: ["Volunteer Coordinator", "Class Project", "Freelance Support", "Internship"],
      tools: ["Salesforce", "Excel", "Slack", "Microsoft Office", "POS Systems", "Zendesk", "Git", "Internal Software"],
      responsibilities: ["Assisted customers", "Managed schedules", "Processed payments", "Created reports", "Solved technical issues", "Updated records"],
      scope: ["50+ customers per week", "25+ tickets", "3 active projects", "$10K+ handled", "5 weekly reports", "6-person team"],
      outcomes: ["Speed", "Accuracy", "Customer satisfaction", "Efficiency", "Reliability", "Compliance"],
      template: templates,
      review: ["Looks good", "Need to edit responsibilities", "Add one metric"]
    };
    return examples[question.id] ?? [];
  }

  function helpExamplesForCurrentQuestion() {
    const examples: Partial<Record<Question["id"], string[]>> = {
      quick_start: [
        "First resume: part-time work, class projects, clubs, and volunteer work count.",
        "Career change: focus on transferable skills and proof.",
        "Projects: shipped apps, coursework, portfolios, and independent work can carry the resume."
      ],
      target: [
        "Search the job title you would type into a job board.",
        "If you are unsure, pick a broad but real target like Operations Associate or Customer Support Specialist.",
        "Career Forge can clean weak wording, but a clear target makes the resume sharper."
      ],
      responsibilities: [
        "What did you usually do during a normal day?",
        "What problems did people come to you for?",
        "Did you update records, answer questions, coordinate schedules, process payments, or troubleshoot issues?",
        "Plain answers are fine: I helped people at the front desk."
      ],
      scope: [
        "Do you remember customers per day, tickets, projects, money handled, team size, reports, calls, or inventory?",
        "Approximate numbers are okay.",
        "If you do not know, skip it. Career Forge will not invent metrics."
      ],
      outcomes: [
        "Did your work make anything faster, cleaner, more accurate, more reliable, or easier for customers?",
        "Small improvements count if they are true.",
        "You can write this casually: fewer mistakes, faster replies, happier customers."
      ],
      tools: [
        "Think software, equipment, spreadsheets, internal systems, phones, registers, scanners, CRMs, or ticketing tools.",
        "Internal Software is acceptable if you do not know the system name."
      ]
    };
    return examples[question.id] ?? [
      "Short answers are enough.",
      "You do not need resume language yet.",
      "Skip what does not apply and keep moving."
    ];
  }

  function applyExampleChip(example: string) {
    if (question.id === "quick_start") return;
    if (question.id === "name") update("fullName", example);
    if (question.id === "email") update("email", example);
    if (question.id === "contact") {
      if (example.includes("@") || example.includes(".com") || example.includes("linkedin")) update("website", example);
      else update("phone", example);
    }
    if (question.id === "target") updateTargetRole(example);
    if (question.id === "current_role") update("currentTitle", example);
    if (question.id === "current_company") setCompany("currentCompany", example);
    if (question.id === "previous_role") update("previousTitle", example);
    if (question.id === "additional_role") update("additionalTitle", example);
    if (question.id === "tools") addConfirmedTool(example);
    if (question.id === "responsibilities") {
      if (!data.selectedResponsibilities.some((item) => item.toLowerCase() === example.toLowerCase())) {
        update("selectedResponsibilities", [...data.selectedResponsibilities, example]);
      }
    }
    if (question.id === "scope") {
      const metricKey = example.includes("ticket")
        ? "ticketsHandled"
        : example.includes("project")
          ? "projectsSupported"
          : example.includes("$")
            ? "revenueInfluenced"
            : example.includes("report")
              ? "reportsCreated"
              : example.includes("team")
                ? "teamSizeSupported"
                : "customersServed";
      update(metricKey, example as never);
    }
    if (question.id === "outcomes") toggleOutcome(example);
    if (question.id === "template" && templates.includes(example as TemplateStyle)) onTemplateSelect(example as TemplateStyle);
  }

  function skipCurrentQuestion(mode: "skip" | "not_sure" | "no_experience" | "projects") {
    if (mode === "no_experience") {
      onChange({
        ...data,
        currentTitle: data.currentTitle || "Entry-Level Experience",
        currentCompany: data.currentCompany || "Projects / Coursework / Volunteer Work"
      });
      advanceQuestion();
      return;
    }
    if (mode === "projects") {
      onChange({
        ...data,
        currentTitle: data.currentTitle || "Project Experience",
        currentCompany: data.currentCompany || "Independent Projects"
      });
      advanceQuestion();
      return;
    }
    continueQuestion();
  }

  function advanceQuestion() {
    if (questionIndex < questions.length - 1) {
      setQuestionIndex(questionIndex + 1);
      setShowHelpMeThink(false);
      window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
      return;
    }
    onGenerate();
  }

  function renderEaseHelpers() {
    const examples = exampleChipsForCurrentQuestion();
    if (question.id === "review") return null;
    return (
      <div className="mb-5 rounded-md border border-ink/10 bg-paper p-4">
        <p className="text-sm font-semibold leading-6 text-ink/70">
          You do not need resume language. Messy answers like &quot;I helped customers&quot; or &quot;I stocked inventory&quot; are useful.
        </p>
        {examples.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {examples.slice(0, 8).map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => applyExampleChip(example)}
                className="min-h-10 rounded-full border border-ink/10 bg-white px-3 text-sm font-semibold text-ink transition hover:border-gold hover:bg-gold/15"
              >
                {example}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowHelpMeThink((value) => !value)}
          className="mt-3 rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-black text-ink transition hover:border-gold"
        >
          Help Me Think
        </button>
        {showHelpMeThink && (
          <ul className="mt-3 space-y-2 text-sm leading-6 text-ink/68">
            {helpExamplesForCurrentQuestion().map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  function renderSkipOptions() {
    if (requiredKeys.some((key) => question.validate.includes(key))) {
      if (question.id !== "current_role") return null;
    }
    if (question.id === "quick_start" || question.id === "review") return null;
    return (
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => skipCurrentQuestion("skip")} className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-bold text-ink/75 transition hover:border-gold">
          Skip for now
        </button>
        <button type="button" onClick={() => skipCurrentQuestion("not_sure")} className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-bold text-ink/75 transition hover:border-gold">
          Not sure
        </button>
        {question.id === "current_role" && (
          <>
            <button type="button" onClick={() => skipCurrentQuestion("no_experience")} className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-bold text-ink/75 transition hover:border-gold">
              No formal experience
            </button>
            <button type="button" onClick={() => skipCurrentQuestion("projects")} className="rounded-md border border-cyan/25 bg-cyan/10 px-3 py-2 text-sm font-bold text-spruce transition hover:border-gold">
              Use projects instead
            </button>
          </>
        )}
      </div>
    );
  }

  function renderScopeInput(field: { key: keyof IntakeData; label: string; placeholder?: string; hint?: string }) {
    const quickChoices = scopeQuickChoices(field.key).slice(0, 3);
    return (
      <div key={field.key} className="rounded-md bg-white p-4">
        <span className="block text-sm font-bold text-ink">{field.label}</span>
        {field.hint && <span className="mt-1 block text-sm leading-5 text-ink/55">{field.hint}</span>}
        <div className="mt-3 flex flex-wrap gap-2">
          {quickChoices.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => update(field.key, choice as never)}
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                String(data[field.key]) === choice ? "border-gold bg-gold/25 text-ink" : "border-ink/10 bg-paper text-ink/80 hover:border-spruce"
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={String(data[field.key])}
          onChange={(event) => update(field.key, event.target.value as never)}
          placeholder={field.placeholder ?? "Custom estimate"}
          className="trust-input mt-3 min-h-11 w-full rounded-md border px-4 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
        />
      </div>
    );
  }

  function scopeQuickChoices(key: keyof IntakeData) {
    const choices: Partial<Record<keyof IntakeData, string[]>> = {
      customersServed: ["10+ weekly customers", "25+ weekly customers", "50+ weekly customers", "100+ weekly customers"],
      ticketsHandled: ["10+ tickets", "25+ tickets", "50+ tickets", "100+ tickets"],
      projectsSupported: ["1-2 active projects", "3-5 active projects", "5+ active projects"],
      teamSizeSupported: ["3-5 people", "6-10 people", "10+ people"],
      callsHandled: ["10+ weekly calls", "25+ weekly calls", "50+ weekly calls"],
      revenueInfluenced: ["$10K+ handled", "$50K+ supported", "$100K+ supported"],
      reportsCreated: ["2+ weekly reports", "5+ weekly reports", "10+ weekly reports"]
    };
    return choices[key] ?? [];
  }

  function renderCompanyPicker(key: "currentCompany" | "previousCompany" | "additionalCompany", label: string) {
    const value = String(data[key]);
    const companyQuery = value || customCompany;
    const matches = filterOptions(companySuggestions, companyQuery, companyQuery.trim() ? 8 : 5);
    const showMatches = activeCompanyKey === key;
    const hasExactCompany = hasExactOption(companySuggestions, value);

    return (
      <div className="rounded-md bg-white p-4">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-ink">{label}</span>
          <span className="mb-3 block text-sm leading-5 text-ink/55">Start typing to narrow the list, or choose a common suggestion.</span>
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
          <span className="mb-2 block text-sm font-semibold text-ink/70">Can&apos;t find it?</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={customCompany || (!hasExactCompany ? value : "")}
              onChange={(event) => setCustomCompany(event.target.value)}
              placeholder="Add custom company"
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
              Add custom
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderArsenalChips(title: string, items: string[], limit = 6) {
    if (!items.length) return null;
    return (
      <div>
        <p className="mb-2 text-sm font-bold text-ink">{title}</p>
        <div className="flex flex-wrap gap-2">
          {items.slice(0, limit).map((item) => {
            const selected = data.selectedResponsibilities.some((value) => value.toLowerCase() === item.toLowerCase());
            return (
              <button
                key={`${title}-${item}`}
                type="button"
                onClick={() => toggleArsenalSignal(item)}
                className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                  selected ? "border-gold bg-gold/25 text-ink" : "border-ink/10 bg-paper text-ink/80 hover:border-spruce"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderArsenalToolChips(items: string[]) {
    if (!items.length) return null;
    return (
      <div>
        <p className="mb-2 text-sm font-bold text-ink">Common tools</p>
        <div className="flex flex-wrap gap-2">
          {items.slice(0, 6).map((item) => {
            const selected = selectedTools.some((tool) => tool.toLowerCase() === item.toLowerCase());
            return (
              <button
                key={`arsenal-tool-${item}`}
                type="button"
                onClick={() => addConfirmedTool(item)}
                className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                  selected ? "border-gold bg-gold/25 text-ink" : "border-ink/10 bg-paper text-ink/80 hover:border-spruce"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderUnknownRoleFallback() {
    if (!needsUnknownRoleContext) return null;

    return (
      <div className="rounded-md bg-white p-4">
        <p className="text-sm font-bold text-ink">Tell Career Forge how to understand this role.</p>
        <p className="mt-1 text-sm leading-6 text-ink/60">
          One more signal helps translate {formatList(unknownRoleTitles.slice(0, 2))} without guessing.
        </p>

        <div className="mt-4 space-y-5">
          <div>
            <p className="mb-2 text-sm font-bold text-ink">What industry was this role in?</p>
            <div className="flex flex-wrap gap-2">
              {industryOptions.map((industry) => (
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
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={customIndustry}
                onChange={(event) => setCustomIndustry(event.target.value)}
                placeholder="Custom industry"
                className="trust-input min-h-10 flex-1 rounded-md border px-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
              <button
                type="button"
                onClick={() => {
                  const normalized = normalizeSelection(customIndustry);
                  if (!normalized) return;
                  update("customRoleIndustry", normalized);
                  setCustomIndustry("");
                }}
                className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-paper transition hover:bg-gold hover:text-ink"
              >
                Add custom
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-ink">What kind of work did it mostly involve?</p>
            <div className="flex flex-wrap gap-2">
              {workStyleOptions.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => toggleFallbackList("customRoleWorkStyles", style)}
                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    data.customRoleWorkStyles.includes(style) ? "border-gold bg-gold/25 text-ink" : "border-ink/10 bg-paper text-ink/80 hover:border-spruce"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={customWorkStyle}
                onChange={(event) => setCustomWorkStyle(event.target.value)}
                placeholder="Custom work style"
                className="trust-input min-h-10 flex-1 rounded-md border px-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
              <button
                type="button"
                onClick={() => addCustomFallbackItem("customRoleWorkStyles", customWorkStyle, () => setCustomWorkStyle(""))}
                className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-paper transition hover:bg-gold hover:text-ink"
              >
                Add custom
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-ink">Which of these were part of the job?</p>
            <div className="flex flex-wrap gap-2">
              {transferableSkillOptions.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleFallbackList("customRoleTransferableSkills", skill)}
                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    data.customRoleTransferableSkills.includes(skill) ? "border-gold bg-gold/25 text-ink" : "border-ink/10 bg-paper text-ink/80 hover:border-spruce"
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={customTransferableSkill}
                onChange={(event) => setCustomTransferableSkill(event.target.value)}
                placeholder="Custom transferable skill"
                className="trust-input min-h-10 flex-1 rounded-md border px-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
              <button
                type="button"
                onClick={() => addCustomFallbackItem("customRoleTransferableSkills", customTransferableSkill, () => setCustomTransferableSkill(""))}
                className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-paper transition hover:bg-gold hover:text-ink"
              >
                Add custom
              </button>
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-ink">Anything important about this role?</span>
            <textarea
              value={data.customRoleNotes}
              onChange={(event) => update("customRoleNotes", event.target.value)}
              placeholder="Optional: equipment, environment, customers, compliance, pace, or special responsibilities"
              rows={3}
              className="trust-input w-full rounded-md border px-4 py-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
            />
          </label>
        </div>
      </div>
    );
  }

  function continueQuestion() {
    if (!onValidate(question.validate)) return;
    if (questionIndex < questions.length - 1) {
      setQuestionIndex(questionIndex + 1);
      setShowHelpMeThink(false);
      window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
      return;
    }
    onGenerate();
  }

  function backQuestion() {
    setQuestionIndex(Math.max(0, questionIndex - 1));
    setShowHelpMeThink(false);
    window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
  }

  function goToQuestion(index: number) {
    setQuestionIndex(index);
    setShowHelpMeThink(false);
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
    const hasStructuredValue = Boolean(
      String(data[config.titleKey]).trim() || String(data[config.companyKey]).trim() || String(data[config.timeKey]).trim()
    );

    return (
      <div className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-ink">{label}</span>
          <span className="mb-2 block text-sm leading-5 text-ink/60">
            You can answer naturally. Career Forge will pull out the title, company, and dates when it can.
          </span>
          <textarea
            value={naturalRoleInputs[slot]}
            onChange={(event) => updateNaturalRoleInput(slot, event.target.value)}
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

        {(editMode || !hasStructuredValue) && (
          <div className="grid gap-4 rounded-md bg-white p-4 md:grid-cols-3">
            {renderField(config.titleKey, "Title", slot === "current" ? "Sportsbook Writer" : "Security Officer")}
            {renderCompanyPicker(config.companyKey, "Company")}
            {renderField(config.timeKey, "Dates or time in role", slot === "current" ? "2024-Present" : "2 years")}
          </div>
        )}
      </div>
    );
  }

  function renderQuestion() {
    switch (question.id) {
      case "quick_start":
        return (
          <div className="space-y-4">
            {quickStartPaths.map((path) => (
              <button
                key={path.id}
                type="button"
                onClick={() => setQuickStartPath(path.id)}
                className={`w-full rounded-md border p-4 text-left transition ${
                  quickStartPath === path.id ? "border-gold bg-gold/20" : "border-ink/10 bg-white hover:border-spruce"
                }`}
              >
                <span className="block text-base font-bold text-ink">{path.label}</span>
                <span className="mt-2 block text-sm leading-6 text-ink/65">{path.helper}</span>
              </button>
            ))}
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
          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">
                Search or enter a target role <span className="text-coral">*</span>
              </span>
              <span className="mb-2 block text-sm leading-5 text-ink/60">
                Pick a known role for automatic mapping, or keep typing if your exact title is not listed.
              </span>
              <input
                type="text"
                value={data.targetJobTitle}
                onChange={(event) => updateTargetRole(event.target.value)}
                onFocus={() => setTargetSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && targetMatches[0]) {
                    event.preventDefault();
                    selectCareerTarget(targetMatches[0]);
                  }
                }}
                placeholder="Example: Help Desk Technician, Project Coordinator, Sales Coordinator"
                aria-invalid={Boolean(errors.targetJobTitle)}
                className={inputClass("targetJobTitle")}
              />
              {errors.targetJobTitle && (
                <span className="mt-2 block text-sm font-semibold text-coral">{errors.targetJobTitle}</span>
              )}
            </label>
            {showTargetMatches && (
              <div className="rounded-md bg-white p-3 shadow-soft">
                <p className="mb-3 text-sm leading-5 text-ink/60">Start typing to narrow the list.</p>
                {targetMatches.length ? (
                  <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
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
                  <p className="text-sm leading-6 text-ink/65">
                    No catalog match. Keep your custom title and Career Forge will use the closest lane below.
                  </p>
                )}
              </div>
            )}
            <div className="rounded-md border border-cyan/20 bg-cyan/10 px-4 py-3 text-sm font-semibold text-ink">
              We&apos;ll tailor this for <span className="text-spruce">{data.roleFamily}</span>.
              <button
                type="button"
                onClick={() => setShowRoleFamilyOptions((value) => !value)}
                className="ml-2 font-black uppercase tracking-[0.1em] text-ink underline decoration-cyan/50 underline-offset-4 hover:text-spruce"
              >
                Change lane
              </button>
            </div>
            {showRoleFamilyOptions && (
              <div className="rounded-md bg-white p-4">
                <p className="text-sm font-bold text-ink">Choose a different lane</p>
                <p className="mt-2 text-sm leading-6 text-ink/65">
                  This only changes the prompts and resume tailoring. Use it if Career Forge guessed the wrong direction.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
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
        return renderNaturalRoleQuestion("current", "Tell me about your most recent role.");
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
          <div className="space-y-5">
            <div className="rounded-md bg-white p-4">
              <p className="text-sm font-bold text-ink">Suggested for {data.roleFamily}</p>
              <p className="mt-1 text-sm leading-6 text-ink/60">Pick tools you used. Search if you do not see one.</p>
              <input
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
                placeholder="Search tools..."
                className="trust-input mt-4 min-h-12 w-full rounded-md border px-4 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
              {toolSearchOpen && (
                <div className="mt-4 rounded-md bg-paper p-2 shadow-soft">
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
                  {!toolSearch.trim() && roleAwareToolOptions.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setShowMoreTools((value) => !value)}
                      className="mt-3 rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-bold text-ink transition hover:border-gold"
                    >
                      {showMoreTools ? "Fewer suggestions" : "More suggestions"}
                    </button>
                  )}
                </div>
              )}
              <div className="mt-4 pt-1">
                <span className="mb-2 block text-sm font-semibold text-ink/70">Can&apos;t find it?</span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={customTool}
                    onChange={(event) => setCustomTool(event.target.value)}
                    placeholder="Add custom tool"
                    className="trust-input min-h-10 flex-1 rounded-md border px-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
                  />
                  <button type="button" onClick={addCustomTool} className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-paper transition hover:bg-gold hover:text-ink">
                    Add custom
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-md bg-paper p-4">
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
          </div>
        );
      case "responsibilities":
        return (
          <div className="space-y-5">
            {renderUnknownRoleFallback()}
            {experienceArsenal && (
              <div className="rounded-md bg-white p-4">
                <p className="text-sm font-bold text-ink">
                  People in {experienceArsenal.title} commonly worked with...
                </p>
                <p className="mt-1 text-sm leading-6 text-ink/60">
                  Select only what you actually did. Career Forge will use confirmed items to strengthen resume language.
                </p>
                <div className="mt-4 space-y-4">
                  {renderArsenalChips("Responsibilities", experienceArsenal.responsibilities)}
                  {renderArsenalChips("Skills", experienceArsenal.skills)}
                  {renderArsenalChips("Workflows", experienceArsenal.workflows)}
                  <details>
                    <summary className="cursor-pointer text-sm font-bold text-ink">Resume keywords</summary>
                    <div className="mt-3">{renderArsenalChips("ATS keywords", experienceArsenal.atsKeywords, 6)}</div>
                  </details>
                  {renderArsenalToolChips(experienceArsenal.tools)}
                </div>
              </div>
            )}
            <div className="rounded-md bg-white p-4">
              <span className="mb-1 block text-sm font-bold text-ink">Did your work include any of these?</span>
              <span className="mb-3 block text-sm leading-5 text-ink/60">Choose a few. Search or add your own if needed.</span>
              <input
                type="text"
                value={responsibilitySearch}
                onChange={(event) => {
                  setResponsibilitySearch(event.target.value);
                  setResponsibilitySearchOpen(true);
                }}
                onFocus={() => setResponsibilitySearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && responsibilityMatches[0]) {
                    event.preventDefault();
                    toggleResponsibility(responsibilityMatches[0]);
                  }
                }}
                placeholder="Search responsibilities..."
                className="trust-input mb-4 min-h-12 w-full rounded-md border px-4 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
              {responsibilitySearchOpen && (
                <div className="rounded-md bg-paper p-2 shadow-soft">
                  <div className="flex flex-wrap gap-2">
                    {responsibilityMatches.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => toggleResponsibility(item)}
                        className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                          data.selectedResponsibilities.includes(item)
                            ? "border-gold bg-gold/20 text-ink"
                            : "border-ink/12 bg-white text-ink hover:border-spruce"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  {!responsibilityMatches.length && (
                    <p className="px-2 py-3 text-sm leading-6 text-ink/65">No responsibility match. Add your own below.</p>
                  )}
                </div>
              )}
              <div className="mt-4 rounded-md bg-paper p-3">
                <span className="mb-2 block text-sm font-bold text-ink">Selected responsibilities</span>
                {data.selectedResponsibilities.length ? (
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
                ) : (
                  <p className="text-sm leading-6 text-ink/65">No responsibilities selected yet.</p>
                )}
              </div>
              <div className="mt-4">
                <span className="mb-2 block text-sm font-semibold text-ink/70">Can&apos;t find it?</span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={customResponsibility}
                    onChange={(event) => setCustomResponsibility(event.target.value)}
                    placeholder="Add my own responsibility"
                    className="trust-input min-h-10 flex-1 rounded-md border px-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
                  />
                  <button type="button" onClick={addCustomResponsibility} className="rounded-md bg-ink px-4 py-2 text-sm font-bold text-paper transition hover:bg-gold hover:text-ink">
                    Add custom
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-md bg-white p-4">
              <span className="mb-2 block text-sm font-bold text-ink">Which of these did you do most?</span>
              <span className="mb-3 block text-sm leading-5 text-ink/60">
                Pick a few action signals. This helps Career Forge write bullets with less generic language.
              </span>
              <div className="flex flex-wrap gap-2">
                {actionSuggestions.map((item) => (
                  <label
                    key={item}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-ink/15 bg-paper/70 px-3 text-sm font-semibold text-ink transition has-[:checked]:border-gold has-[:checked]:bg-gold/20"
                  >
                    <input
                      type="checkbox"
                      checked={data.selectedActions.includes(item)}
                      onChange={() => toggleAction(item)}
                      className="h-4 w-4 accent-spruce"
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">Anything else Career Forge should know?</span>
              <span className="mb-2 block text-sm leading-5 text-ink/60">
                Optional. Plain language is fine if the chips missed something important.
              </span>
              <textarea
                value={data.responsibilities}
                onChange={(event) => update("responsibilities", event.target.value)}
                placeholder="Example: helped customers, updated records, escalated issues, prepared reports"
                rows={5}
                className="trust-input w-full rounded-md border px-4 py-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
            </label>
          </div>
        );
      case "scope":
        const visibleScopePrompts = roleScopePrompts.slice(0, 3);
        const additionalScopeFields = [
          ...roleScopePrompts.slice(3),
          ...allScopeFields.filter((field) => !roleScopePrompts.some((prompt) => prompt.key === field.key))
        ];

        return (
          <div className="space-y-5">
            <div className="rounded-md bg-white p-4">
              <p className="text-sm font-bold text-ink">Most useful numbers for {data.roleFamily}</p>
              <p className="mt-1 text-sm leading-6 text-ink/60">
                Estimate if you are not sure. Even rough volume makes the resume stronger.
              </p>
              {experienceArsenal?.measurableActivities.length ? (
                <p className="mt-3 text-sm leading-6 text-ink/60">
                  For {experienceArsenal.title}, common measures include {formatList(experienceArsenal.measurableActivities.slice(0, 4))}.
                </p>
              ) : null}
            </div>
            <div className="grid gap-4">
              {visibleScopePrompts.map(renderScopeInput)}
            </div>
            <details
              open={showAllScope}
              onToggle={(event) => setShowAllScope(event.currentTarget.open)}
              className="rounded-md bg-white p-4"
            >
              <summary className="cursor-pointer text-sm font-bold text-ink">
                Add more scope details
              </summary>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Use this only if another number helps tell the truth of your work.
              </p>
              <div className="mt-4 grid gap-4">
                {additionalScopeFields.map((field) => renderScopeInput({ ...field, placeholder: "Optional estimate" }))}
              </div>
            </details>
          </div>
        );
      case "outcomes":
        return (
          <div className="space-y-5">
            <div className="rounded-md border border-ink/10 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-spruce">
                Suggested outcomes for {data.roleFamily}
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Pick what your work actually improved. You can expand the full outcome set if needed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleOutcomes.map((item) => (
                <label
                  key={item}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-semibold text-ink transition has-[:checked]:border-gold has-[:checked]:bg-gold/20"
                >
                  <input
                    type="checkbox"
                    checked={data.selectedOutcomes.includes(item)}
                    onChange={() => toggleOutcome(item)}
                    className="h-4 w-4 accent-spruce"
                  />
                  {item}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowAllOutcomes((value) => !value)}
              className="rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-black uppercase tracking-[0.12em] text-ink transition hover:border-gold"
            >
              {showAllOutcomes ? "Show suggested outcomes" : "Show all outcomes"}
            </button>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">Any result you want reflected?</span>
              <span className="mb-2 block text-sm leading-5 text-ink/60">
                This can be informal: faster replies, fewer mistakes, happier customers, cleaner records.
              </span>
              <textarea
                value={data.outcomes}
                onChange={(event) => update("outcomes", event.target.value)}
                placeholder="Example: improved response time, reduced repeat errors, kept records audit-ready"
                rows={4}
                className="trust-input w-full rounded-md border px-4 py-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
            </label>
          </div>
        );
      case "template":
        return (
          <div className="grid gap-4 md:grid-cols-3">
            {templates.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => onTemplateSelect(template)}
                className={`min-h-36 rounded-md border bg-white p-5 text-left transition ${
                  selectedTemplate === template
                    ? "border-gold shadow-soft ring-4 ring-gold/20"
                    : "border-ink/12 hover:border-gold"
                }`}
              >
                <span className="text-lg font-bold text-ink">{template}</span>
                <span className="mt-3 block text-sm leading-6 text-ink/70">{templateDescriptions[template]}</span>
              </button>
            ))}
          </div>
        );
      default:
        return (
          <div className="space-y-5">
            <div className="rounded-md border border-cyan/20 bg-cyan/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-spruce">Resume package ready</p>
              <h3 className="mt-2 text-xl font-bold text-ink">You gave Career Forge enough signal to build your first resume package.</h3>
              <div className="mt-4 grid gap-2 text-sm font-semibold text-ink/75 sm:grid-cols-2">
                <span className="rounded-md bg-white/70 px-3 py-2">Role target: {data.targetJobTitle || "Not added yet"}</span>
                <span className="rounded-md bg-white/70 px-3 py-2">Career lane: {data.roleFamily}</span>
                <span className="rounded-md bg-white/70 px-3 py-2">Tools: {selectedTools.length || 0} captured</span>
                <span className="rounded-md bg-white/70 px-3 py-2">Proof: {scopeSummary.length + data.selectedOutcomes.length} signals</span>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ReviewItem label="Quick start path" value={quickStartPaths.find((path) => path.id === quickStartPath)?.label ?? "First resume"} onEdit={() => goToQuestionId("quick_start")} />
              <ReviewItem label="Contact" value={[data.fullName, data.email, data.phone, data.website].filter(Boolean).join(" / ")} onEdit={() => goToQuestionId("name")} />
              <ReviewItem label="Selected target role" value={data.targetJobTitle || "Not added yet"} onEdit={() => goToQuestionId("target")} />
              <ReviewItem label="Tailored career lane" value={data.roleFamily} onEdit={() => goToQuestionId("target")} />
              <ReviewItem label="Roles" value={formatList(roleSummary)} onEdit={() => goToQuestionId("current_role")} />
              <ReviewItem label="Tools" value={formatReviewItems(selectedTools)} onEdit={() => goToQuestionId("tools")} />
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

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8" id="intake">
      <form
        className="trust-panel rounded-md p-5 shadow-glow sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          continueQuestion();
        }}
      >
        <div className="mb-6 border-b border-white/10 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="trust-kicker text-sm font-bold uppercase">
              Resume Readiness
            </p>
            <span className="rounded-md border border-cyan/25 bg-cyan/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan">
              career://interview
            </span>
          </div>
          <div className="mt-5 grid gap-2 md:grid-cols-[8rem_1fr] md:items-center">
            <div>
              <p className="text-3xl font-black text-cyan">{readiness.score}%</p>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-paper/50">Ready to Generate</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              {readiness.sections.map((section) => (
                <span key={section.label} className={`rounded-md border px-3 py-2 text-xs font-bold ${section.tone}`}>
                  <span className="block text-paper/80">{section.label}</span>
                  <span className="mt-1 block uppercase tracking-[0.12em]">{section.status}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-label={`Interview progress ${stageProgress}%`}>
              <div className="completion-pulse h-full rounded-full bg-cyan transition-all duration-500" style={{ width: `${stageProgress}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {momentumStages.map((stage) => (
                <span
                  key={stage}
                  className={`rounded-full border px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.12em] ${
                    stage === currentStage
                      ? "border-cyan bg-cyan/10 text-cyan"
                      : momentumStages.indexOf(stage) < currentStageIndex
                        ? "border-gold/35 bg-gold/10 text-gold"
                        : "border-white/10 bg-white/5 text-paper/45"
                  }`}
                >
                  {stage}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="rounded-md border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gold">Module 05 intake</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-paper">{question.title}</h2>
            <p className="mt-4 text-sm leading-6 text-paper/68">{question.helper}</p>
            <p className="mt-3 text-sm leading-6 text-paper/58">{pathGuidance}</p>
            <p className="mt-5 rounded-md border border-cyan/20 bg-cyan/10 px-3 py-2 text-sm font-semibold text-cyan">
              {getMomentumConfirmation()}
            </p>
            <p className="mt-3 text-sm leading-6 text-paper/55">
              {questionIndex === questions.length - 1
                ? `${selectedSignals} guided signals captured. Review before generating.`
                : "One answer at a time. Short notes are enough."}
            </p>
          </aside>

          <div className="dark-form-card rounded-md p-4 sm:p-5">
            {renderEaseHelpers()}
            {renderQuestion()}
            {renderSkipOptions()}
            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={backQuestion}
                disabled={questionIndex === 0}
                className="min-h-12 rounded-md border border-ink/15 bg-white px-6 font-bold text-ink transition hover:border-gold disabled:cursor-not-allowed disabled:opacity-45"
              >
                Back
              </button>
              <button
                type="submit"
                className="min-h-12 rounded-md bg-ink px-6 font-bold text-paper transition hover:bg-gold hover:text-ink"
              >
                {getContinueLabel()}
              </button>
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
