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
