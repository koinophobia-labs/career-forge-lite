import type { IntakeData, RoleFamily, TemplateStyle } from "@/types/career";

export const roleFamilies: RoleFamily[] = [
  "Tech",
  "Business",
  "Operations",
  "Customer Success",
  "Admin",
  "Sales",
  "Security",
  "Project Coordination",
  "IT Support"
];

export const templates: TemplateStyle[] = ["Corporate", "Modern ATS", "Tech ATS"];

export const roleIntelligence: Record<RoleFamily, { responsibilities: string[]; skills: string[]; valueArea: string }> = {
  Security: {
    responsibilities: [
      "Incident reporting",
      "Access control",
      "Surveillance monitoring",
      "Visitor management",
      "Emergency response",
      "Customer assistance"
    ],
    skills: ["Incident Reporting", "Access Control", "Emergency Response", "Customer Assistance"],
    valueArea: "Safety & Compliance"
  },
  "Customer Success": {
    responsibilities: [
      "Onboarding",
      "CRM updates",
      "Support tickets",
      "Escalation handling",
      "Retention support",
      "Client communication"
    ],
    skills: ["CRM Updates", "Onboarding", "Support Tickets", "Client Communication"],
    valueArea: "Client Experience"
  },
  "Project Coordination": {
    responsibilities: [
      "Timeline tracking",
      "Status reporting",
      "Documentation",
      "Meeting coordination",
      "Stakeholder communication",
      "Milestone tracking"
    ],
    skills: ["Timeline Tracking", "Status Reporting", "Documentation", "Stakeholder Communication"],
    valueArea: "Cross-Functional Support"
  },
  Operations: {
    responsibilities: [
      "Process improvement",
      "Reporting",
      "SOP management",
      "Task coordination",
      "Scheduling",
      "KPI tracking"
    ],
    skills: ["Process Improvement", "Reporting", "SOP Management", "KPI Tracking"],
    valueArea: "Operational Efficiency"
  },
  Business: {
    responsibilities: ["Analysis", "Reporting", "Documentation", "Stakeholder support", "Process improvement"],
    skills: ["Analysis", "Reporting", "Documentation", "Stakeholder Support"],
    valueArea: "Business Support"
  },
  Sales: {
    responsibilities: [
      "Prospecting",
      "CRM management",
      "Lead generation",
      "Follow-up communication",
      "Pipeline support"
    ],
    skills: ["Prospecting", "CRM Management", "Lead Generation", "Pipeline Support"],
    valueArea: "Revenue Support"
  },
  Admin: {
    responsibilities: ["Calendar management", "Scheduling", "Records management", "Office support", "Data entry"],
    skills: ["Calendar Management", "Scheduling", "Records Management", "Data Entry"],
    valueArea: "Administrative Reliability"
  },
  Tech: {
    responsibilities: [
      "Troubleshooting",
      "Ticket management",
      "Documentation",
      "User support",
      "System maintenance"
    ],
    skills: ["Troubleshooting", "Ticket Management", "Documentation", "User Support"],
    valueArea: "Technical Support"
  },
  "IT Support": {
    responsibilities: [
      "Troubleshooting",
      "Ticket management",
      "Documentation",
      "User support",
      "System maintenance"
    ],
    skills: ["Troubleshooting", "Ticket Management", "Documentation", "User Support"],
    valueArea: "Technical Support"
  }
};

export const responsibilitySuggestions: Record<RoleFamily, string[]> = Object.fromEntries(
  Object.entries(roleIntelligence).map(([roleFamily, intelligence]) => [
    roleFamily,
    intelligence.responsibilities
  ])
) as Record<RoleFamily, string[]>;

export const scopePromptSets: Record<RoleFamily, Array<{ key: keyof IntakeData; label: string; placeholder: string; hint: string }>> = {
  Security: [
    { key: "customersServed", label: "Visitors or customers assisted", placeholder: "Example: 80+ visitors per shift", hint: "Useful for access control, visitor management, and customer assistance." },
    { key: "reportsCreated", label: "Incident or shift reports", placeholder: "Example: 6 weekly reports", hint: "Documentation makes safety work easier to understand." },
    { key: "callsHandled", label: "Calls or radio requests", placeholder: "Example: 20 calls per shift", hint: "Estimate routine communication volume." },
    { key: "teamSizeSupported", label: "Team or site size supported", placeholder: "Example: 12-person site team", hint: "Shows operating environment." }
  ],
  "Customer Success": [
    { key: "customersServed", label: "Customers supported", placeholder: "Example: 50+ weekly customers", hint: "Customer volume gives service bullets weight." },
    { key: "ticketsHandled", label: "Tickets or support requests", placeholder: "Example: 80 monthly tickets", hint: "Use estimates if exact counts are not tracked." },
    { key: "callsHandled", label: "Calls, chats, or follow-ups", placeholder: "Example: 25 daily follow-ups", hint: "Captures client communication load." },
    { key: "reportsCreated", label: "CRM updates or reports", placeholder: "Example: 5 weekly account updates", hint: "Good for CRM and record accuracy." }
  ],
  "Project Coordination": [
    { key: "projectsSupported", label: "Projects supported", placeholder: "Example: 3 active projects", hint: "Shows coordination load." },
    { key: "reportsCreated", label: "Status reports created", placeholder: "Example: 4 weekly reports", hint: "Useful for stakeholder updates." },
    { key: "teamSizeSupported", label: "Team size supported", placeholder: "Example: 8-person project team", hint: "Shows cross-functional scope." },
    { key: "callsHandled", label: "Meetings or check-ins coordinated", placeholder: "Example: 6 weekly meetings", hint: "Estimate recurring coordination rhythms." }
  ],
  Operations: [
    { key: "projectsSupported", label: "Workflows or projects supported", placeholder: "Example: 4 active workflows", hint: "Use for task tracking, SOPs, or coordination." },
    { key: "reportsCreated", label: "Reports or trackers maintained", placeholder: "Example: 5 weekly reports", hint: "Reporting volume supports operations bullets." },
    { key: "teamSizeSupported", label: "Team size supported", placeholder: "Example: 10-person operations team", hint: "Shows support environment." },
    { key: "customersServed", label: "Internal or external requests", placeholder: "Example: 30 weekly requests", hint: "Estimate recurring request volume." }
  ],
  Business: [
    { key: "reportsCreated", label: "Reports or analyses created", placeholder: "Example: 5 monthly reports", hint: "Useful for business support and analysis roles." },
    { key: "projectsSupported", label: "Projects or initiatives supported", placeholder: "Example: 3 department projects", hint: "Shows cross-functional scope." },
    { key: "teamSizeSupported", label: "Stakeholders or team supported", placeholder: "Example: 6 stakeholders", hint: "Estimate the audience you supported." },
    { key: "revenueInfluenced", label: "Revenue, budget, or pipeline touched", placeholder: "Example: $25K budget tracked", hint: "Only include numbers you can defend." }
  ],
  Sales: [
    { key: "customersServed", label: "Prospects or accounts contacted", placeholder: "Example: 60 weekly prospects", hint: "Prospecting volume matters for sales roles." },
    { key: "callsHandled", label: "Calls or follow-ups handled", placeholder: "Example: 30 daily follow-ups", hint: "Shows outreach consistency." },
    { key: "revenueInfluenced", label: "Pipeline or revenue supported", placeholder: "Example: $50K pipeline supported", hint: "Use influenced or supported, not owned, if that is more accurate." },
    { key: "reportsCreated", label: "CRM updates or reports", placeholder: "Example: 40 weekly CRM updates", hint: "Captures pipeline hygiene." }
  ],
  Admin: [
    { key: "callsHandled", label: "Calls, emails, or requests handled", placeholder: "Example: 35 daily calls", hint: "Administrative volume is useful resume context." },
    { key: "reportsCreated", label: "Records or reports maintained", placeholder: "Example: 100 records weekly", hint: "Shows accuracy and recordkeeping scope." },
    { key: "teamSizeSupported", label: "Team or office supported", placeholder: "Example: 12-person office", hint: "Shows who relied on your work." },
    { key: "projectsSupported", label: "Schedules or projects coordinated", placeholder: "Example: 4 recurring calendars", hint: "Use for calendar and scheduling work." }
  ],
  Tech: [
    { key: "ticketsHandled", label: "Tickets or issues handled", placeholder: "Example: 70 monthly tickets", hint: "Ticket volume is strong ATS context." },
    { key: "customersServed", label: "Users supported", placeholder: "Example: 45 weekly users", hint: "Use for user support or troubleshooting." },
    { key: "reportsCreated", label: "Docs or test notes created", placeholder: "Example: 6 process docs", hint: "Documentation supports technical credibility." },
    { key: "projectsSupported", label: "Tools or projects supported", placeholder: "Example: 2 rollout projects", hint: "Shows technical workflow scope." }
  ],
  "IT Support": [
    { key: "ticketsHandled", label: "Tickets handled", placeholder: "Example: 75 monthly tickets", hint: "Ticket count is one of the clearest IT support scope signals." },
    { key: "customersServed", label: "Users supported", placeholder: "Example: 50+ weekly users", hint: "Captures user support volume." },
    { key: "callsHandled", label: "Calls or escalations handled", placeholder: "Example: 20 daily calls", hint: "Useful for help desk workflows." },
    { key: "reportsCreated", label: "Documentation or knowledge articles", placeholder: "Example: 4 knowledge articles", hint: "Shows repeatable support improvements." }
  ]
};

export const outcomeSuggestionsByFamily: Record<RoleFamily, string[]> = {
  Security: ["Compliance", "Reliability", "Speed", "Customer satisfaction"],
  "Customer Success": ["Customer satisfaction", "Retention", "Speed", "Reliability"],
  "Project Coordination": ["Efficiency", "Reliability", "Speed", "Accuracy"],
  Operations: ["Efficiency", "Accuracy", "Reliability", "Speed"],
  Business: ["Accuracy", "Efficiency", "Revenue", "Reliability"],
  Sales: ["Revenue", "Speed", "Retention", "Customer satisfaction"],
  Admin: ["Accuracy", "Efficiency", "Reliability", "Compliance"],
  Tech: ["Reliability", "Speed", "Accuracy", "Efficiency"],
  "IT Support": ["Speed", "Reliability", "Customer satisfaction", "Efficiency"]
};

export const outcomeOptions = [
  "Speed",
  "Accuracy",
  "Customer satisfaction",
  "Revenue",
  "Retention",
  "Efficiency",
  "Reliability",
  "Compliance"
];

export const initialIntake: IntakeData = {
  fullName: "",
  email: "",
  phone: "",
  website: "",
  targetJobTitle: "",
  roleFamily: "Customer Success",
  currentTitle: "",
  currentCompany: "",
  currentTime: "",
  previousTitle: "",
  previousCompany: "",
  previousTime: "",
  additionalTitle: "",
  additionalCompany: "",
  additionalTime: "",
  tools: "",
  responsibilities: "",
  selectedResponsibilities: [],
  customersServed: "",
  ticketsHandled: "",
  projectsSupported: "",
  teamSizeSupported: "",
  callsHandled: "",
  revenueInfluenced: "",
  reportsCreated: "",
  selectedOutcomes: [],
  outcomes: ""
};
