import { roleIntelligence } from "@/lib/career-data";
import { formatEducationEntries } from "@/lib/education-intelligence";
import { findIndependentWorkRole, formatIndependentTitle, independentWorkArsenals, inferIndependentWorkCategory } from "@/lib/independent-work-intelligence";
import { aiToolOptions, buildAiAtsKeywords, normalizeAiWorkflow, selectedAiTools } from "@/lib/modern-work-intelligence";
import { educationPlaceholder } from "@/lib/resume-export";
import { polishResumePackage } from "@/lib/resume-intelligence";
import { normalizeTransferTarget } from "@/lib/transferable-targets";
import { buildCareerEvidence } from "@/lib/career-recommendations";
import type { ExperienceRole, IntakeData, ResumePackage, RoleFamily } from "@/types/career";

const defaultTargetByFamily: Record<RoleFamily, string> = {
  Tech: "Technical Support Associate",
  Business: "Business Operations Associate",
  Operations: "Operations Associate",
  "Customer Success": "Customer Success Associate",
  Admin: "Administrative Assistant",
  Sales: "Sales Development Representative",
  Security: "Security Officer",
  "Project Coordination": "Project Coordinator",
  "IT Support": "IT Support Specialist"
};

const workflowSkillsByFamily: Record<RoleFamily, string[]> = {
  Tech: ["Testing Support", "Technical Documentation", "Support Workflows", "Problem Solving"],
  Business: ["Business Reporting", "Stakeholder Support", "Process Documentation", "Analytical Support"],
  Operations: ["Task Coordination", "Process Improvement", "Operational Reporting", "Reliable Follow-Through"],
  "Customer Success": ["Client Communication", "Issue Escalation", "Service Follow-Through", "Account Support"],
  Admin: ["Office Support", "Records Accuracy", "Calendar Support", "Professional Communication"],
  Sales: ["Pipeline Support", "Follow-Up Communication", "Lead Research", "Prospect Coordination"],
  Security: ["Safety Awareness", "Incident Documentation", "Visitor Support", "Policy Compliance"],
  "Project Coordination": ["Cross-Functional Communication", "Meeting Coordination", "Project Documentation", "Status Tracking"],
  "IT Support": ["Ticket Triage", "User Support", "Troubleshooting", "Technical Documentation"]
};

type DomainProfile = {
  name: string;
  keywords: string[];
  environment: string;
  strengths: string[];
  processLanguage: string;
};

type OccupationProfile = {
  id: string;
  patterns: RegExp[];
  headline: string;
  environment: string;
  dailyTasks: string[];
  universalTools: string[];
  communication: string[];
  challenges: string[];
  achievements: string[];
  transferables: string[];
};

const occupationProfiles: OccupationProfile[] = [
  {
    id: "bartender",
    patterns: [/\bbartender\b/i, /\bbar back\b/i, /\bbarback\b/i],
    headline: "Bartender | Customer Service | Hospitality",
    environment: "fast-paced hospitality environment",
    dailyTasks: ["Customer Service", "Payment Processing", "Order Accuracy", "Cash Handling", "Service Recovery"],
    universalTools: ["POS Systems", "Cash Drawer"],
    communication: ["Customer Communication", "Conflict Resolution", "Team Coordination"],
    challenges: ["High-Volume Service", "Time Management", "Policy Follow-Through"],
    achievements: ["Balanced speed and accuracy during peak service", "Kept guest experience consistent under pressure"],
    transferables: ["Customer Service", "Cash Handling", "Conflict Resolution", "Time Management", "Team Coordination"]
  },
  {
    id: "retail",
    patterns: [/\bretail\b/i, /\bcashier\b/i, /\bsales associate\b/i, /\bstore associate\b/i],
    headline: "Retail Associate | Customer Service | Store Operations",
    environment: "retail service environment",
    dailyTasks: ["Customer Service", "Checkout Support", "Returns Processing", "Inventory Support", "Store Presentation"],
    universalTools: ["POS Systems", "Cash Register", "Handheld Scanner"],
    communication: ["Customer Questions", "Issue Escalation", "Team Handoffs"],
    challenges: ["High-Volume Service", "Transaction Accuracy", "Merchandising Standards"],
    achievements: ["Maintained customer service and register accuracy during busy shifts"],
    transferables: ["Customer Service", "Cash Handling", "Inventory", "Attention to Detail", "Team Coordination"]
  },
  {
    id: "warehouse",
    patterns: [/\bwarehouse\b/i, /\bfulfillment\b/i, /\bstocker\b/i, /\border picker\b/i, /\bpacker\b/i],
    headline: "Warehouse Operations | Inventory | Fulfillment",
    environment: "warehouse and fulfillment environment",
    dailyTasks: ["Order Picking", "Order Packing", "Inventory Movement", "Package Scanning", "Safe Work Areas"],
    universalTools: ["Barcode Scanner", "Pallet Jack", "RF Scanner"],
    communication: ["Shift Handoffs", "Team Coordination"],
    challenges: ["Order Accuracy", "Safety Procedures", "Pace Of Work"],
    achievements: ["Kept fulfillment work moving while protecting accuracy and safety"],
    transferables: ["Inventory", "Equipment Operation", "Attention to Detail", "Safety Procedures", "Time Management"]
  },
  {
    id: "security",
    patterns: [/\bsecurity\b/i, /\bguard\b/i, /\baccess control\b/i, /\bpatrol\b/i],
    headline: "Security Professional | Safety | Incident Reporting",
    environment: "safety-focused public-facing environment",
    dailyTasks: ["Access Control", "Incident Reporting", "Visitor Support", "Safety Monitoring", "Policy Follow-Through"],
    universalTools: ["Radio Communication", "Incident Reports", "Access Control"],
    communication: ["De-Escalation", "Visitor Communication", "Shift Handoffs"],
    challenges: ["Conflict Resolution", "Safety Procedures", "Judgment Under Pressure"],
    achievements: ["Maintained calm communication while following site procedures"],
    transferables: ["Conflict Resolution", "Documentation", "Safety Procedures", "Reliability", "Attention to Detail"]
  },
  {
    id: "delivery",
    patterns: [/\bdoordash\b/i, /\bdoor dash\b/i, /\bdasher\b/i, /\bdelivery driver\b/i, /\bdeliver(?:ed|ies|ing)\s+(orders?|food|packages?)\b/i, /\bcourier\b/i, /\bdriver\b/i],
    headline: "Delivery Operations | Route Planning | Customer Service",
    environment: "app-based delivery and customer handoff environment",
    dailyTasks: ["Route Planning", "Order Verification", "Customer Communication", "Delivery Coordination", "Time-Sensitive Tasks"],
    universalTools: ["Delivery App", "Navigation App", "Vehicle"],
    communication: ["Customer Updates", "Restaurant Handoffs", "Issue Resolution"],
    challenges: ["Time Management", "Order Accuracy", "Independent Work"],
    achievements: ["Completed time-sensitive deliveries while managing customer updates and order accuracy"],
    transferables: ["Route Planning", "Time Management", "Customer Service", "Independent Work", "Problem Solving"]
  },
  {
    id: "janitor",
    patterns: [/\bjanitor\b/i, /\bcustodian\b/i, /\bcleaner\b/i, /\bmaintenance helper\b/i, /\bfacilities\b/i],
    headline: "Facilities Support | Cleaning Standards | Maintenance",
    environment: "facilities cleaning and maintenance environment",
    dailyTasks: ["Sanitation", "Work Area Upkeep", "Supply Restocking", "Issue Reporting", "Safety Procedures"],
    universalTools: ["Cleaning Supplies", "Mop", "Basic Hand Tools"],
    communication: ["Issue Reporting", "Team Handoffs"],
    challenges: ["Cleaning Standards", "Reliability", "Safety Awareness"],
    achievements: ["Maintained clean, stocked, and safe spaces for daily operations"],
    transferables: ["Cleaning Standards", "Reliability", "Attention to Detail", "Safety Procedures", "Equipment Operation"]
  },
  {
    id: "food-service",
    patterns: [/\bfood service\b/i, /\bcrew member\b/i, /\bserver\b/i, /\bbarista\b/i, /\bcook\b/i, /\bkitchen\b/i],
    headline: "Food Service | Customer Service | Operations",
    environment: "fast-paced food service environment",
    dailyTasks: ["Order Preparation", "Customer Service", "Sanitation", "Restocking", "Shift Procedures"],
    universalTools: ["POS Systems", "Kitchen Equipment", "Sanitation Supplies"],
    communication: ["Guest Communication", "Team Coordination", "Issue Escalation"],
    challenges: ["Order Accuracy", "Speed And Accuracy", "Clean Work Areas"],
    achievements: ["Balanced order accuracy, sanitation, and customer service during busy shifts"],
    transferables: ["Customer Service", "Order Accuracy", "Team Coordination", "Sanitation", "Adaptability"]
  },
  {
    id: "caregiver",
    patterns: [/\bcaregiver\b/i, /\bhome health\b/i, /\bhome health aide\b/i, /\bcna\b/i, /\bnursing assistant\b/i, /\bpatient care\b/i, /\bresident care\b/i],
    headline: "Care Support | Patient Service | Documentation",
    environment: "client care and home support environment",
    dailyTasks: ["Client Care", "Daily Routine Support", "Safety Checks", "Care Notes", "Appointment Support"],
    universalTools: ["Care Notes", "Scheduling App"],
    communication: ["Family Updates", "Patient Communication", "Team Handoffs"],
    challenges: ["Reliability", "Safety Awareness", "Patience"],
    achievements: ["Supported safe daily routines while keeping care notes and family updates clear"],
    transferables: ["Patient Support", "Documentation", "Relationship Building", "Reliability", "Attention to Detail"]
  },
  {
    id: "receptionist",
    patterns: [/\breceptionist\b/i, /\bfront desk\b/i, /\badministrative assistant\b/i, /\boffice assistant\b/i],
    headline: "Administrative Support | Reception | Scheduling",
    environment: "front desk and administrative support environment",
    dailyTasks: ["Call Routing", "Visitor Support", "Scheduling", "Records Management", "Office Support"],
    universalTools: ["Phone System", "Calendar"],
    communication: ["Professional Communication", "Customer Questions", "Team Handoffs"],
    challenges: ["Attention to Detail", "Prioritization", "Confidentiality"],
    achievements: ["Kept front desk communication, schedules, and records organized"],
    transferables: ["Scheduling", "Calendar Management", "Customer Service", "Records Management", "Communication", "Organization"]
  },
  {
    id: "construction",
    patterns: [/\bconstruction\b/i, /\bgeneral labor\b/i, /\blaborer\b/i, /\bjob site\b/i],
    headline: "General Labor | Safety | Job Site Support",
    environment: "hands-on construction and job site environment",
    dailyTasks: ["Material Handling", "Site Preparation", "Equipment Operation", "Cleanup", "Safety Procedures"],
    universalTools: ["Hand Tools", "Power Tools", "PPE"],
    communication: ["Crew Coordination", "Issue Reporting", "Foreman Updates"],
    challenges: ["Physical Work", "Safety Awareness", "Pace Of Work"],
    achievements: ["Supported job site progress by keeping materials, tools, and work areas ready"],
    transferables: ["Equipment Operation", "Safety Procedures", "Team Coordination", "Reliability", "Problem Solving"]
  }
];

const domainProfiles: DomainProfile[] = [
  {
    name: "sportsbook",
    keywords: ["sportsbook", "gaming", "casino", "wager", "ticket writer", "draftkings", "fanduel"],
    environment: "high-volume gaming and customer transaction environment",
    strengths: ["customer transactions", "compliance-aware service", "operational accuracy", "issue escalation"],
    processLanguage: "transaction records, customer requests, and compliance-aware service steps"
  },
  {
    name: "security",
    keywords: ["security", "guard", "access control", "surveillance", "site officer"],
    environment: "safety-focused, public-facing environment",
    strengths: ["access control", "incident reporting", "visitor management", "safety procedures"],
    processLanguage: "access control procedures, incident notes, and visitor support workflows"
  },
  {
    name: "retail",
    keywords: ["retail", "cashier", "sales associate", "store", "target", "best buy", "walgreens", "cvs", "walmart", "costco"],
    environment: "fast-paced retail service environment",
    strengths: ["POS systems", "customer service", "inventory support", "transaction accuracy"],
    processLanguage: "POS transactions, customer requests, inventory tasks, and store records"
  },
  {
    name: "warehouse",
    keywords: ["warehouse", "fulfillment", "picker", "packer", "stocker", "forklift", "pallet", "logistics"],
    environment: "warehouse and fulfillment environment",
    strengths: ["inventory movement", "order accuracy", "safe work areas", "shift procedures"],
    processLanguage: "picking, packing, scanning, inventory movement, handoffs, and safety procedures"
  },
  {
    name: "customer-support",
    keywords: ["customer service", "customer support", "support representative", "service representative", "wireless", "billing"],
    environment: "customer-facing support environment",
    strengths: ["customer communication", "case documentation", "issue escalation", "service follow-through"],
    processLanguage: "customer questions, account notes, case follow-up, and escalation workflows"
  },
  {
    name: "food service",
    keywords: ["server", "barista", "restaurant", "food", "food service", "crew member", "cook", "kitchen", "cafe", "starbucks", "shift"],
    environment: "fast-paced food service environment",
    strengths: ["order accuracy", "customer experience", "shift operations", "service speed"],
    processLanguage: "order flow, customer service steps, sanitation standards, and shift tasks"
  },
  {
    name: "construction",
    keywords: ["construction", "general labor", "laborer", "job site", "hand tools", "power tools", "drywall", "concrete"],
    environment: "hands-on construction and labor environment",
    strengths: ["site preparation", "equipment handling", "safe work areas", "team coordination"],
    processLanguage: "site preparation, material handling, equipment use, cleanup, and safety procedures"
  },
  {
    name: "cleaning-maintenance",
    keywords: ["janitor", "custodian", "maintenance", "cleaner", "cleaning", "sanitation", "repair"],
    environment: "facility cleaning and maintenance environment",
    strengths: ["sanitation", "work area upkeep", "issue reporting", "reliable shift coverage"],
    processLanguage: "cleaning routes, sanitation tasks, maintenance checks, supply tracking, and issue reporting"
  },
  {
    name: "caregiving",
    keywords: ["caregiver", "home health", "home health aide", "care aide", "resident", "patient care", "personal care"],
    environment: "client care and home support environment",
    strengths: ["patient care", "client communication", "documentation", "safety awareness"],
    processLanguage: "personal care routines, family communication, safety checks, notes, and daily support tasks"
  },
  {
    name: "beauty-service",
    keywords: ["barber", "stylist", "hair", "beauty", "nail technician", "esthetician", "salon"],
    environment: "client-facing beauty and appointment service environment",
    strengths: ["client consultation", "appointment management", "service delivery", "sanitation"],
    processLanguage: "client consultations, appointment flow, service preparation, sanitation, payments, and follow-up"
  },
  {
    name: "coach-trainer",
    keywords: ["coach", "trainer", "personal trainer", "fitness", "youth coach", "athlete"],
    environment: "coaching and training environment",
    strengths: ["instruction", "motivation", "session planning", "safety awareness"],
    processLanguage: "session planning, instruction, progress tracking, safety reminders, and participant communication"
  },
  {
    name: "admin",
    keywords: ["admin", "administrative", "office", "front desk", "reception", "records"],
    environment: "office and administrative support environment",
    strengths: ["scheduling", "records management", "correspondence", "office workflows"],
    processLanguage: "calendar coordination, records, correspondence, and office workflows"
  },
  {
    name: "it",
    keywords: ["it", "help desk", "desktop support", "service desk", "technical support", "technician"],
    environment: "technical support and user service environment",
    strengths: ["troubleshooting", "ticketing", "user support", "documentation"],
    processLanguage: "support tickets, troubleshooting notes, user requests, and escalation workflows"
  },
  {
    name: "independent-gig",
    keywords: ["uber", "lyft", "doordash", "courier", "delivery driver", "instacart", "rideshare", "amazon flex"],
    environment: "app-based service and delivery environment",
    strengths: ["route planning", "customer communication", "time management", "order accuracy"],
    processLanguage: "app-based requests, route planning, customer handoffs, and issue resolution"
  },
  {
    name: "independent-creator",
    keywords: ["creator", "tiktok", "youtube", "twitch", "podcast", "video editor", "photographer", "dj", "graphic designer"],
    environment: "digital content and audience engagement environment",
    strengths: ["content production", "audience engagement", "publishing workflows", "creative planning"],
    processLanguage: "content planning, editing workflows, publishing schedules, and audience engagement"
  },
  {
    name: "independent-service",
    keywords: ["barber", "hair stylist", "nail technician", "tattoo artist", "trainer", "dog walker", "cleaner", "landscaper", "tutor", "childcare"],
    environment: "client-facing independent service environment",
    strengths: ["client relations", "service delivery", "appointment management", "payment processing"],
    processLanguage: "client consultations, scheduling, service delivery, payments, and follow-up communication"
  },
  {
    name: "independent-commerce",
    keywords: ["etsy", "ebay", "shopify", "depop", "poshmark", "reseller", "seller", "online store", "e-commerce"],
    environment: "independent e-commerce operation",
    strengths: ["product listings", "order fulfillment", "customer messages", "inventory tracking"],
    processLanguage: "product listings, customer messages, order fulfillment, inventory updates, and shipping workflows"
  },
  {
    name: "independent-community",
    keywords: ["volunteer", "community organizer", "church volunteer", "youth coach", "mentor", "event organizer", "club leader"],
    environment: "community and volunteer leadership environment",
    strengths: ["event coordination", "community engagement", "outreach", "team coordination"],
    processLanguage: "event coordination, outreach, scheduling, stakeholder communication, and volunteer support"
  }
];

const productBuilderProfile: DomainProfile = {
  name: "product-builder",
  keywords: ["product lab", "mvp", "websites", "apps", "automation", "launched demos", "shipped demos"],
  environment: "hands-on product and web project environment",
  strengths: ["Product Documentation", "Mobile QA", "Website Delivery", "Workflow Automation"],
  processLanguage: "feature planning, copywriting, mobile testing, issue documentation, and launch follow-through"
};

type RoleStrategy = {
  focus: string[];
  safeDefaults: string[];
  verbs: string[];
  environment: string;
  supportContext: string;
  seniorContext: string;
  valueArea: string;
};

const roleStrategies: Record<RoleFamily, RoleStrategy> = {
  "Customer Success": {
    focus: ["customer communication", "account support", "issue resolution", "CRM documentation", "onboarding support"],
    safeDefaults: ["Customer Communication", "Issue Resolution", "Service Follow-Through", "Documentation"],
    verbs: ["Supported", "Documented", "Resolved", "Communicated", "Maintained"],
    environment: "customer-facing service environment",
    supportContext: "service requests and client follow-through",
    seniorContext: "customer success workflows and team communication",
    valueArea: "Client Experience"
  },
  Operations: {
    focus: ["workflow coordination", "reporting", "scheduling", "process improvement", "operational accuracy"],
    safeDefaults: ["Workflow Coordination", "Operational Reporting", "Task Tracking", "Process Support"],
    verbs: ["Coordinated", "Tracked", "Maintained", "Improved", "Documented"],
    environment: "operations and service workflow environment",
    supportContext: "daily operations and task flow",
    seniorContext: "operational workflows and service standards",
    valueArea: "Operational Efficiency"
  },
  Admin: {
    focus: ["scheduling", "records", "correspondence", "office support", "documentation"],
    safeDefaults: ["Scheduling", "Records Management", "Office Support", "Professional Communication"],
    verbs: ["Coordinated", "Maintained", "Organized", "Documented", "Communicated"],
    environment: "office and administrative support environment",
    supportContext: "administrative requests and office workflows",
    seniorContext: "administrative workflows and cross-team support",
    valueArea: "Administrative Reliability"
  },
  Sales: {
    focus: ["outreach", "lead generation", "CRM updates", "pipeline support", "follow-up communication"],
    safeDefaults: ["Follow-Up Communication", "Lead Support", "CRM Updates", "Pipeline Coordination"],
    verbs: ["Supported", "Tracked", "Maintained", "Communicated", "Researched"],
    environment: "sales support and customer outreach environment",
    supportContext: "sales outreach and account follow-up",
    seniorContext: "pipeline support and customer handoff workflows",
    valueArea: "Revenue Support"
  },
  "IT Support": {
    focus: ["troubleshooting", "ticket resolution", "documentation", "escalation", "user support"],
    safeDefaults: ["Troubleshooting", "Ticket Management", "User Support", "Technical Documentation"],
    verbs: ["Troubleshot", "Resolved", "Documented", "Escalated", "Supported"],
    environment: "technical support and user service environment",
    supportContext: "user requests and support tickets",
    seniorContext: "help desk workflows and technical escalation paths",
    valueArea: "Technical Support"
  },
  "Project Coordination": {
    focus: ["timelines", "milestones", "stakeholder updates", "meeting support", "documentation"],
    safeDefaults: ["Timeline Tracking", "Status Reporting", "Meeting Coordination", "Project Documentation"],
    verbs: ["Coordinated", "Tracked", "Documented", "Communicated", "Maintained"],
    environment: "project coordination and cross-functional support environment",
    supportContext: "project updates and delivery tasks",
    seniorContext: "project timelines, milestones, and stakeholder communication",
    valueArea: "Cross-Functional Support"
  },
  Business: {
    focus: ["reporting", "analysis", "process documentation", "stakeholder communication", "operational insight"],
    safeDefaults: ["Reporting", "Analysis", "Process Documentation", "Stakeholder Support"],
    verbs: ["Analyzed", "Documented", "Reported", "Communicated", "Tracked"],
    environment: "business operations and stakeholder support environment",
    supportContext: "business reporting and stakeholder requests",
    seniorContext: "business workflows and operational insights",
    valueArea: "Business Support"
  },
  Tech: {
    focus: ["testing", "documentation", "tooling", "implementation support", "technical workflows"],
    safeDefaults: ["Testing Support", "Technical Documentation", "Implementation Support", "Support Workflows"],
    verbs: ["Tested", "Documented", "Supported", "Tracked", "Troubleshot"],
    environment: "technical workflow and implementation support environment",
    supportContext: "technical tasks and support workflows",
    seniorContext: "technical workflows and implementation support",
    valueArea: "Technical Operations"
  },
  Security: {
    focus: ["access control", "incident reporting", "visitor management", "safety procedures", "emergency response"],
    safeDefaults: ["Access Control", "Incident Reporting", "Visitor Management", "Safety Procedures"],
    verbs: ["Monitored", "Documented", "Supported", "Escalated", "Maintained"],
    environment: "safety-focused, public-facing environment",
    supportContext: "site safety and visitor support",
    seniorContext: "security workflows and safety procedures",
    valueArea: "Safety & Compliance"
  }
};

const weakTargetValues = new Set(["ee", "test", "testing", "asdf", "qwerty", "none", "na", "n/a", "unknown"]);
const weakFreeTextValues = new Set(["ee", "test", "testing", "asdf", "qwerty", "none", "na", "n/a", "unknown", "null"]);
const awkwardPhrases = [/customers customers/gi, /tickets tickets/gi, /managed onboarding using python/gi, /candidate targeting/gi];
const leadershipTerms = /\b(supervisor|lead|manager|senior|coordinator|specialist)\b/i;
const supportTerms = /\b(associate|assistant|representative|clerk|cashier|writer|technician|intern)\b/i;

const acronyms = new Map([
  ["ai", "AI"],
  ["api", "API"],
  ["crm", "CRM"],
  ["css", "CSS"],
  ["github", "GitHub"],
  ["html", "HTML"],
  ["hubspot", "HubSpot"],
  ["it", "IT"],
  ["kpi", "KPI"],
  ["macos", "macOS"],
  ["pos", "POS"],
  ["qa", "QA"],
  ["servicenow", "ServiceNow"],
  ["sop", "SOP"],
  ["sql", "SQL"],
  ["ui", "UI"],
  ["ux", "UX"]
]);

const aiWorkflowSkillLabels = new Map([
  ["Research", "AI-Assisted Research"],
  ["Documentation", "AI-Assisted Documentation"],
  ["Brainstorming", "AI-Assisted Ideation"],
  ["Customer communication", "AI-Supported Customer Communication"],
  ["Coding assistance", "AI-Assisted Development"],
  ["Debugging", "AI-Assisted Debugging"],
  ["Resume writing", "AI-Assisted Writing"],
  ["Meeting summaries", "AI Meeting Summaries"],
  ["Knowledge management", "AI-Supported Knowledge Management"],
  ["Workflow automation", "Workflow Automation"],
  ["Prompt engineering", "Prompt Engineering"],
  ["Technical writing", "AI-Assisted Technical Writing"],
  ["Data analysis", "AI-Assisted Data Analysis"],
  ["Content creation", "AI-Assisted Content Creation"],
  ["Project planning", "AI-Assisted Project Planning"],
  ["Rapid prototyping", "Rapid Prototyping"],
  ["App development", "AI-Assisted App Development"],
  ["Quality assurance", "AI-Assisted Quality Assurance"],
  ["Translation", "AI-Assisted Translation"]
]);

const responsibilityAliases = new Map([
  ["helped customers", "Customer Requests"],
  ["help customers", "Customer Requests"],
  ["customer help", "Customer Requests"],
  ["answered calls", "Call Handling"],
  ["took calls", "Call Handling"],
  ["made reports", "Reporting"],
  ["did reports", "Reporting"],
  ["wrote copy", "Copywriting"],
  ["features", "Feature Planning"],
  ["shipped demos", "Demo Delivery"],
  ["fixed broken states", "Issue Resolution"],
  ["tested mobile layouts", "Mobile QA"],
  ["answered basic questions", "Customer Questions"],
  ["cleaned the front area", "Work Area Upkeep"],
  ["helped coworkers when it got busy", "Team Support"],
  ["stocked shelves", "Inventory Support"],
  ["built websites and apps", "Website And App Projects"],
  ["local business landing pages", "Landing Page Projects"],
  ["automation workflows", "Workflow Automation"],
  ["loaded trucks", "Load Handling"],
  ["unloaded trucks", "Load Handling"],
  ["picked orders", "Order Picking"],
  ["packed orders", "Order Packing"],
  ["scanned packages", "Package Scanning"],
  ["kept my area clean", "Work Area Upkeep"],
  ["kept work areas safe", "Safe Work Areas"],
  ["followed safety rules", "Safety Procedures"],
  ["followed shift procedures", "Shift Procedures"],
  ["prepared orders", "Order Preparation"],
  ["made food", "Food Preparation"],
  ["cleaned tables", "Sanitation"],
  ["mopped floors", "Work Area Upkeep"],
  ["handled deliveries", "Delivery Coordination"],
  ["planned routes", "Route Planning"],
  ["used delivery apps", "App-Based Workflow"],
  ["helped residents", "Patient Care"],
  ["helped patients", "Patient Care"],
  ["took notes", "Documentation"],
  ["cut hair", "Service Delivery"],
  ["booked appointments", "Appointment Management"],
  ["trained clients", "Instruction"],
  ["coached kids", "Instruction"]
]);

type BulletContext = {
  action: string;
  bridgeAction: string;
  company: string;
  context: string;
  domainAction: string;
  environment: string;
  outcomeClause: string;
  processLanguage: string;
  responsibility: string;
  scope: string;
  scopeTwo: string;
  toolPhrase: string;
  targetFocus: string;
};

const bulletPatternLibrary: Record<RoleFamily, string[]> = {
  "Customer Success": [
    "{action} {scope}customer requests in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping service details and next steps clear.",
    "{bridgeAction} account support by following up with customers, documenting updates, and escalating complex needs.",
    "{action} onboarding and service follow-through with clear communication across customer touchpoints.",
    "{action} customer issues with organized notes, timely handoffs, and reliable follow-through.",
    "{bridgeAction} client communication by translating routine requests into documented next steps.",
    "{action} CRM and support records to keep customer history accurate and searchable.",
    "{bridgeAction} retention-focused service by maintaining consistent updates and positive customer experiences."
  ],
  Operations: [
    "{action} {scope}daily workflows in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping records, handoffs, and next steps clear.",
    "{bridgeAction} operational consistency by tracking work, documenting updates, and supporting issue resolution.",
    "{action} schedules, reports, and task flow to keep work moving across teams.",
    "{action} process details and routine updates to support accuracy and reliability.",
    "{bridgeAction} team communication by clarifying priorities, deadlines, and follow-up needs.",
    "{action} records and workflow notes to make recurring work easier to review.",
    "{bridgeAction} service standards by supporting process flow, compliance awareness, and consistent execution."
  ],
  Admin: [
    "{action} {scope}administrative requests in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping records and correspondence organized.",
    "{bridgeAction} office workflows by coordinating schedules, maintaining records, and communicating next steps.",
    "{action} calendars, documents, and routine requests with accuracy and professional follow-through.",
    "{action} records and data updates to keep information complete, current, and easy to find.",
    "{bridgeAction} team support by handling correspondence, tracking details, and organizing office needs.",
    "{action} recurring administrative tasks while protecting accuracy and response consistency.",
    "{bridgeAction} reliable office operations through documentation, scheduling support, and organized handoffs."
  ],
  Sales: [
    "{action} {scope}prospect or customer follow-ups in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping account notes and handoffs current.",
    "{bridgeAction} pipeline support by tracking outreach, documenting updates, and following up on next steps.",
    "{action} lead research and outreach tasks with consistent communication and recordkeeping.",
    "{action} customer conversations and CRM notes to support cleaner sales follow-through.",
    "{bridgeAction} revenue support by maintaining accurate pipeline activity and account context.",
    "{action} follow-up communication to help prospects and customers receive timely next steps.",
    "{bridgeAction} account coordination through organized notes, outreach support, and clear handoffs."
  ],
  Business: [
    "{action} {scope}business requests in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping reporting context and updates clear.",
    "{bridgeAction} operational insight by organizing information, documenting processes, and communicating findings.",
    "{action} reports and process notes to support better stakeholder visibility.",
    "{action} data and workflow details to help teams understand status, gaps, and next steps.",
    "{bridgeAction} stakeholder support through clear documentation, reporting, and follow-up.",
    "{action} recurring business updates with attention to accuracy and usable context.",
    "{bridgeAction} decision support by preparing organized notes, reports, and process documentation."
  ],
  "Project Coordination": [
    "{action} {scope}project activity in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping milestones and handoffs visible.",
    "{bridgeAction} project delivery by tracking timelines, preparing updates, and coordinating follow-up.",
    "{action} meeting notes, status updates, and documentation to keep stakeholders aligned.",
    "{action} timelines and task owners so project details stayed organized and actionable.",
    "{bridgeAction} cross-functional communication by clarifying next steps, risks, and status changes.",
    "{action} project records and recurring updates to support reliable execution.",
    "{bridgeAction} milestone tracking through organized documentation, follow-up, and schedule awareness."
  ],
  "IT Support": [
    "{action} {scope}user support requests in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping tickets and troubleshooting notes clear.",
    "{bridgeAction} technical support by documenting fixes, escalating complex cases, and communicating next steps.",
    "{action} user issues with structured troubleshooting and clear service communication.",
    "{action} support tickets and knowledge notes to improve repeatable resolution steps.",
    "{bridgeAction} help desk reliability through accurate documentation, triage, and escalation awareness.",
    "{action} routine technical requests while protecting service quality and response consistency.",
    "{bridgeAction} user support workflows by tracking issues, updating records, and following through on fixes."
  ],
  Tech: [
    "{action} {scope}technical tasks in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping technical notes and handoffs clear.",
    "{bridgeAction} implementation support by documenting issues, testing workflows, and tracking follow-up.",
    "{action} testing and documentation tasks to make technical work easier to review.",
    "{action} tool and workflow updates with attention to accuracy and repeatable steps.",
    "{bridgeAction} technical operations by organizing notes, validating details, and communicating status.",
    "{action} data or product operations tasks while maintaining clear documentation.",
    "{bridgeAction} technical workflow support through testing, documentation, and issue tracking."
  ],
  Security: [
    "{action} {scope}site activity in a {environment}{outcomeClause}.",
    "{action} {responsibility} through {processLanguage}{toolPhrase}, keeping incident notes and handoffs clear.",
    "{bridgeAction} safety procedures by monitoring access, documenting incidents, and escalating concerns.",
    "{action} visitor and access-control needs while maintaining calm, policy-aware service.",
    "{action} incident details and shift notes to support reliable safety communication.",
    "{bridgeAction} compliance-aware operations through documentation, escalation, and procedure follow-through.",
    "{action} emergency or routine requests with attention to safety and response consistency.",
    "{bridgeAction} site reliability by supporting access control, visitor management, and incident reporting."
  ]
};

const splitList = (value: string) =>
  value
    .split(/,|\n/)
    .map((item) => cleanWhitespace(item))
    .filter((item) => !isWeakFreeText(item))
    .filter(Boolean);

const cleanWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const compact = (items: string[]) => {
  const seen = new Set<string>();

  return items
    .map((item) => cleanWhitespace(item))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const sentenceList = (items: string[], joiner = "and") => {
  const cleanItems = compact(items);
  if (cleanItems.length <= 1) return cleanItems[0] ?? "";
  if (cleanItems.length === 2) return `${cleanItems[0]} ${joiner} ${cleanItems[1]}`;
  if (joiner === "&") return `${cleanItems.slice(0, -1).join(", ")} & ${cleanItems.at(-1)}`;
  return `${cleanItems.slice(0, -1).join(", ")}, ${joiner} ${cleanItems.at(-1)}`;
};

function titleCase(value: string) {
  return cleanWhitespace(value)
    .toLowerCase()
    .split(" ")
    .map((word) => acronyms.get(word) ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeTool(value: string) {
  const cleaned = cleanWhitespace(value);
  const lower = cleaned.toLowerCase();
  const knownAiTool = aiToolOptions.find((tool) => tool.toLowerCase() === lower);
  if (knownAiTool) return knownAiTool;
  return acronyms.get(lower) ?? titleCase(cleaned);
}

function normalizeCompany(value: string) {
  const cleaned = cleanWhitespace(value);
  if (!cleaned || isWeakFreeText(cleaned)) return "";
  const hasIntentionalCaps = /[a-z][A-Z]/.test(cleaned);
  return hasIntentionalCaps ? cleaned : titleCase(cleaned);
}

function isWeakTarget(value: string) {
  const cleaned = cleanWhitespace(value).toLowerCase();
  if (!cleaned || cleaned.length <= 2) return true;
  if (weakTargetValues.has(cleaned)) return true;
  if (!/[aeiou]/.test(cleaned) && cleaned.length < 6) return true;
  if (/^(.)\1+$/.test(cleaned)) return true;
  return false;
}

function isWeakFreeText(value: string) {
  const cleaned = cleanWhitespace(value).toLowerCase();
  if (!cleaned) return true;
  if (weakFreeTextValues.has(cleaned)) return true;
  if (cleaned.length === 1) return true;
  if (/^[^\w]+$/.test(cleaned)) return true;
  if (/^(.)\1{2,}$/.test(cleaned)) return true;
  return false;
}

function normalizeTargetRole(data: IntakeData) {
  if (isWeakTarget(data.targetJobTitle)) return defaultTargetByFamily[data.roleFamily];
  return normalizeTransferTarget(data.targetJobTitle) || titleCase(data.targetJobTitle);
}

function normalizeResponsibility(value: string) {
  if (isWeakFreeText(value)) return "";
  const alias = responsibilityAliases.get(cleanWhitespace(value).toLowerCase());
  if (alias) return alias;
  const titled = titleCase(value);
  return titled.replace(/\bCrm\b/g, "CRM").replace(/\bSop\b/g, "SOP").replace(/\bKpi\b/g, "KPI");
}

function readablePhrase(value: string) {
  return value
    .split(" ")
    .map((word) => acronyms.get(word.toLowerCase()) ?? word.toLowerCase())
    .join(" ");
}

const scopeFields: Array<[keyof IntakeData, string, string, string[]]> = [
  ["customersServed", "customers", "customers served", ["customer", "client", "haircut", "cut", "guest", "user", "visitor", "account", "prospect"]],
  ["ticketsHandled", "tickets", "tickets handled", ["ticket", "request", "case", "issue"]],
  ["projectsSupported", "projects", "projects supported", ["project", "initiative", "workflow", "rollout", "schedule", "calendar", "package", "order", "feature"]],
  ["teamSizeSupported", "team members", "team members supported", ["team", "person", "people", "staff", "stakeholder"]],
  ["callsHandled", "calls", "calls handled", ["call", "chat", "email", "follow-up", "meeting", "escalation"]],
  ["revenueInfluenced", "revenue", "revenue influenced", ["revenue", "budget", "pipeline", "money", "cash", "sales"]],
  ["reportsCreated", "reports", "reports created", ["report", "record", "document", "doc", "tracker", "article", "update"]]
];

function formatScopePhrase(value: string, shortLabel: string, aliases: string[]) {
  const cleaned = cleanWhitespace(value);
  const lower = cleaned.toLowerCase();
  const alreadyLabeled = aliases.some((term) => lower.includes(term.toLowerCase()));

  return alreadyLabeled ? cleaned : `${cleaned} ${shortLabel}`;
}

function buildScopeItems(data: IntakeData) {
  return scopeFields
    .map(([key, shortLabel, longLabel, aliases]) => {
      const value = cleanWhitespace(String(data[key]));
      if (!value) return null;
      const basePhrase = formatScopePhrase(value, shortLabel, aliases);
      const phrase =
        key === "customersServed" && ["IT Support", "Tech"].includes(data.roleFamily)
          ? basePhrase.replace(/\bcustomers\b/gi, "users")
          : basePhrase;
      return { key, value, shortLabel, longLabel, phrase };
    })
    .filter(Boolean) as Array<{ key: keyof IntakeData; value: string; shortLabel: string; longLabel: string; phrase: string }>;
}

function buildUserResponsibilityList(data: IntakeData) {
  return compact([
    ...data.selectedIndependentWorkSignals.map(normalizeResponsibility),
    ...data.customRoleTransferableSkills.map(normalizeResponsibility),
    ...data.customRoleWorkStyles.map(normalizeResponsibility),
    ...data.selectedResponsibilities.map(normalizeResponsibility),
    normalizeResponsibility(data.customRoleIndustry),
    ...splitList(data.responsibilities).map(normalizeResponsibility)
  ]).slice(0, 8);
}

function buildResponsibilityList(data: IntakeData) {
  const userResponsibilities = buildUserResponsibilityList(data);
  const occupation = detectOccupationProfile(data);
  if (occupation) {
    return compact([
      ...userResponsibilities,
      ...occupation.dailyTasks,
      ...occupation.communication,
      ...occupation.challenges
    ]).slice(0, 10);
  }
  if (userResponsibilities.length) return userResponsibilities;
  return roleStrategies[data.roleFamily].safeDefaults;
}

function buildToolList(data: IntakeData) {
  return compact(splitList(data.tools).filter((tool) => !isWeakFreeText(tool)).map(normalizeTool)).slice(0, 6);
}

function buildAiWorkflowList(data: IntakeData) {
  if (!selectedAiTools(data.tools).length) return [];
  return compact(data.selectedAiWorkflows.map(normalizeAiWorkflow).filter((workflow) => !isWeakFreeText(workflow))).slice(0, 6);
}

function buildAiWorkflowSkillList(data: IntakeData) {
  const workflows = buildAiWorkflowList(data);
  return compact([
    ...workflows.map((workflow) => aiWorkflowSkillLabels.get(workflow) ?? `${readablePhrase(workflow)} Support`),
    ...buildAiAtsKeywords(workflows)
  ]).slice(0, 6);
}

function aiWorkflowPhrase(data: IntakeData) {
  const workflows = buildAiWorkflowList(data);
  if (!workflows.length) return "";
  const readable = workflows.map((workflow) => workflow.toLowerCase());
  return sentenceList(readable.slice(0, 3));
}

function aiWorkflowBullet(data: IntakeData, roleFamily: RoleFamily) {
  const phrase = aiWorkflowPhrase(data);
  if (!phrase) return "";

  const endings: Record<RoleFamily, string> = {
    Tech: "support technical documentation, testing, and development follow-through.",
    Business: "support research synthesis, documentation, and business decision-making.",
    Operations: "support workflow planning, process documentation, and operational efficiency.",
    "Customer Success": "support customer communication, knowledge retrieval, and service follow-through.",
    Admin: "support documentation, meeting notes, and organized administrative workflows.",
    Sales: "support prospect research, customer communication, and follow-up preparation.",
    Security: "support documentation, reporting, and procedure-focused communication.",
    "Project Coordination": "support project planning, status documentation, and cross-functional follow-through.",
    "IT Support": "support troubleshooting documentation, knowledge retrieval, and user support workflows."
  };

  return `Applied AI-assisted workflows for ${phrase} to ${endings[roleFamily]}`;
}

function buildSkillList(data: IntakeData) {
  const tools = buildToolList(data);
  const responsibilities = buildResponsibilityList(data);
  const occupation = detectOccupationProfile(data);
  const productBuilder = isProductBuilderData(data);
  const aiTools = selectedAiTools(data.tools).map((tool) => tool.toLowerCase());
  const nonAiTools = tools.filter((tool) => !aiTools.includes(tool.toLowerCase()));
  const skillPool = productBuilder
    ? [
        ...productBuilderProfile.strengths,
        ...data.selectedResponsibilities.map(normalizeResponsibility).slice(0, 5),
        ...data.selectedActions.map(normalizeResponsibility).slice(0, 3),
        ...data.customRoleTransferableSkills.map(normalizeResponsibility).slice(0, 5),
        ...data.selectedOutcomes.map(normalizeResponsibility).slice(0, 3),
        ...nonAiTools.slice(0, 5),
        ...buildAiWorkflowSkillList(data)
      ]
    : occupation
      ? [
          ...occupation.transferables,
          ...responsibilities.slice(0, 5),
        ...data.customRoleTransferableSkills.map(normalizeResponsibility).slice(0, 5),
        ...data.customRoleWorkStyles.map(normalizeResponsibility).slice(0, 3),
        ...data.selectedOutcomes.map(normalizeResponsibility).slice(0, 3),
        ...nonAiTools.slice(0, 4),
        ...buildAiWorkflowSkillList(data)
      ]
    : [
        ...responsibilities.slice(0, 6),
        ...data.customRoleTransferableSkills.map(normalizeResponsibility).slice(0, 5),
        ...data.customRoleWorkStyles.map(normalizeResponsibility).slice(0, 3),
        ...roleIntelligence[data.roleFamily].skills.map(normalizeResponsibility),
        ...nonAiTools.slice(0, 4),
        ...buildAiWorkflowSkillList(data),
        ...workflowSkillsByFamily[data.roleFamily]
      ];

  return filterUngroundedOfficeSkills(compact(skillPool), data, occupation).slice(0, 14);
}

function detectDomain(role: ExperienceRole | { title: string; company: string }) {
  const roleHaystack = [role.title, role.company].join(" ").toLowerCase();

  return domainProfiles.find((profile) => profile.keywords.some((keyword) => roleHaystack.includes(keyword))) ?? null;
}

function fallbackDomainProfile(data: IntakeData): DomainProfile | null {
  const combined = [
    data.currentTitle,
    data.currentCompany,
    data.targetJobTitle,
    data.tools,
    data.responsibilities,
    data.customRoleNotes,
    ...data.selectedResponsibilities,
    ...data.selectedActions
  ].join(" ");
  if (productBuilderProfile.keywords.some((keyword) => combined.toLowerCase().includes(keyword))) {
    return productBuilderProfile;
  }

  const independentCategory = inferIndependentWorkCategory([
    data.currentTitle,
    data.previousTitle,
    data.additionalTitle,
    data.targetJobTitle,
    data.responsibilities,
    ...data.selectedIndependentWorkSignals
  ].join(" "));
  if (independentCategory) {
    const arsenal = independentWorkArsenals[independentCategory];
    return {
      name: independentCategory.toLowerCase(),
      keywords: [independentCategory, ...arsenal.domainLanguage],
      environment: arsenal.domainLanguage[0] ? `${arsenal.domainLanguage[0]} environment` : "independent work environment",
      strengths: compact([...data.selectedIndependentWorkSignals, ...arsenal.skills]).slice(0, 5),
      processLanguage: sentenceList(compact([...data.selectedIndependentWorkSignals, ...arsenal.workflows]).slice(0, 4)) || sentenceList(arsenal.workflows.slice(0, 4))
    };
  }

  const industry = cleanWhitespace(data.customRoleIndustry);
  const workStyles = compact(data.customRoleWorkStyles.map(readablePhrase));
  const transferableSkills = compact(data.customRoleTransferableSkills.map(readablePhrase));
  const notes = splitList(data.customRoleNotes).map(readablePhrase);
  const signals = compact([industry.toLowerCase(), ...workStyles, ...transferableSkills, ...notes]);
  if (!signals.length) return null;

  const environmentByIndustry: Array<[RegExp, string, string]> = [
    [/gaming|sportsbook|casino/i, "gaming and customer transaction environment", "customer transactions, payment handling, records, and compliance-aware service steps"],
    [/retail/i, "retail service environment", "POS transactions, customer requests, inventory tasks, and store records"],
    [/warehouse|logistics/i, "logistics and fulfillment environment", "inventory movement, fulfillment tasks, handoffs, and tracking records"],
    [/food|hospitality/i, "fast-paced service environment", "service requests, order flow, customer communication, and shift tasks"],
    [/healthcare/i, "service and records-focused healthcare environment", "patient or customer requests, records, scheduling, and compliance-aware handoffs"],
    [/finance|banking|insurance/i, "transaction and records-focused service environment", "customer requests, payment or account details, records, and policy-aware handoffs"],
    [/security|government/i, "procedure-focused public service environment", "visitor support, documentation, policy steps, and escalation workflows"],
    [/technology|technical/i, "technical support and workflow environment", "technical requests, troubleshooting notes, documentation, and escalation workflows"]
  ];
  const match = environmentByIndustry.find(([pattern]) => pattern.test(industry));
  const environment = match?.[1] ?? `${industry ? industry.toLowerCase() : "cross-functional"} work environment`;
  const processLanguage = match?.[2] ?? (sentenceList(compact([...workStyles, ...transferableSkills]).slice(0, 4)) || "daily work requests, records, and handoffs");
  const strengths = compact([...transferableSkills, ...workStyles, industry]).slice(0, 5);

  return {
    name: "custom",
    keywords: signals,
    environment,
    strengths,
    processLanguage
  };
}

function activityPhrase(responsibility: string) {
  const readable = readablePhrase(responsibility);
  const lower = readable.toLowerCase();
  if (lower.includes("support tickets") || lower.includes("ticket management")) return "handling support tickets";
  if (lower.includes("troubleshooting")) return "troubleshooting user issues";
  if (lower.includes("reporting")) return "preparing reports and updates";
  if (lower.includes("task coordination")) return "coordinating daily tasks";
  if (lower.includes("timeline tracking")) return "tracking timelines";
  if (lower.includes("status reporting")) return "preparing status updates";
  if (lower.includes("scheduling")) return "coordinating schedules";
  if (lower.includes("client communication")) return "supporting client communication";
  if (lower.includes("customer communication")) return "supporting customer communication";
  if (lower.includes("records management")) return "maintaining records";
  if (lower.includes("documentation")) return "maintaining documentation";
  if (lower.includes("crm")) return "updating CRM records";
  return `handling ${readable}`;
}

function responsibilityObject(responsibility: string) {
  const readable = readablePhrase(responsibility);
  if (/support|documentation|communication|coordination|management|tracking|reporting|handling/i.test(readable)) return readable;
  return `${readable} support`;
}

function buildOutcomeSupport(data: IntakeData) {
  const selected = compact(data.selectedOutcomes.map((outcome) => outcome.toLowerCase()));
  const custom = cleanWhitespace(data.outcomes).replace(/^improved\s+/i, "");
  if (selected.length) return sentenceList(selected.slice(0, 2));
  if (custom && !isWeakFreeText(custom)) return custom;
  return "";
}

function evidenceText(data: IntakeData) {
  return [
    data.currentTitle,
    data.previousTitle,
    data.additionalTitle,
    data.currentCompany,
    data.previousCompany,
    data.additionalCompany,
    data.targetJobTitle,
    data.responsibilities,
    data.customRoleIndustry,
    data.customRoleNotes,
    data.customersServed,
    data.outcomes,
    ...data.selectedResponsibilities,
    ...data.selectedActions,
    ...data.customRoleWorkStyles,
    ...data.customRoleTransferableSkills,
    ...data.selectedOutcomes
  ].join(" ");
}

function isProductBuilderData(data: IntakeData) {
  const combined = [
    data.currentTitle,
    data.currentCompany,
    data.targetJobTitle,
    data.tools,
    data.responsibilities,
    data.customRoleNotes,
    ...data.selectedResponsibilities,
    ...data.selectedActions
  ].join(" ");

  return productBuilderProfile.keywords.some((keyword) => combined.toLowerCase().includes(keyword));
}

function detectOccupationProfile(data: IntakeData, role?: ExperienceRole | { title: string; company: string }) {
  const haystack = [evidenceText(data), role?.title, role?.company].join(" ");
  return occupationProfiles.find((profile) => profile.patterns.some((pattern) => pattern.test(haystack))) ?? null;
}

function filterUngroundedOfficeSkills(skills: string[], data: IntakeData, occupation: OccupationProfile | null) {
  if (!occupation) return skills;

  const explicitText = [
    data.tools,
    data.responsibilities,
    ...data.selectedResponsibilities,
    ...data.selectedActions,
    ...data.customRoleTransferableSkills
  ].join(" ");
  const ungroundedOfficeTerms =
    /\b(CRM|Salesforce|HubSpot|Jira|Zendesk|Intercom|ServiceNow|Ticket Triage|Support Tickets|Support Workflows|Account Support|Pipeline Support|Stakeholder Support|Technical Documentation)\b/i;

  return skills.filter((skill) => {
    if (!ungroundedOfficeTerms.test(skill)) return true;
    return new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(explicitText);
  });
}

function occupationToolPhrase(data: IntakeData, occupation: OccupationProfile, max = 2) {
  const explicitTools = buildToolList(data);
  const tools = explicitTools.length ? explicitTools : occupation.universalTools;
  if (!tools.length) return "";
  return ` using ${sentenceList(tools.slice(0, max))}`;
}

function buildOccupationBullets(data: IntakeData, role: ExperienceRole, occupation: OccupationProfile) {
  const toolPhrase = occupationToolPhrase(data, occupation);
  const title = role.title.toLowerCase();
  const customerWord = /caregiver|home health|patient|care/i.test(title) ? "clients" : /security/i.test(title) ? "visitors and staff" : "customers";
  const scopes = buildScopeItems(data);
  const customerScope = scopeForBullet(scopes, ["customersServed", "callsHandled", "ticketsHandled"]);
  const operationsScope = scopeForBullet(scopes, ["reportsCreated", "projectsSupported", "teamSizeSupported"]);
  const teamScope = scopeForBullet(scopes, ["teamSizeSupported"]);
  const bulletsByOccupation: Record<string, string[]> = {
    bartender: [
      customerScope
        ? `Assisted ${customerScope.phrase} while maintaining accuracy during high-volume service periods.`
        : "Assisted guests throughout service while maintaining accuracy during high-volume periods.",
      `Processed payments, managed tabs or orders, and followed cash handling procedures${toolPhrase}.`,
      "Resolved guest concerns with calm communication and policy-aware judgment.",
      "Coordinated with coworkers to keep service flow moving efficiently during busy shifts.",
      "Maintained clean, stocked, and organized work areas to support reliable service."
    ],
    retail: [
      customerScope
        ? `Assisted ${customerScope.phrase} with purchases, returns, and questions while keeping transactions accurate.`
        : "Assisted customers with purchases, returns, and questions while keeping transactions accurate.",
      `Processed checkout activity and supported front-end store operations${toolPhrase}.`,
      "Restocked merchandise, maintained store presentation, and helped keep inventory areas organized.",
      "Escalated larger customer issues to leads or managers with clear context.",
      "Balanced register accuracy, customer service, and shift responsibilities during busy periods."
    ],
    warehouse: [
      operationsScope
        ? `Picked, packed, scanned, or moved ${operationsScope.phrase} while protecting accuracy in a fast-paced fulfillment setting.`
        : "Picked, packed, scanned, or moved orders while protecting accuracy in a fast-paced fulfillment setting.",
      `Used warehouse tools and equipment to support inventory movement and order flow${toolPhrase}.`,
      "Followed safety procedures while keeping work areas clean, organized, and ready for the next task.",
      "Coordinated with coworkers during handoffs to keep packages, materials, or stock moving efficiently.",
      "Maintained attention to detail across repetitive, time-sensitive work."
    ],
    security: [
      "Monitored site activity, access points, or visitor flow while following safety procedures.",
      "Communicated calmly with visitors, staff, and supervisors during routine questions or tense situations.",
      operationsScope
        ? `Documented ${operationsScope.phrase} so handoffs stayed clear and accurate.`
        : "Documented incidents, observations, or shift notes so handoffs stayed clear and accurate.",
      "Used judgment to escalate concerns while staying aligned with site policies.",
      "Maintained reliable coverage and attention to detail across public-facing security responsibilities."
    ],
    delivery: [
      "Managed time-sensitive deliveries by checking orders, planning routes, and completing customer handoffs.",
      `Used delivery and navigation tools to coordinate pickups, drop-offs, and route decisions${toolPhrase}.`,
      "Communicated delays, substitutions, or order issues so customers had clear updates.",
      "Balanced independent work, order accuracy, and customer service across changing daily routes.",
      "Maintained reliable follow-through while handling traffic, restaurant delays, and delivery timing."
    ],
    janitor: [
      "Maintained clean, stocked, and safe spaces by completing routine cleaning and upkeep tasks.",
      `Used cleaning supplies, equipment, or basic tools to support daily facility standards${toolPhrase}.`,
      "Reported broken fixtures, supply needs, or safety concerns so issues could be addressed.",
      "Followed sanitation and safety procedures while moving through assigned areas consistently.",
      "Supported daily operations by keeping shared spaces ready for staff, customers, students, or visitors."
    ],
    "food-service": [
      customerScope
        ? `Prepared orders and assisted ${customerScope.phrase} while balancing speed, accuracy, and service quality.`
        : "Prepared orders and assisted guests while balancing speed, accuracy, and service quality.",
      `Followed shift procedures for register use, restocking, cleaning, and food service flow${toolPhrase}.`,
      "Kept work areas clean and organized while following sanitation expectations.",
      "Coordinated with coworkers during rushes to keep orders moving and reduce service delays.",
      "Handled customer questions or order issues with clear communication and steady follow-through."
    ],
    caregiver: [
      "Supported clients with daily routines while maintaining patience, safety awareness, and respect.",
      `Kept care notes, reminders, or schedule details organized${toolPhrase}.`,
      "Communicated updates to families, supervisors, or care teams when routines or needs changed.",
      "Followed safety and care procedures while helping with meals, mobility, reminders, or light household tasks.",
      "Built trust through consistent attendance, calm communication, and dependable follow-through."
    ],
    receptionist: [
      customerScope
        ? `Managed ${customerScope.phrase} while welcoming visitors, answering questions, and routing requests.`
        : "Welcomed visitors or callers, answered questions, and routed requests to the right person or next step.",
      `Supported scheduling, records, and front desk communication${toolPhrase}.`,
      "Kept office details organized so appointments, messages, and handoffs stayed accurate.",
      "Handled interruptions and competing requests while maintaining a professional front desk experience.",
      "Protected reliability and attention to detail across daily administrative support tasks."
    ],
    construction: [
      "Moved materials, prepared work areas, and supported crews with hands-on job site tasks.",
      `Used tools, equipment, or PPE to complete assigned work safely and consistently${toolPhrase}.`,
      "Followed safety procedures while keeping work areas clean, organized, and ready for crews.",
      teamScope
        ? `Communicated issues, material needs, or next steps across a ${teamScope.phrase}.`
        : "Communicated issues, material needs, or next steps to coworkers, leads, or foremen.",
      "Supported steady job site progress through reliability, physical effort, and attention to task details."
    ]
  };

  const fallback = [
    `Assisted ${customerWord} and coworkers while keeping daily responsibilities accurate and organized.`,
    `Handled ${sentenceList(occupation.dailyTasks.slice(0, 3)).toLowerCase()} in a ${occupation.environment}.`,
    `Communicated clearly around ${sentenceList(occupation.communication.slice(0, 2)).toLowerCase()} and follow-up needs.`,
    `Solved routine problems related to ${sentenceList(occupation.challenges.slice(0, 2)).toLowerCase()}.`,
    "Maintained reliability, attention to detail, and steady follow-through across daily work."
  ];

  return qualityCheckBullets(bulletsByOccupation[occupation.id] ?? fallback, ["Assisted", "Handled", "Resolved", "Coordinated", "Maintained"]);
}

function buildOccupationSummary(data: IntakeData, target: string, experience: ExperienceRole[], occupation: OccupationProfile) {
  const currentRole = experience[0];
  const title = (currentRole?.title ?? cleanWhitespace(data.currentTitle)) || "Worker";
  const strengths = compact([
    ...occupation.transferables,
    ...data.customRoleTransferableSkills.map(normalizeResponsibility),
    ...data.customRoleWorkStyles.map(normalizeResponsibility)
  ]).slice(0, 5);
  const responsibilities = occupation.dailyTasks.map(readablePhrase).slice(0, 4);
  const aiPhrase = aiWorkflowPhrase(data);

  return limitSentences(
    `${title} with experience in a ${occupation.environment}, handling ${sentenceList(responsibilities).toLowerCase()}. Strengths include ${sentenceList(strengths).toLowerCase()}, with a working style built around accuracy, calm communication, and dependable follow-through. Now targeting ${target} roles where practical service experience and steady execution can transfer into the next step.${aiPhrase ? ` Uses AI-assisted workflows for ${aiPhrase} when they support the work directly.` : ""}`,
    4
  );
}

function buildOccupationLinkedInSummary(data: IntakeData, target: string, experience: ExperienceRole[], occupation: OccupationProfile) {
  const currentRole = experience[0];
  const title = (currentRole?.title ?? cleanWhitespace(data.currentTitle)) || "Worker";
  const strengths = occupation.transferables.slice(0, 4);

  return limitSentences(
    `${title} with hands-on experience in a ${occupation.environment}. Brings ${sentenceList(strengths.map((item) => item.toLowerCase()))} into ${targetRoleFamilyText(data, target)}. Looking for roles where practical work experience, clear communication, and reliable follow-through can support better daily operations.`,
    3
  );
}

function buildOccupationHeadline(data: IntakeData, occupation: OccupationProfile) {
  const parts = occupation.headline.split("|").map(cleanWhitespace).filter(Boolean);
  const background = parts[0] ?? occupation.headline;
  const strength = parts[1] ?? roleStrategies[data.roleFamily].valueArea;

  if (data.roleFamily === "Customer Success" && !/customer|client/i.test(occupation.headline)) {
    return `${background} | Customer Service | ${strength}`;
  }
  if (data.roleFamily === "Admin" && !/admin|reception|scheduling/i.test(occupation.headline)) {
    return `${background} | Administrative Support | ${strength}`;
  }
  if (data.roleFamily === "Operations" && !/operations|inventory|logistics|facilities/i.test(occupation.headline)) {
    return `${background} | Operations | ${strength}`;
  }
  return occupation.headline;
}

function isBeautyServiceProfile(data: IntakeData, role?: ExperienceRole | { title: string; company: string }) {
  return /\bbarber|hair stylist|stylist|salon|beauty\b/i.test([evidenceText(data), role?.title, role?.company].join(" "));
}

function evidenceStrengthLabels(data: IntakeData) {
  return buildCareerEvidence(data).map((item) => item.label);
}

function headlineStrengths(data: IntakeData, skills: string[]) {
  const labelMap: Array<[RegExp, string]> = [
    [/repeat clientele|retention|referrals/i, "Client Relationships"],
    [/customer communication/i, "Customer Communication"],
    [/appointment scheduling|scheduling/i, "Scheduling"],
    [/conflict resolution|service recovery/i, "Service Recovery"],
    [/time management/i, "Time Management"],
    [/independent work/i, "Independent Work"],
    [/upselling/i, "Service Recommendations"],
    [/inventory/i, "Inventory Accuracy"],
    [/documentation/i, "Documentation"],
    [/safety|procedures/i, "Procedure Follow-Through"],
    [/team coordination/i, "Team Coordination"]
  ];
  const fromEvidence = evidenceStrengthLabels(data)
    .map((label) => labelMap.find(([pattern]) => pattern.test(label))?.[1])
    .filter(Boolean) as string[];
  const fromSkills = skills
    .filter((skill) => !/[.!?]|answer|candidate|technical support|ticket|user support/i.test(skill))
    .slice(0, 4);

  return compact([...fromEvidence, ...fromSkills])
    .filter((item, index, items) => items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, 3);
}

function directionLabel(data: IntakeData, target: string) {
  if (data.roleFamily === "Customer Success") return /client|customer success/i.test(target) ? "Customer Success / Client Experience" : target;
  if (data.roleFamily === "Admin") return /coordinator|assistant|office|admin/i.test(target) ? "Office Coordination / Admin Support" : target;
  if (data.roleFamily === "Operations") return /coordinator|operations/i.test(target) ? "Operations / Coordination" : target;
  return target;
}

function serviceVolume(data: IntakeData) {
  const scope = cleanWhitespace(data.customersServed);
  if (!scope) return "";
  if (/haircut|client|customer|guest|appointment|per day|\/day|daily/i.test(scope)) return scope;
  return `${scope} clients`;
}

function serviceAudience(data: IntakeData) {
  const text = evidenceText(data);
  if (/older client|older customer|senior client|elderly/i.test(text)) return "an older client base";
  if (/repeat|regular|clientele|referral/i.test(text)) return "repeat clients";
  return "clients";
}

function targetRoleFamilyText(data: IntakeData, target: string) {
  if (data.roleFamily === "Customer Success") return `${target}, client experience, or account support roles`;
  if (data.roleFamily === "Admin") return `${target} or office coordination roles`;
  if (data.roleFamily === "Operations") return `${target} or service operations roles`;
  return `${target} roles`;
}

function hasConcreteScope(data: IntakeData) {
  return buildScopeItems(data).length > 0;
}

function neutralOutcomeClause(data: IntakeData, strategy: RoleStrategy) {
  if (!hasConcreteScope(data) && !buildOutcomeSupport(data)) {
    return ` to support ${strategy.valueArea.toLowerCase()} without overstating metrics`;
  }
  return " to maintain dependable service standards";
}

function chooseToolPhrase(tools: string[], roleFamily: RoleFamily, responsibility: string) {
  if (!tools.length) return "";
  const lowerResponsibility = responsibility.toLowerCase();
  const compatibleTools = tools.filter((tool) => {
    const lowerTool = tool.toLowerCase();
    if (["Customer Success", "Sales"].includes(roleFamily)) return /salesforce|hubspot|zendesk|intercom|crm|google workspace|slack|excel/.test(lowerTool);
    if (roleFamily === "IT Support") return /active directory|jira|servicenow|windows|macos|azure|office 365|zendesk/.test(lowerTool);
    if (roleFamily === "Project Coordination") return /asana|trello|monday|jira|sheets|slack|teams|notion/.test(lowerTool);
    if (roleFamily === "Admin") return /google workspace|office|excel|outlook|calendly|slack|notion|docusign/.test(lowerTool);
    if (roleFamily === "Operations" || roleFamily === "Business") return /excel|sheets|sap|oracle|notion|airtable|tableau|power bi|sql/.test(lowerTool);
    if (roleFamily === "Tech") return /jira|github|sql|sheets|figma|postman|notion|excel/.test(lowerTool);
    return /excel|workspace|teams|slack|system|report|camera|radio|access/.test(lowerTool);
  });

  if (!compatibleTools.length) return "";
  if (/communication|follow|stakeholder|client|customer|support/.test(lowerResponsibility)) {
    return ` using ${sentenceList(compatibleTools.slice(0, 2))}`;
  }
  if (/document|record|report|CRM|ticket|tracking|analysis|timeline|status/i.test(responsibility)) {
    return ` in ${sentenceList(compatibleTools.slice(0, 2))}`;
  }
  return compatibleTools.length >= 2 ? ` with ${sentenceList(compatibleTools.slice(0, 2))}` : "";
}

function roleLevel(role: ExperienceRole, index: number) {
  if (leadershipTerms.test(role.title)) return "senior";
  if (supportTerms.test(role.title)) return index === 0 ? "current-support" : "prior-support";
  return index === 0 ? "current" : "prior";
}

function roleContext(role: ExperienceRole, data: IntakeData, index: number) {
  const strategy = roleStrategies[data.roleFamily];
  const domain = detectDomain(role) ?? fallbackDomainProfile(data);
  const level = roleLevel(role, index);
  const context =
    level === "senior" ? strategy.seniorContext : index === 0 ? strategy.supportContext : `${strategy.supportContext} in an earlier support role`;

  return { strategy, domain, level, context };
}

function renderPattern(pattern: string, context: BulletContext) {
  return cleanSentence(
    pattern.replace(/\{(\w+)\}/g, (_, key: keyof BulletContext) => {
      return context[key] ?? "";
    })
  );
}

function scopeForBullet(scopes: ReturnType<typeof buildScopeItems>, preferredKeys: Array<keyof IntakeData>) {
  return preferredKeys.map((key) => scopes.find((scope) => scope.key === key)).find(Boolean) ?? scopes[0];
}

function cleanSentence(sentence: string) {
  let cleaned = cleanWhitespace(sentence)
    .replace(/\s+([,.])/g, "$1")
    .replace(/\s+\./g, ".")
    .replace(/ ,/g, ",")
    .replace(/\b(\w+)\s+\1\b/gi, "$1")
    .replace(/\ba ([aeiou])/gi, "an $1")
    .replace(/\bwhile ([a-z]+ing)\b/gi, "while $1")
    .replace(/\bwhile ([a-z]+ tickets|[a-z]+ communication|[a-z]+ coordination|[a-z]+ tracking|[a-z]+ reporting)\b/gi, "while handling $1")
    .replace(/\bdocumented documentation\b/gi, "Created documentation")
    .replace(/\bDocumented documentation\b/g, "Created documentation");

  awkwardPhrases.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, (match) => match.replace(/\s+\w+$/i, ""));
  });

  if (!/[.!?]$/.test(cleaned)) cleaned += ".";
  return cleaned;
}

function specificEvidenceBullets(data: IntakeData) {
  const tools = buildToolList(data);
  const responsibilities = buildResponsibilityList(data).map(readablePhrase);
  const evidence = evidenceText(data).toLowerCase();
  const bullets: string[] = [];

  if (/doordash|door dash|delivery|driver|courier|route|dasher|pickup/.test(evidence)) {
    bullets.push("Managed delivery flow by verifying orders, planning routes, communicating delays, and completing time-sensitive customer handoffs.");
  } else if (/restaurant|food service|server|barista|kitchen|guest|kitchen staff/.test(evidence)) {
    bullets.push("Supported guest service by handling orders, restocking supplies, coordinating with kitchen staff, and resolving concerns during busy periods.");
  } else if (/warehouse|fulfillment|pick|pack|scanner|inventory|stock|label|pallet/.test(evidence)) {
    bullets.push("Maintained fulfillment flow by scanning items, moving stock, checking labels, and keeping inventory handoffs organized.");
  } else if (/security|guard|access control|patrol|incident|visitor|de-?escalat/.test(evidence)) {
    bullets.push("Maintained safety coverage by monitoring access points, documenting incidents, following site procedures, and escalating concerns when needed.");
  } else if (/retail|cashier|register|returns?|checkout|shelves|store/.test(evidence)) {
    bullets.push("Supported store flow by handling customer questions, register tasks, inventory upkeep, and team handoffs.");
  }

  if (tools.length && responsibilities.some((item) => /account|case|ticket|customer|client|documentation|records?|notes?/i.test(item))) {
    bullets.push(`Maintained clear records and follow-up notes using ${sentenceList(tools.slice(0, 2))}.`);
  }

  return bullets;
}

function buildBeautyServiceBullets(data: IntakeData) {
  const volume = serviceVolume(data);
  const audience = serviceAudience(data);
  const text = evidenceText(data);
  const bullets = [
    volume
      ? `Served ${volume} while maintaining service quality, time management, and customer satisfaction.`
      : `Served clients in a fast-paced beauty service environment while maintaining quality, time management, and customer satisfaction.`,
    `Built relationships with ${audience} through clear communication, patience, and consistent service.`,
    /appointment|schedul|booking|walk-ins?|walk ins?/i.test(text)
      ? "Managed appointments, walk-ins, client preferences, and changing priorities in a fast-paced service environment."
      : "Managed client preferences, service expectations, and changing priorities in a fast-paced service environment."
  ];

  return qualityCheckBullets(bullets, ["Served", "Built", "Managed"]);
}

function buildExperienceBullets(data: IntakeData, role: ExperienceRole, roleIndex: number) {
  const responsibilities = buildResponsibilityList(data);
  const tools = buildToolList(data);
  const scopes = buildScopeItems(data);
  const outcome = buildOutcomeSupport(data);
  const { strategy, domain, level, context } = roleContext(role, data, roleIndex);
  const verbs = roleIndex === 0 ? strategy.verbs : ["Assisted", "Maintained", "Communicated", "Supported", "Documented"];
  const primary = responsibilities[0] ?? strategy.safeDefaults[0];
  const secondary = responsibilities[1] ?? strategy.safeDefaults[1];
  const tertiary = responsibilities[2] ?? strategy.safeDefaults[2];
  const selectedActions = compact(data.selectedActions.map(normalizeResponsibility)).slice(0, 3);
  const scopeOne = scopeForBullet(scopes, ["customersServed", "ticketsHandled", "callsHandled"]);
  const scopeTwo = scopeForBullet(scopes, ["reportsCreated", "projectsSupported", "teamSizeSupported"]);
  const processLanguage = domain?.processLanguage ?? context;
  const outcomeClause = outcome ? ` to support ${outcome}` : neutralOutcomeClause(data, strategy);
  const environment = domain?.environment ?? strategy.environment;
  const selectedFocus = strategy.focus
    .map(readablePhrase)
    .filter((focus) => ![primary, secondary, tertiary].map(readablePhrase).includes(focus))
    .slice(0, 3);
  const roleFocus = selectedFocus.length ? selectedFocus.join(", ") : strategy.focus.slice(0, 3).map(readablePhrase).join(", ");
  const patterns = bulletPatternLibrary[data.roleFamily];
  const patternContext: BulletContext = {
    action: level === "senior" ? "Coordinated" : verbs[0],
    bridgeAction: verbs[2] ?? "Supported",
    company: role.company,
    context,
    domainAction: activityPhrase(primary),
    environment,
    outcomeClause,
    processLanguage,
    responsibility: readablePhrase(secondary),
    scope: scopeOne ? `${scopeOne.phrase} across ` : "",
    scopeTwo: scopeTwo?.phrase ?? "",
    targetFocus: selectedActions.length ? sentenceList(selectedActions.map(readablePhrase)) : responsibilityObject(tertiary) || roleFocus,
    toolPhrase: roleIndex === 0 ? chooseToolPhrase(tools, data.roleFamily, secondary) : ""
  };

  if (roleIndex === 0 && domain?.name === "product-builder") {
    const projectScope = scopeForBullet(scopes, ["projectsSupported", "reportsCreated"]);
    return qualityCheckBullets(
      [
        projectScope
          ? `Planned features, wrote product copy, and documented issues across ${projectScope.phrase}.`
          : `Planned features, wrote product copy, and documented issues across ${environment}.`,
        "Tested mobile layouts and broken states before shipping usable demos and website updates.",
        tools.length
          ? `Used ${sentenceList(tools.slice(0, 3))} to support product documentation, implementation, and launch follow-through.`
          : "Maintained project notes, QA feedback, and launch follow-through without overstating company scale."
      ],
      verbs
    );
  }

  const occupation = roleIndex === 0 ? detectOccupationProfile(data, role) : null;
  if (occupation) {
    return buildOccupationBullets(data, role, occupation);
  }

  if (roleIndex === 0 && isBeautyServiceProfile(data, role)) {
    return buildBeautyServiceBullets(data);
  }

  if (roleIndex > 0) {
    const priorContext = { ...patternContext, action: verbs[0], bridgeAction: verbs[2] ?? "Communicated", toolPhrase: "", scope: "" };
    return qualityCheckBullets(
      [
        renderPattern(patterns[3], priorContext),
        renderPattern(patterns[4], priorContext),
        renderPattern(patterns[5], priorContext)
      ],
      verbs
    );
  }

  return qualityCheckBullets(
    [
      renderPattern(patterns[0], patternContext),
      renderPattern(patterns[1], patternContext),
      ...specificEvidenceBullets(data),
      aiWorkflowBullet(data, data.roleFamily) || renderPattern(patterns[2], patternContext)
    ],
    verbs
  );
}

function buildExperience(data: IntakeData): ExperienceRole[] {
  const roles = [
    {
      title: data.currentTitle,
      company: data.currentCompany,
      time: data.currentTime,
      fallbackCompany: "Current Company"
    },
    {
      title: data.previousTitle,
      company: data.previousCompany,
      time: data.previousTime,
      fallbackCompany: "Previous Company"
    },
    {
      title: data.additionalTitle,
      company: data.additionalCompany,
      time: data.additionalTime,
      fallbackCompany: "Additional Company"
    }
  ]
    .filter((role) => cleanWhitespace(role.title))
    .slice(0, 3)
    .map((role) => ({
      title: findIndependentWorkRole(role.title) || inferIndependentWorkCategory(role.title)
        ? formatIndependentTitle(findIndependentWorkRole(role.title)?.title ?? titleCase(role.title), data.independentWorkType)
        : titleCase(role.title),
      company: normalizeCompany(role.company) || (findIndependentWorkRole(role.title) || inferIndependentWorkCategory(role.title) ? data.independentWorkType || "Independent Work" : role.fallbackCompany),
      time: isWeakFreeText(role.time) ? "Dates" : cleanWhitespace(role.time) || "Dates",
      bullets: []
    }));

  return roles.map((role, index) => ({
    ...role,
    bullets: buildExperienceBullets(data, role, index)
  }));
}

function qualityCheckBullets(bullets: string[], fallbackVerbs: string[]) {
  const usedOpeners = new Set<string>();

  return compact(bullets)
    .map(cleanSentence)
    .map((bullet) => {
      const opener = bullet.split(" ")[0];
      if (!usedOpeners.has(opener.toLowerCase())) {
        usedOpeners.add(opener.toLowerCase());
        return bullet;
      }
      const replacement = fallbackVerbs.find((verb) => !usedOpeners.has(verb.toLowerCase())) ?? "Supported";
      usedOpeners.add(replacement.toLowerCase());
      return bullet.replace(/^\w+/, replacement);
    })
    .filter((bullet) => bullet.length > 30)
    .slice(0, 5);
}

function limitSentences(value: string, maxSentences: number) {
  const sentences = value.match(/[^.!?]+[.!?]+/g)?.map(cleanWhitespace) ?? [cleanSentence(value)];
  return sentences.slice(0, maxSentences).join(" ");
}

function buildSummary(data: IntakeData, target: string, experience: ExperienceRole[]) {
  const roleFamily = data.roleFamily;
  const currentRole = experience[0];
  const domain = currentRole ? detectDomain(currentRole) ?? fallbackDomainProfile(data) : fallbackDomainProfile(data);
  const occupation = currentRole ? detectOccupationProfile(data, currentRole) : detectOccupationProfile(data);
  const strategy = roleStrategies[roleFamily];
  const responsibilities = buildResponsibilityList(data);
  if (occupation) {
    return buildOccupationSummary(data, target, experience, occupation);
  }
  if (currentRole && isBeautyServiceProfile(data, currentRole)) {
    const volume = serviceVolume(data);
    const volumePhrase = volume ? ` serving ${volume}` : "";
    const evidence = evidenceStrengthLabels(data);
    const strengths = compact([
      evidence.some((item) => /customer communication/i.test(item)) ? "communication" : "",
      evidence.some((item) => /time management/i.test(item)) ? "time management" : "",
      evidence.some((item) => /repeat clientele|retention/i.test(item)) ? "client relationship-building" : "",
      evidence.some((item) => /scheduling/i.test(item)) ? "scheduling" : "",
      evidence.some((item) => /conflict resolution/i.test(item)) ? "service recovery" : "",
      "reliability"
    ]).slice(0, 5);
    return limitSentences(
      `${currentRole.title} with experience${volumePhrase}, managing appointments, building repeat customer relationships, and handling service expectations in a fast-paced environment. Brings strong ${sentenceList(strengths)} into ${targetRoleFamilyText(data, target)}.`,
      3
    );
  }
  const background = currentRole
    ? `${currentRole.title} with experience in ${domain?.environment ?? strategy.environment}`
    : `Early-career professional with ${roleFamily.toLowerCase()} experience`;
  const strengths = compact([...(domain?.strengths ?? []), ...responsibilities.map(readablePhrase), ...strategy.focus.map(readablePhrase)]).slice(0, 3);
  const aiPhrase = aiWorkflowPhrase(data);
  const direction = `${target} roles`;

  return limitSentences(
    `${background}. Brings ${sentenceList(strengths)}${aiPhrase ? ` while using AI-assisted workflows for ${aiPhrase}` : ""} with a transition focus toward ${direction}.`,
    3
  );
}

function buildLinkedInSummary(data: IntakeData, target: string, experience: ExperienceRole[]) {
  const currentRole = experience[0];
  const domain = currentRole ? detectDomain(currentRole) ?? fallbackDomainProfile(data) : fallbackDomainProfile(data);
  const occupation = currentRole ? detectOccupationProfile(data, currentRole) : detectOccupationProfile(data);
  const strategy = roleStrategies[data.roleFamily];
  const responsibilities = buildResponsibilityList(data).slice(0, 2).map(readablePhrase);
  const strengths = compact([...(domain?.strengths ?? []), ...responsibilities, ...strategy.focus.map(readablePhrase)]).slice(0, 3);
  const environment = domain?.environment ?? strategy.environment;
  if (occupation) {
    return buildOccupationLinkedInSummary(data, target, experience, occupation);
  }
  if (currentRole && isBeautyServiceProfile(data, currentRole)) {
    const volume = serviceVolume(data);
    const volumePhrase = volume ? ` ${volume},` : "";
    return limitSentences(
      `${currentRole.title} with hands-on client service experience in a beauty and appointment-based environment. Brings${volumePhrase} repeat client relationships, scheduling, clear communication, and service recovery into ${targetRoleFamilyText(data, target)}.`,
      3
    );
  }
  const strengthText = sentenceList(strengths);
  const aiPhrase = aiWorkflowPhrase(data);
  const aiSentence = aiPhrase ? ` Uses AI-assisted workflows for ${aiPhrase} without replacing the underlying work or judgment.` : "";
  const variants: Record<RoleFamily, string> = {
    "Customer Success": `${target} candidate with hands-on experience in ${environment}. Strongest areas include ${strengthText}, with a service style built around clear updates, organized notes, and dependable follow-through.${aiSentence}`,
    Operations: `${target} candidate with practical experience keeping work organized in ${environment}. Brings ${strengthText} and a steady approach to documentation, handoffs, and process consistency.${aiSentence}`,
    Admin: `${target} candidate with experience supporting ${environment}. Brings ${strengthText}, organized communication, and reliable follow-through across records, schedules, and daily office needs.${aiSentence}`,
    Sales: `${target} candidate with experience supporting customer-facing workflows in ${environment}. Brings ${strengthText} and a practical approach to follow-up, account notes, and pipeline support.${aiSentence}`,
    Business: `${target} candidate with experience supporting reporting and workflow clarity in ${environment}. Brings ${strengthText}, organized documentation, and a practical eye for operational details.${aiSentence}`,
    "Project Coordination": `${target} candidate with experience keeping project details moving in ${environment}. Brings ${strengthText}, clear status communication, and organized follow-through across timelines and handoffs.${aiSentence}`,
    "IT Support": `${target} candidate with experience in ${environment}. Brings ${strengthText}, clear troubleshooting notes, and a user-focused approach to ticket resolution and escalation.${aiSentence}`,
    Tech: `${target} candidate with experience supporting ${environment}. Brings ${strengthText}, organized documentation, and practical follow-through across technical workflows.${aiSentence}`,
    Security: `${target} candidate with experience in ${environment}. Brings ${strengthText}, calm communication, and procedure-focused follow-through in public-facing settings.${aiSentence}`
  };

  return limitSentences(variants[data.roleFamily], 3);
}

function buildHeadline(data: IntakeData, target: string, skills: string[], experience: ExperienceRole[]) {
  const background = cleanWhitespace(experience[0]?.title ?? "") || cleanWhitespace(data.currentTitle) || "Career Switcher";
  const occupation = experience[0] ? detectOccupationProfile(data, experience[0]) : detectOccupationProfile(data);
  if (occupation) {
    return buildOccupationHeadline(data, occupation);
  }
  const strengths = headlineStrengths(data, skills);
  const headline = `${background} | ${directionLabel(data, target)} | ${strengths.join(", ") || roleStrategies[data.roleFamily].valueArea}`;
  return headline.length > 115 ? `${background} | ${directionLabel(data, target)} | ${strengths.slice(0, 2).join(", ")}` : headline;
}

function qualityCheckResume(resume: ResumePackage): ResumePackage {
  const experience = resume.experience.map((role) => ({
    ...role,
    bullets: qualityCheckBullets(role.bullets, ["Supported", "Documented", "Maintained"]).filter(
      (bullet, index, bullets) => bullets.findIndex((item) => item.toLowerCase() === bullet.toLowerCase()) === index
    )
  }));

  return {
    ...resume,
    summary: limitSentences(cleanSentence(resume.summary), 3),
    coreSkills: compact(resume.coreSkills).slice(0, 14),
    experience,
    linkedinHeadline: resume.linkedinHeadline.length > 120 ? resume.linkedinHeadline.slice(0, 117).replace(/\s+\S*$/, "") + "..." : resume.linkedinHeadline,
    linkedinSummary: limitSentences(resume.linkedinSummary, 3)
  };
}

export function generateResumePackage(data: IntakeData): ResumePackage {
  const target = normalizeTargetRole(data);
  const skills = buildSkillList(data);
  const experience = buildExperience(data);
  const education = formatEducationEntries(data.education.split(/\n|;/)) || educationPlaceholder;

  return polishResumePackage(qualityCheckResume({
    summary: buildSummary(data, target, experience),
    coreSkills: skills,
    experience,
    education,
    linkedinHeadline: buildHeadline(data, target, skills, experience),
    linkedinSummary: buildLinkedInSummary(data, target, experience)
  }));
}
