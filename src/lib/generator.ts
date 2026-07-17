import { roleIntelligence } from "@/lib/career-data";
import { formatEducationEntries } from "@/lib/education-intelligence";
import { findIndependentWorkRole, formatIndependentTitle, independentWorkArsenals, inferIndependentWorkCategory } from "@/lib/independent-work-intelligence";
import { aiToolOptions, buildAiAtsKeywords, normalizeAiWorkflow, selectedAiTools } from "@/lib/modern-work-intelligence";
import { educationPlaceholder } from "@/lib/resume-export";
import { polishResumePackage } from "@/lib/resume-intelligence";
import { normalizeTransferTarget } from "@/lib/transferable-targets";
import { buildCareerEvidence } from "@/lib/career-recommendations";
import { isUncertaintyStatement, stripTerminationReasons, toResumeVoice } from "@/lib/truth-guards";
import type { ExperienceRole, IntakeData, ResumePackage, RoleFamily } from "@/types/career";

// ---------------------------------------------------------------------------
// Honesty gate: template taxonomy (occupation profiles, role-family skills,
// domain strengths) may only reach a generated draft when the user's own words
// evidence it. The grounding corpus is everything the user typed or explicitly
// selected; ungrounded template content is dropped, never emitted.
// ---------------------------------------------------------------------------

export function buildGroundingCorpus(data: IntakeData) {
  return [
    data.currentTitle,
    data.previousTitle,
    data.additionalTitle,
    data.currentCompany,
    data.previousCompany,
    data.additionalCompany,
    data.targetJobTitle,
    data.tools,
    data.responsibilities,
    data.outcomes,
    data.customRoleIndustry,
    data.customRoleNotes,
    data.education,
    data.independentWorkType,
    data.customersServed,
    data.ticketsHandled,
    data.projectsSupported,
    data.teamSizeSupported,
    data.callsHandled,
    data.revenueInfluenced,
    data.reportsCreated,
    ...data.selectedResponsibilities,
    ...data.selectedActions,
    ...data.selectedOutcomes,
    ...data.customRoleWorkStyles,
    ...data.customRoleTransferableSkills,
    ...data.selectedIndependentWorkSignals,
    ...data.selectedAiWorkflows
  ]
    .join(" ")
    .toLowerCase();
}

// Interchangeable evidence stems: a claim token counts as grounded when the
// corpus contains any stem from the token's group.
const groundingAliasGroups: string[][] = [
  ["customer", "client", "guest", "patient", "resident", "visitor", "member", "shopper", "rider", "caller", "student", "families", "family", "people"],
  ["cash", "register", "payment", "transaction", "tab", "drawer", "till", "checkout", "pos", "deposit", "withdrawal", "refund", "money", "rang up", "wager"],
  ["clean", "sanit", "mop", "sweep", "wipe", "housekeep", "janitor", "custod"],
  ["stock", "restock", "inventory", "shelv", "merchandis", "shipment", "suppli", "pallet"],
  ["schedul", "appointment", "calendar", "booking", "shift", "coverage"],
  ["document", "note", "record", "log", "report", "paperwork", "file", "wrote", "writ"],
  ["deliver", "route", "courier", "dispatch", "doordash", "driver", "driving", "drove", "trip"],
  ["conflict", "de-escalat", "deescalat", "upset", "angry", "complaint", "calm", "tense", "resolut", "resolv", "frustrat"],
  ["team", "coworker", "crew", "staff", "colleague", "kitchen staff", "servers"],
  ["safety", "safe", "ppe", "osha", "hazard"],
  ["order", "ticket", "request", "case", "wager", "issue"],
  ["communicat", "messag", "call", "phone", "email", "chat", "answer", "explain", "talk", "greet"],
  ["train", "coach", "onboard", "mentor", "taught", "teach"],
  ["troubleshoot", "debug", "fix", "repair", "resolv"],
  ["service", "serve", "serving", "served", "help", "assist", "support"],
  ["time-sensitive", "rush", "busy", "deadline", "peak", "fast-paced", "delay", "time management"],
  ["organiz", "organis", "coordinat", "arrang", "sort"],
  ["escalat", "supervisor", "manager", "lead", "foreman"],
  ["accura", "checked", "check", "detail", "error", "label", "mismatch"],
  ["equipment", "tool", "forklift", "machine", "scanner", "ladder", "vehicle", "radio"],
  ["test", "qa", "quality", "bug", "broken"],
  ["web", "website", "app", "page", "site", "demo", "launch", "deploy", "shipped"],
  ["automat", "workflow", "process"]
];

// Curated grounding for common resume-category labels whose tokens do not
// stem-match the plain words users actually write.
const labelGrounding = new Map<string, RegExp>([
  ["customer service", /\b(customers?|clients?|guests?|patients?|shoppers?|visitors?|members?|riders?|callers?)\b/],
  ["cash handling", /\b(cash|registers?|payments?|tabs?|drawer|transactions?|checkout|pos|deposits?|withdrawals?|wagers?)\b/],
  ["payment processing", /\b(payments?|cash|registers?|transactions?|checkout|pos|tabs?|wagers?)\b/],
  ["conflict resolution", /\b(upset|angry|complaints?|conflict|de-?escalat\w*|calm(?:ed|ing|ly)?|tense|frustrated)\b/],
  ["time management", /\b(time-sensitive|rush(?:es)?|busy|deadlines?|fast-paced|on time|timing|peak|delays?)\b/],
  ["team coordination", /\b(teams?|coworkers?|crews?|staff|colleagues?|handoffs?|kitchen)\b/],
  ["attention to detail", /\b(accurate|accuracy|checked|details?|errors?|labels?|dates|mismatch\w*)\b/],
  ["order accuracy", /\b(orders?|accuracy|accurate)\b/],
  ["problem solving", /\b(problems?|issues?|resolved?|fixed|solved?|troubleshoot|troubleshot)\b/],
  ["patient support", /\b(patients?|residents?|clients?|care)\b/],
  ["safety procedures", /\b(safety|safe|ppe|osha|sanitation)\b/],
  ["inventory", /\b(inventory|stock(?:ed|ing|er)?|restock\w*|shelves|shelf|shipments?|supplies|pallets?)\b/],
  ["documentation", /\b(document\w*|notes?|records?|logs?|reports?|paperwork|wrote)\b/],
  ["reliability", /\b(reliab\w*|on time|showed up|never missed|attendance|dependab\w*|consistent\w*|covered shifts?)\b/],
  ["route planning", /\b(routes?|deliver\w*|navigation|trips?|dasher|doordash)\b/],
  ["equipment operation", /\b(equipment|tools?|forklift|pallet|machines?|scanners?|ladders?|vehicles?)\b/],
  ["scheduling", /\b(schedul\w*|appointments?|calendars?|bookings?)\b/],
  ["independent work", /\b(independent\w*|solo|on my own|self-directed|freelance|gig|by myself)\b/],
  ["cleaning standards", /\b(clean\w*|sanit\w*|mop\w*|sweep\w*|housekeep\w*)\b/],
  ["relationship building", /\b(repeat|regulars?|relationships?|clientele|referrals?|trust)\b/],
  ["adaptability", /\b(adapt\w*|changing|switch\w*|flexib\w*|jumped)\b/]
]);

const groundingStopWords = new Set(["and", "or", "the", "a", "an", "of", "for", "with", "to", "in", "on", "at", "per", "my", "our", "their", "into"]);

function stemGroundingToken(token: string) {
  let stem = token;
  if (stem.length > 5) stem = stem.replace(/(ing|ers|ies)$/, "");
  if (stem.length > 4) stem = stem.replace(/(ed|es|s)$/, "");
  return stem;
}

// True when every significant token in the claim has evidence in the corpus.
export function isGroundedClaim(claim: string, corpus: string) {
  const key = cleanWhitespace(claim).toLowerCase();
  if (!key) return false;
  const curated = labelGrounding.get(key);
  if (curated) return curated.test(corpus);
  const tokens = key.split(/[^a-z0-9+$%-]+/).filter((token) => token.length > 2 && !groundingStopWords.has(token));
  if (!tokens.length) return corpus.includes(key);
  return tokens.every((token) => {
    const stem = stemGroundingToken(token);
    if (corpus.includes(stem)) return true;
    const aliasGroup = groundingAliasGroups.find((group) => group.some((alias) => stem.startsWith(alias) || alias.startsWith(stem)));
    return aliasGroup ? aliasGroup.some((alias) => corpus.includes(alias)) : false;
  });
}

function groundedOnly(items: string[], corpus: string) {
  return items.filter((item) => isGroundedClaim(item, corpus));
}

// Near-duplicate collapse: drops items whose normalized text is contained in a
// longer sibling ("Order Names" vs "Checked Order Names"), keeping the more
// specific one.
export function dedupeNearIdentical(items: string[]) {
  const normalized = items.map((item) => item.replace(/\s+/g, " ").trim().toLowerCase().replace(/^(the|a|an)\s+/, ""));
  return items.filter((item, index) => {
    const key = normalized[index];
    if (!key) return false;
    return !normalized.some((other, otherIndex) => {
      if (otherIndex === index || !other) return false;
      if (other === key) return otherIndex < index;
      return other.includes(key);
    });
  });
}

const defaultTargetByFamily: Record<RoleFamily, string> = {
  Tech: "Technical Support Associate",
  Business: "Business Operations Associate",
  Operations: "Operations Associate",
  "Customer Success": "Customer Success Associate",
  Admin: "Administrative Assistant",
  Healthcare: "Patient Services Representative",
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
  Healthcare: ["Patient Support", "Care Documentation", "Appointment Coordination", "Reliable Follow-Through"],
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
    keywords: ["caregiver", "home health", "home health aide", "care aide", "resident", "patient care", "personal care", "cna", "nursing assistant"],
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
  keywords: ["founder", "product lab", "product builder", "ai product builder", "mvp", "website", "websites", "web designer", "landing page", "webflow", "figma", "web app", "ai app", "automation", "launched demos", "shipped demos", "website updates"],
  environment: "hands-on product and web project environment",
  strengths: ["Product Documentation", "Mobile QA", "Website Build Work", "Workflow Automation"],
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
  Healthcare: {
    focus: ["patient support", "care documentation", "appointment coordination", "family communication", "safety routines"],
    safeDefaults: ["Patient Support", "Care Documentation", "Appointment Coordination", "Safety Routines"],
    verbs: ["Supported", "Documented", "Coordinated", "Communicated", "Maintained"],
    environment: "healthcare support and patient service environment",
    supportContext: "patient support, care notes, and appointment coordination",
    seniorContext: "healthcare support workflows and patient communication",
    valueArea: "Patient Support"
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
const acronyms = new Map([
  ["ai", "AI"],
  ["api", "API"],
  ["arr", "ARR"],
  ["crm", "CRM"],
  ["csm", "CSM"],
  ["csat", "CSAT"],
  ["css", "CSS"],
  ["github", "GitHub"],
  ["html", "HTML"],
  ["hubspot", "HubSpot"],
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["it", "IT"],
  ["kpi", "KPI"],
  ["macos", "macOS"],
  ["pos", "POS"],
  ["qa", "QA"],
  ["qbr", "QBR"],
  ["qbrs", "QBRs"],
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

const splitList = (value: string) =>
  value
    .split(/,|\n/)
    .map((item) => cleanWhitespace(item).replace(/^(and|or|plus|also|as well as)\s+/i, ""))
    .filter((item) => !isWeakFreeText(item) && !isUncertaintyStatement(item))
    .filter(Boolean);

// "HTML, CSS, and some JavaScript from class" must yield HTML/CSS/JavaScript,
// never the fragment "and some JavaScript from class". Better under-split
// than fabricate: prose fragments are rejected outright.
function cleanToolFragment(item: string) {
  return cleanWhitespace(item)
    .replace(/^(some|a little|a little bit of|a bit of|basic|mostly|just|learning)\s+/i, "")
    .replace(/\s+(from|in|at|during)\s+(class(es)?|school|college|a course|courses?|work|my degree|training)\b.*$/i, "");
}

function looksLikeProseFragment(item: string) {
  if (item.split(/\s+/).length > 4) return true;
  return /\b(showing|shows?|show up|worked|working|helped|helping|did|doing|was|were|is|are|had|have|got|getting|every|always|being)\b/i.test(item);
}

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
  if (isWeakTarget(data.targetJobTitle) && isProductBuilderData(data)) return "Product Operations Associate";
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
      // "I don't know my numbers" is uncertainty, not scope evidence.
      if (!value || isUncertaintyStatement(value)) return null;
      const basePhrase = formatScopePhrase(value, shortLabel, aliases);
      const phrase =
        key === "customersServed" && ["IT Support", "Tech"].includes(data.roleFamily)
          ? basePhrase.replace(/\bcustomers\b/gi, "users")
          : basePhrase;
      return { key, value, shortLabel, longLabel, phrase };
    })
    .filter(Boolean) as Array<{ key: keyof IntakeData; value: string; shortLabel: string; longLabel: string; phrase: string }>;
}

// Free-text responsibilities become phrase fragments. Fragments that read as
// role statements or third-party narration are dropped rather than templated.
function splitResponsibilityText(value: string) {
  const { text } = stripTerminationReasons(value);
  return text
    .split(/,|\n|;|\.|\band\b/i)
    .map((item) => cleanWhitespace(item).replace(/^(i|we)\s+(also\s+)?/i, "").replace(/^(and|or|plus|also)\s+/i, ""))
    .filter((item) => item.length > 2 && !isWeakFreeText(item) && !isUncertaintyStatement(item))
    .filter((item) => !/^(worked|was|am|is|work)\s+(at|in|for|as)\b/i.test(item))
    .filter((item) => !/\b(me|they|them|it was|i was|i am|my manager|my boss)\b/i.test(item));
}

// Extraction artifacts ("Clients About What They Wanted") read as narration,
// not responsibilities; they are dropped rather than templated.
function looksLikeNarrationFragment(item: string) {
  return /\b(they|them|about what|it was|i was)\b/i.test(item);
}

function buildUserResponsibilityList(data: IntakeData) {
  return compact([
    ...data.selectedIndependentWorkSignals.map(normalizeResponsibility),
    ...data.customRoleTransferableSkills.map(normalizeResponsibility),
    ...data.customRoleWorkStyles.map(normalizeResponsibility),
    ...data.selectedResponsibilities.map(normalizeResponsibility),
    normalizeResponsibility(data.customRoleIndustry),
    ...splitResponsibilityText(data.responsibilities).map(normalizeResponsibility)
  ])
    .filter((item) => !looksLikeNarrationFragment(item))
    .slice(0, 10);
}

function buildResponsibilityList(data: IntakeData) {
  const userResponsibilities = buildUserResponsibilityList(data);
  const occupation = detectOccupationProfile(data);
  if (occupation) {
    // Occupation taxonomy survives ONLY where the user's own words evidence it.
    const corpus = buildGroundingCorpus(data);
    return dedupeNearIdentical(
      compact([
        ...userResponsibilities,
        ...groundedOnly([...occupation.dailyTasks, ...occupation.communication, ...occupation.challenges], corpus)
      ])
    ).slice(0, 10);
  }
  // No safe-default fallback: an empty list stays empty rather than inheriting
  // role-family boilerplate the user never confirmed.
  return dedupeNearIdentical(userResponsibilities);
}

function buildToolList(data: IntakeData) {
  return compact(
    splitList(data.tools)
      .map(cleanToolFragment)
      .filter((tool) => tool && !isWeakFreeText(tool) && !looksLikeProseFragment(tool))
      .map(normalizeTool)
  ).slice(0, 6);
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

function aiWorkflowBullet(data: IntakeData) {
  // The workflows themselves are user-selected; the sentence adds no claims
  // about what the AI use achieved.
  const phrase = aiWorkflowPhrase(data);
  if (!phrase) return "";
  return `Applied AI-assisted workflows for ${phrase} as part of day-to-day work.`;
}

// Skill labels must read as skills, not sentences: reject first-person
// fragments and prose leaking in from free text.
function looksLikeSkillLabel(skill: string) {
  if (/^(i|we|my|our)\b/i.test(skill)) return false;
  if (skill.split(/\s+/).length > 5) return false;
  if (/\b(me|them|they|was|were|about|because)\b/i.test(skill)) return false;
  return true;
}

function buildSkillList(data: IntakeData) {
  const corpus = buildGroundingCorpus(data);
  const tools = buildToolList(data);
  const responsibilities = buildResponsibilityList(data);
  const occupation = detectOccupationProfile(data);
  const aiTools = selectedAiTools(data.tools).map((tool) => tool.toLowerCase());
  const nonAiTools = tools.filter((tool) => !aiTools.includes(tool.toLowerCase()));
  // Taxonomy labels enter only when grounded in the user's own words.
  const taxonomy = isProductBuilderData(data)
    ? productBuilderProfile.strengths
    : occupation
      ? occupation.transferables
      : [...roleIntelligence[data.roleFamily].skills, ...workflowSkillsByFamily[data.roleFamily]];
  const skillPool = [
    ...groundedOnly(taxonomy, corpus).map(normalizeResponsibility),
    ...responsibilities.slice(0, 8),
    ...data.selectedResponsibilities.map(normalizeResponsibility).slice(0, 6),
    ...data.selectedActions.map(normalizeResponsibility).slice(0, 3),
    ...data.customRoleTransferableSkills.map(normalizeResponsibility).slice(0, 5),
    ...data.customRoleWorkStyles.map(normalizeResponsibility).slice(0, 3),
    ...data.selectedOutcomes.map(normalizeResponsibility).slice(0, 3),
    ...nonAiTools.slice(0, 5),
    ...buildAiWorkflowSkillList(data)
  ];

  return dedupeNearIdentical(filterUngroundedOfficeSkills(compact(skillPool), data, occupation).filter(looksLikeSkillLabel)).slice(0, 14);
}

function matchesDomainKeyword(haystack: string, keyword: string) {
  const normalized = keyword.toLowerCase();
  if (normalized.length <= 3) {
    return new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(haystack);
  }
  return haystack.includes(normalized);
}

function detectDomain(role: ExperienceRole | { title: string; company: string }) {
  const roleHaystack = [role.title, role.company].join(" ").toLowerCase();

  if (productBuilderProfile.keywords.some((keyword) => matchesDomainKeyword(roleHaystack, keyword))) {
    return productBuilderProfile;
  }

  return domainProfiles.find((profile) => profile.keywords.some((keyword) => matchesDomainKeyword(roleHaystack, keyword))) ?? null;
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
  const lowerCombined = combined.toLowerCase();
  if (productBuilderProfile.keywords.some((keyword) => matchesDomainKeyword(lowerCombined, keyword))) {
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
    const corpus = buildGroundingCorpus(data);
    // Arsenal taxonomy is gated the same way as occupation taxonomy: only
    // grounded skills/workflows may describe the user.
    const groundedArsenalSkills = groundedOnly(arsenal.skills, corpus);
    const groundedArsenalWorkflows = groundedOnly(arsenal.workflows, corpus);
    return {
      name: independentCategory.toLowerCase(),
      keywords: [independentCategory, ...arsenal.domainLanguage],
      environment: arsenal.domainLanguage[0] ? `${arsenal.domainLanguage[0]} environment` : "independent work environment",
      strengths: compact([...data.selectedIndependentWorkSignals, ...groundedArsenalSkills]).slice(0, 5),
      processLanguage: sentenceList(compact([...data.selectedIndependentWorkSignals, ...groundedArsenalWorkflows]).slice(0, 4))
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

function buildOutcomeSupport(data: IntakeData) {
  // Only short user-picked labels or a short custom phrase interpolate into a
  // clause; longer outcome text becomes its own bullet instead (never spliced
  // mid-sentence), and uncertainty statements never become claims.
  const selected = compact(data.selectedOutcomes.filter((outcome) => outcome.split(/\s+/).length <= 4).map((outcome) => outcome.toLowerCase()));
  const custom = cleanWhitespace(stripTerminationReasons(data.outcomes).text).replace(/^improved\s+/i, "");
  if (selected.length) return sentenceList(selected.slice(0, 2));
  if (custom && custom.length <= 60 && !isWeakFreeText(custom) && !isUncertaintyStatement(custom)) return custom;
  return "";
}

// Sentence-like outcome text the user wrote becomes standalone bullets in
// resume voice (first-person stripped, termination reasons withheld).
function userOutcomeBullets(data: IntakeData) {
  const { text } = stripTerminationReasons(data.outcomes);
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => cleanWhitespace(sentence))
    .filter((sentence) => sentence.length > 20 && !isWeakFreeText(sentence) && !isUncertaintyStatement(sentence))
    .map((sentence) => cleanSentence(toResumeVoice(sentence)))
    .slice(0, 2);
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

  const lowerCombined = combined.toLowerCase();
  return productBuilderProfile.keywords.some((keyword) => matchesDomainKeyword(lowerCombined, keyword));
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

function occupationToolPhrase(data: IntakeData, max = 2) {
  // Only tools the user actually named — occupation "universal tools" are a
  // guess and never enter the draft.
  const explicitTools = buildToolList(data);
  if (!explicitTools.length) return "";
  return ` using ${sentenceList(explicitTools.slice(0, max))}`;
}

type GroundedBullet = { text: string; when?: RegExp };

function buildOccupationBullets(data: IntakeData, role: ExperienceRole, occupation: OccupationProfile) {
  const corpus = buildGroundingCorpus(data);
  const toolPhrase = occupationToolPhrase(data);
  const scopes = buildScopeItems(data);
  const customerScope = scopeForBullet(scopes, ["customersServed", "callsHandled", "ticketsHandled"]);
  const operationsScope = scopeForBullet(scopes, ["reportsCreated", "projectsSupported", "teamSizeSupported"]);
  const teamScope = scopeForBullet(scopes, ["teamSizeSupported"]);
  // Every canned bullet carries a `when` gate: it renders only if the user's
  // own words evidence its central claims. Ungated bullets make no concrete
  // task claims beyond the detected occupation title itself.
  const groundedBulletsByOccupation: Record<string, GroundedBullet[]> = {
    bartender: [
      {
        text: customerScope
          ? `Assisted ${customerScope.phrase} while maintaining accuracy during high-volume service periods.`
          : "Assisted guests throughout service while maintaining accuracy during high-volume periods.",
        when: /\b(guests?|customers?|served?|serving|bar)\b/
      },
      { text: `Processed payments, managed tabs or orders, and followed cash handling procedures${toolPhrase}.`, when: /\b(payments?|cash|tabs?|registers?|pos|checkout)\b/ },
      { text: "Resolved guest concerns with calm communication and policy-aware judgment.", when: /\b(upset|angry|complaints?|calm\w*|concerns?|de-?escalat\w*|ids?)\b/ },
      { text: "Coordinated with coworkers to keep service flow moving efficiently during busy shifts.", when: /\b(coworkers?|team|busy|rush\w*|shifts?)\b/ },
      { text: "Maintained clean, stocked, and organized work areas to support reliable service.", when: /\b(clean\w*|stock\w*|restock\w*|organiz\w*|sanit\w*)\b/ }
    ],
    retail: [
      {
        text: customerScope
          ? `Assisted ${customerScope.phrase} with purchases, returns, and questions while keeping transactions accurate.`
          : "Assisted customers with purchases, returns, and questions while keeping transactions accurate.",
        when: /\b(customers?|guests?|shoppers?|returns?|questions?)\b/
      },
      { text: `Processed checkout activity and supported front-end store operations${toolPhrase}.`, when: /\b(checkout|registers?|pos|cash|payments?|rang)\b/ },
      { text: "Restocked merchandise, maintained store presentation, and helped keep inventory areas organized.", when: /\b(stock\w*|restock\w*|inventory|shelves|shelf|merchandis\w*)\b/ },
      { text: "Escalated larger customer issues to leads or managers with clear context.", when: /\b(escalat\w*|leads?|managers?|supervisors?)\b/ },
      { text: "Balanced register accuracy, customer service, and shift responsibilities during busy periods.", when: /\b(registers?|busy|rush\w*|accurate|accuracy)\b/ }
    ],
    warehouse: [
      {
        text: operationsScope
          ? `Picked, packed, scanned, or moved ${operationsScope.phrase} while protecting accuracy in a fast-paced fulfillment setting.`
          : "Picked, packed, scanned, or moved orders while protecting accuracy in a fast-paced fulfillment setting.",
        when: /\b(pick\w*|pack\w*|scan\w*|moved|loading|loaded|unloaded|sort\w*)\b/
      },
      { text: `Used warehouse tools and equipment to support inventory movement and order flow${toolPhrase}.`, when: /\b(scanners?|forklifts?|pallets?|equipment|tools?|carts?)\b/ },
      { text: "Followed safety procedures while keeping work areas clean, organized, and ready for the next task.", when: /\b(safety|safe|ppe|clean\w*|organiz\w*)\b/ },
      { text: "Coordinated with coworkers during handoffs to keep packages, materials, or stock moving efficiently.", when: /\b(coworkers?|crew|team|handoffs?|shifts?)\b/ },
      { text: "Maintained attention to detail across repetitive, time-sensitive work.", when: /\b(accura\w*|checked|labels?|detail\w*|dates)\b/ }
    ],
    security: [
      { text: "Monitored site activity, access points, or visitor flow while following safety procedures.", when: /\b(monitor\w*|watch\w*|doors?|access|patrol\w*|surveillance|site)\b/ },
      { text: "Communicated calmly with visitors, staff, and supervisors during routine questions or tense situations.", when: /\b(visitors?|questions?|calm\w*|tense|upset|staff)\b/ },
      {
        text: operationsScope
          ? `Documented ${operationsScope.phrase} so handoffs stayed clear and accurate.`
          : "Documented incidents, observations, or shift notes so handoffs stayed clear and accurate.",
        when: /\b(incidents?|notes?|logs?|logged|wrote|report\w*|document\w*)\b/
      },
      { text: "Used judgment to escalate concerns while staying aligned with site policies.", when: /\b(escalat\w*|supervisors?|called|polic(?:y|ies)|procedures?)\b/ },
      { text: "Maintained reliable coverage and attention to detail across public-facing security responsibilities." }
    ],
    delivery: [
      {
        text: (() => {
          const parts = compact([
            /\b(orders?|names)\b/.test(corpus) ? "checking orders" : "",
            /\broutes?\b/.test(corpus) ? "planning routes" : "",
            /\b(handoffs?|right person|drop-?offs?)\b/.test(corpus) ? "completing customer handoffs" : ""
          ]);
          return parts.length >= 2 ? `Managed time-sensitive deliveries by ${sentenceList(parts)}.` : "";
        })(),
        when: /\b(deliver\w*|time-sensitive)\b/
      },
      { text: `Used delivery and navigation tools to coordinate deliveries and route decisions${toolPhrase}.`, when: /\b(apps?|navigation|gps)\b/ },
      { text: "Communicated delays, substitutions, or order issues so customers had clear updates.", when: /\b(delays?|substitutions?|messag\w*|updates?)\b/ },
      {
        text: (() => {
          const parts = compact([
            /\b(independent\w*|solo|on my own)\b/.test(corpus) ? "independent work" : "",
            /\b(accura\w*|checked|names|right person)\b/.test(corpus) ? "order accuracy" : "",
            /\b(customers?|riders?)\b/.test(corpus) ? "customer service" : ""
          ]);
          return parts.length >= 2 ? `Balanced ${sentenceList(parts)} across changing daily routes.` : "";
        })(),
        when: /\broutes?\b/
      },
      {
        text: (() => {
          const parts = compact([
            /\btraffic\b/.test(corpus) ? "traffic" : "",
            /\brestaurants?\b/.test(corpus) ? "restaurant delays" : "",
            /\b(timing|time-sensitive|on time)\b/.test(corpus) ? "delivery timing" : ""
          ]);
          return parts.length ? `Maintained reliable follow-through while handling ${sentenceList(parts)}.` : "";
        })(),
        when: /\b(traffic|restaurants?|timing|time-sensitive|on time)\b/
      }
    ],
    janitor: [
      { text: "Maintained clean, stocked, and safe spaces by completing routine cleaning and upkeep tasks.", when: /\b(clean\w*|mopp?\w*|sweep\w*|sanit\w*|upkeep)\b/ },
      { text: `Used cleaning supplies, equipment, or basic tools to support daily facility standards${toolPhrase}.`, when: /\b(supplies|equipment|tools?|mops?|chemicals?)\b/ },
      { text: "Reported broken fixtures, supply needs, or safety concerns so issues could be addressed.", when: /\b(report\w*|broken|fixtures?|supply|supplies|concerns?)\b/ },
      {
        text: (() => {
          const parts = compact([
            /\b(sanit\w*|clean\w*|mop\w*)\b/.test(corpus) ? "sanitation" : "",
            /\b(safety|safe|ppe)\b/.test(corpus) ? "safety" : ""
          ]);
          return parts.length ? `Followed ${parts.join(" and ")} procedures while moving through assigned areas consistently.` : "";
        })(),
        when: /\b(sanit\w*|clean\w*|safety|safe|ppe)\b/
      },
      { text: "Supported daily operations by keeping shared spaces ready for staff, customers, students, or visitors." }
    ],
    "food-service": [
      {
        text: customerScope
          ? `Prepared orders and assisted ${customerScope.phrase} while balancing speed, accuracy, and service quality.`
          : "Prepared orders and assisted guests while balancing speed, accuracy, and service quality.",
        when: /\b(orders?|drinks?|food|prepared?|customers?|guests?)\b/
      },
      {
        // Composed claim-by-claim: only evidenced activities are named.
        text: (() => {
          const parts = compact([
            /\b(registers?|pos|payments?|cash)\b/.test(corpus) ? "register use" : "",
            /\b(restock\w*|stock\w*|supplies)\b/.test(corpus) ? "restocking" : "",
            /\b(clean\w*|sanit\w*|wiped?)\b/.test(corpus) ? "cleaning" : ""
          ]);
          return parts.length ? `Followed shift procedures for ${sentenceList(parts)} within the food service flow${toolPhrase}.` : "";
        })(),
        when: /\b(registers?|pos|restock\w*|stock\w*|clean\w*|sanit\w*|payments?|cash)\b/
      },
      { text: "Kept work areas clean and organized while following sanitation expectations.", when: /\b(clean\w*|sanit\w*|wiped?|station)\b/ },
      { text: "Coordinated with coworkers during rushes to keep orders moving and reduce service delays.", when: /\b(coworkers?|team|kitchen|rush\w*|busy)\b/ },
      { text: "Handled customer questions or order issues with clear communication and steady follow-through.", when: /\b(questions?|issues?|complaints?|customers?|guests?)\b/ }
    ],
    caregiver: [
      { text: "Supported clients with daily routines while maintaining patience, safety awareness, and respect.", when: /\b(clients?|residents?|patients?|routines?|care)\b/ },
      { text: `Kept care notes, reminders, or schedule details organized${toolPhrase}.`, when: /\b(notes?|reminders?|schedul\w*|records?)\b/ },
      { text: "Communicated updates to families, supervisors, or care teams when routines or needs changed.", when: /\b(famil\w*|updates?|nurses?|supervisors?|texted|called)\b/ },
      { text: "Followed safety and care procedures while helping with meals, mobility, reminders, or light household tasks.", when: /\b(meals?|mobility|safety|reminders?|cleaning|household)\b/ },
      { text: "Built trust through consistent attendance, calm communication, and dependable follow-through.", when: /\b(trust|reliab\w*|showed up|on time|consistent\w*)\b/ }
    ],
    receptionist: [
      {
        text: customerScope
          ? `Managed ${customerScope.phrase} while welcoming visitors, answering questions, and routing requests.`
          : "Welcomed visitors or callers, answered questions, and routed requests to the right person or next step.",
        when: /\b(visitors?|callers?|calls?|greet\w*|questions?|routed?)\b/
      },
      { text: `Supported scheduling, records, and front desk communication${toolPhrase}.`, when: /\b(schedul\w*|appointments?|records?|front desk|calendars?)\b/ },
      { text: "Kept office details organized so appointments, messages, and handoffs stayed accurate.", when: /\b(appointments?|messages?|organiz\w*|records?)\b/ },
      { text: "Handled interruptions and competing requests while maintaining a professional front desk experience.", when: /\b(interruptions?|busy|competing|priorit\w*)\b/ },
      { text: "Protected reliability and attention to detail across daily administrative support tasks." }
    ],
    construction: [
      { text: "Moved materials, prepared work areas, and supported crews with hands-on job site tasks.", when: /\b(materials?|crews?|job sites?|carried|moved|set ?up)\b/ },
      { text: `Used tools, equipment, or PPE to complete assigned work safely and consistently${toolPhrase}.`, when: /\b(tools?|equipment|ppe|drills?|saws?)\b/ },
      { text: "Followed safety procedures while keeping work areas clean, organized, and ready for crews.", when: /\b(safety|safe|clean\w*|rules|directions)\b/ },
      {
        text: teamScope
          ? `Communicated issues, material needs, or next steps across a ${teamScope.phrase}.`
          : "Communicated issues, material needs, or next steps to coworkers, leads, or foremen.",
        when: /\b(foreman|foremen|leads?|crews?|coworkers?|reported)\b/
      },
      { text: "Supported steady job site progress through reliability, physical effort, and attention to task details." }
    ]
  };

  const canned = groundedBulletsByOccupation[occupation.id] ?? [];
  const grounded = canned.filter((bullet) => !bullet.when || bullet.when.test(corpus)).map((bullet) => bullet.text);
  // The user's own phrases always take priority; grounded canned bullets fill
  // in polished phrasing for evidence they actually gave.
  const combined = compact([...grounded, ...composeUserBullets(data, data.roleFamily)]);
  return qualityCheckBullets(combined, ["Assisted", "Handled", "Resolved", "Coordinated", "Maintained"]);
}

function buildOccupationSummary(data: IntakeData, target: string, experience: ExperienceRole[], occupation: OccupationProfile) {
  const corpus = buildGroundingCorpus(data);
  const currentRole = experience[0];
  const title = (currentRole?.title ?? cleanWhitespace(data.currentTitle)) || "Worker";
  const strengths = compact([
    ...data.customRoleTransferableSkills.map(normalizeResponsibility),
    ...data.customRoleWorkStyles.map(normalizeResponsibility),
    ...groundedOnly(occupation.transferables, corpus)
  ]).slice(0, 4);
  const responsibilities = buildResponsibilityList(data).map(readablePhrase).slice(0, 4);
  const aiPhrase = aiWorkflowPhrase(data);
  const handledClause = responsibilities.length ? `, handling ${sentenceList(responsibilities).toLowerCase()}` : "";
  const strengthSentence = strengths.length ? ` Strengths the candidate reports include ${sentenceList(strengths.map((item) => item.toLowerCase()))}.` : "";

  return limitSentences(
    `${title} with experience in a ${occupation.environment}${handledClause}.${strengthSentence} Now targeting ${target} roles.${aiPhrase ? ` Uses AI-assisted workflows for ${aiPhrase}.` : ""}`,
    4
  );
}

function buildOccupationLinkedInSummary(data: IntakeData, target: string, experience: ExperienceRole[], occupation: OccupationProfile) {
  const corpus = buildGroundingCorpus(data);
  const currentRole = experience[0];
  const title = (currentRole?.title ?? cleanWhitespace(data.currentTitle)) || "Worker";
  const strengths = compact([
    ...groundedOnly(occupation.transferables, corpus),
    ...buildResponsibilityList(data).map(readablePhrase)
  ]).slice(0, 4);
  const strengthClause = strengths.length ? `Brings ${sentenceList(strengths.map((item) => item.toLowerCase()))} into ` : "Moving into ";

  return limitSentences(
    `${title} with hands-on experience in a ${occupation.environment}. ${strengthClause}${targetRoleFamilyText(data, target)}.`,
    3
  );
}

function buildOccupationHeadline(data: IntakeData, occupation: OccupationProfile) {
  const corpus = buildGroundingCorpus(data);
  const parts = occupation.headline.split("|").map(cleanWhitespace).filter(Boolean);
  const background = parts[0] ?? occupation.headline;
  // Headline strength segments are claims too: only grounded ones survive,
  // with the role-family value area as neutral direction framing.
  const groundedParts = groundedOnly(parts.slice(1), corpus);
  const familyDirection =
    data.roleFamily === "Customer Success"
      ? "Customer Service"
      : data.roleFamily === "Admin"
        ? "Administrative Support"
        : data.roleFamily === "Operations"
          ? "Operations"
          : roleStrategies[data.roleFamily].valueArea;
  // Direction segment is guaranteed; grounded strengths fill the last slot.
  const segments = compact([background, familyDirection, ...groundedParts]).slice(0, 3);
  return segments.join(" | ");
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
  const corpus = buildGroundingCorpus(data);
  const fromEvidence = (evidenceStrengthLabels(data)
    .map((label) => labelMap.find(([pattern]) => pattern.test(label))?.[1])
    .filter(Boolean) as string[])
    // Evidence labels can themselves be derived; only grounded ones may
    // headline the candidate.
    .filter((label) => isGroundedClaim(label, corpus));
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

// Domain flavor bullets are composed claim-by-claim: every activity named in
// the sentence must be individually evidenced, and a bullet only renders when
// at least two grounded activities exist.
function specificEvidenceBullets(data: IntakeData) {
  const tools = buildToolList(data);
  const responsibilities = buildResponsibilityList(data).map(readablePhrase);
  const evidence = evidenceText(data).toLowerCase();
  const bullets: string[] = [];
  const groundedParts = (pairs: Array<[RegExp, string]>) => compact(pairs.map(([pattern, phrase]) => (pattern.test(evidence) ? phrase : "")));

  if (/doordash|door dash|delivery|courier|dasher/.test(evidence)) {
    const parts = groundedParts([
      [/orders?|names/, "verifying orders"],
      [/route/, "planning routes"],
      [/delay|messag|updat/, "communicating delays"],
      [/handoff|drop-?off|deliver/, "completing customer handoffs"]
    ]);
    if (parts.length >= 2) bullets.push(`Managed delivery flow by ${sentenceList(parts)}.`);
  } else if (/restaurant|food service|server|barista|kitchen/.test(evidence)) {
    const parts = groundedParts([
      [/orders?/, "handling orders"],
      [/restock|stock|suppl/, "restocking supplies"],
      [/kitchen/, "coordinating with kitchen staff"],
      [/upset|complaint|concern|issue|question/, "resolving concerns during busy periods"]
    ]);
    if (parts.length >= 2) bullets.push(`Supported guest service by ${sentenceList(parts)}.`);
  } else if (/warehouse|fulfillment|pallet/.test(evidence)) {
    const parts = groundedParts([
      [/scan/, "scanning items"],
      [/stock|mov(?:ed|ing)|load/, "moving stock"],
      [/label|check/, "checking labels"],
      [/inventory|handoff/, "keeping inventory handoffs organized"]
    ]);
    if (parts.length >= 2) bullets.push(`Maintained fulfillment flow by ${sentenceList(parts)}.`);
  } else if (/security|guard|access control|patrol/.test(evidence)) {
    const parts = groundedParts([
      [/monitor|watch|door|access|patrol/, "monitoring access points"],
      [/incident|note|report|log|wrote|document/, "documenting incidents"],
      [/procedure|polic|rule/, "following site procedures"],
      [/escalat|supervisor|called/, "escalating concerns when needed"]
    ]);
    if (parts.length >= 2) bullets.push(`Maintained safety coverage by ${sentenceList(parts)}.`);
  } else if (/retail|cashier|register|checkout/.test(evidence)) {
    const parts = groundedParts([
      [/question|customer|shopper|guest/, "handling customer questions"],
      [/register|checkout|pos|cash|payment/, "supporting register tasks"],
      [/stock|inventory|shelv/, "keeping inventory areas organized"],
      [/team|coworker|handoff/, "coordinating team handoffs"]
    ]);
    if (parts.length >= 2) bullets.push(`Supported store flow by ${sentenceList(parts)}.`);
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
      : `Served clients in a fast-paced beauty service environment.`,
    /repeat|regular|clientele|referral|relationship|older client|older customer|senior client/i.test(text)
      ? `Built relationships with ${audience} through clear communication, patience, and consistent service.`
      : "",
    /appointment|schedul|booking|walk-ins?|walk ins?/i.test(text)
      ? "Managed appointments, walk-ins, client preferences, and changing priorities in a fast-paced service environment."
      : "",
    ...composeUserBullets(data, data.roleFamily)
  ];

  return qualityCheckBullets(compact(bullets), ["Served", "Built", "Managed"]);
}

const verbLedPhrase =
  /^(handled|helped|managed|supported|answered|made|processed|prepared|cleaned|stocked|restocked|checked|planned|delivered|drove|built|created|tested|wrote|fixed|resolved|coordinated|organized|scheduled|tracked|documented|maintained|trained|coached|served|greeted|rang|counted|updated|assisted|picked|packed|scanned|loaded|unloaded|sorted|monitored|patrolled|escalated|followed|improved|reduced|increased|launched|shipped|booked|styled|repaired|operated|entered|filed|routed|explained|communicated|took|kept|used)\b/i;

function capitalizeSentence(value: string) {
  const cleaned = cleanWhitespace(value);
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "";
}

// Bullets composed strictly from what the user said: their own phrases, their
// numbers, their selected actions/outcomes, their tools. No template claims.
function composeUserBullets(data: IntakeData, roleFamily: RoleFamily) {
  const responsibilities = buildResponsibilityList(data);
  const verbLed = responsibilities.filter((item) => verbLedPhrase.test(item));
  const nounLed = responsibilities.filter((item) => !verbLedPhrase.test(item));
  const tools = buildToolList(data);
  const scopes = buildScopeItems(data);
  const outcome = buildOutcomeSupport(data);
  const selectedActions = compact(data.selectedActions.map((item) => cleanWhitespace(item))).filter((item) => !isWeakFreeText(item));
  const toolPhrase = chooseToolPhrase(tools, roleFamily, responsibilities[1] ?? responsibilities[0] ?? "");
  const bullets: string[] = [];

  if (verbLed.length) {
    const joined = sentenceList(verbLed.slice(0, 3).map(readablePhrase));
    // Skip the outcome clause when the phrases already state it (avoids
    // "improved compliance ... to support compliance").
    const outcomeClause = outcome && !joined.toLowerCase().includes(outcome.split(/\s+/)[0].toLowerCase()) ? ` to support ${outcome}` : "";
    bullets.push(capitalizeSentence(`${joined}${outcomeClause}.`));
  }
  if (nounLed.length) {
    // "Supported" is deliberately the weakest honest verb for noun-label
    // lists — family verbs like "Tested" would overstate what the user said.
    bullets.push(capitalizeSentence(`Supported ${sentenceList(nounLed.slice(0, 3).map(readablePhrase))}${toolPhrase}.`));
  }
  if (verbLed.length > 3) {
    bullets.push(capitalizeSentence(`${sentenceList(verbLed.slice(3, 6).map(readablePhrase))}.`));
  }
  const outcomeBullets = userOutcomeBullets(data);
  const scopeOne = scopeForBullet(scopes, ["customersServed", "ticketsHandled", "callsHandled"]);
  const scopeTwo = scopes.find((scope) => scope !== scopeOne);
  const scopeDigits = scopeOne?.phrase.match(/\$?\d[\d,.]*\+?/)?.[0] ?? "";
  // Skip the scope bullet when the user's own outcome sentence already
  // carries the same number (avoids near-duplicate claims).
  if (scopeOne && !(scopeDigits && outcomeBullets.some((bullet) => bullet.includes(scopeDigits)))) {
    bullets.push(capitalizeSentence(`Handled ${scopeOne.phrase}${scopeTwo ? ` and ${scopeTwo.phrase}` : ""} as part of regular workload.`));
  }
  if (selectedActions.length) {
    bullets.push(capitalizeSentence(`${sentenceList(selectedActions.map(readablePhrase))}.`));
  }
  bullets.push(...outcomeBullets);
  const aiBullet = aiWorkflowBullet(data);
  if (aiBullet) bullets.push(aiBullet);
  else if (!toolPhrase && tools.length) bullets.push(`Used ${sentenceList(tools.slice(0, 3))} in day-to-day work.`);

  return bullets;
}

function buildExperienceBullets(data: IntakeData, role: ExperienceRole, roleIndex: number) {
  // Earlier roles carry no per-role evidence in this intake model; emitting
  // role-family template bullets for them fabricates history, so they render
  // as title/company/dates only.
  if (roleIndex > 0) return [];

  const verbs = roleStrategies[data.roleFamily].verbs;
  const domain = detectDomain(role) ?? fallbackDomainProfile(data);

  if (domain?.name === "product-builder") {
    const corpus = buildGroundingCorpus(data);
    const scopes = buildScopeItems(data);
    const tools = buildToolList(data);
    const projectScope = scopeForBullet(scopes, ["projectsSupported", "reportsCreated"]);
    const canned: GroundedBullet[] = [
      {
        text: projectScope
          ? `Planned features, wrote product copy, and documented issues across ${projectScope.phrase}.`
          : "Planned features, wrote product copy, and documented issues across hands-on product work.",
        when: /\b(features?|copy|copywriting|document\w*|issues?|plann\w*|notes?)\b/
      },
      { text: "Tested mobile layouts and broken states before shipping usable demos and website updates.", when: /\b(test\w*|mobile|demos?|broken|qa|bugs?)\b/ },
      {
        text: tools.length ? `Used ${sentenceList(tools.slice(0, 3))} to support product documentation, implementation, and launch follow-through.` : "",
        when: /\b(launch\w*|shipp\w*|deploy\w*|document\w*|built)\b/
      }
    ];
    const grounded = canned.filter((bullet) => bullet.text && (!bullet.when || bullet.when.test(corpus))).map((bullet) => bullet.text);
    return qualityCheckBullets(compact([...grounded, ...composeUserBullets(data, data.roleFamily)]), verbs);
  }

  const occupation = detectOccupationProfile(data, role);
  if (occupation) {
    return buildOccupationBullets(data, role, occupation);
  }

  if (isBeautyServiceProfile(data, role)) {
    return buildBeautyServiceBullets(data);
  }

  return qualityCheckBullets(compact([...composeUserBullets(data, data.roleFamily), ...specificEvidenceBullets(data)]), verbs);
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
      // "I don't remember exactly" is uncertainty, not a printable date range.
      time: isWeakFreeText(role.time) || isUncertaintyStatement(role.time) ? "Dates" : cleanWhitespace(role.time) || "Dates",
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
  const corpus = buildGroundingCorpus(data);
  const background = currentRole
    ? `${currentRole.title} with experience in ${domain?.environment ?? strategy.environment}`
    : `Early-career professional with ${roleFamily.toLowerCase()} experience`;
  // Domain/family strengths are template taxonomy: grounded entries only. The
  // user's own responsibilities always qualify.
  const strengths = compact([
    ...groundedOnly(domain?.strengths ?? [], corpus),
    ...responsibilities.map(readablePhrase),
    ...groundedOnly(strategy.focus, corpus).map(readablePhrase),
    ...buildToolList(data)
  ]).slice(0, 3);
  const aiPhrase = aiWorkflowPhrase(data);
  const direction = `${target} roles`;
  const strengthClause = strengths.length ? `Brings ${sentenceList(strengths)}` : "Brings hands-on work experience";

  return limitSentences(
    `${background}. ${strengthClause}${aiPhrase ? ` while using AI-assisted workflows for ${aiPhrase}` : ""} with a transition focus toward ${direction}.`,
    3
  );
}

function buildLinkedInSummary(data: IntakeData, target: string, experience: ExperienceRole[]) {
  const currentRole = experience[0];
  const domain = currentRole ? detectDomain(currentRole) ?? fallbackDomainProfile(data) : fallbackDomainProfile(data);
  const occupation = currentRole ? detectOccupationProfile(data, currentRole) : detectOccupationProfile(data);
  const strategy = roleStrategies[data.roleFamily];
  const corpus = buildGroundingCorpus(data);
  const responsibilities = buildResponsibilityList(data).slice(0, 3).map(readablePhrase);
  const strengths = compact([
    ...groundedOnly(domain?.strengths ?? [], corpus),
    ...responsibilities,
    ...groundedOnly(strategy.focus, corpus).map(readablePhrase),
    ...buildToolList(data)
  ]).slice(0, 3);
  const environment = domain?.environment ?? strategy.environment;
  if (occupation) {
    return buildOccupationLinkedInSummary(data, target, experience, occupation);
  }
  if (currentRole && isBeautyServiceProfile(data, currentRole)) {
    const volume = serviceVolume(data);
    const volumePhrase = volume ? ` ${volume},` : "";
    const beautyStrengths = compact([
      /repeat|regular|clientele|referral/i.test(evidenceText(data)) ? "repeat client relationships" : "",
      /schedul|appointment|booking/i.test(evidenceText(data)) ? "scheduling" : "",
      "clear communication"
    ]);
    return limitSentences(
      `${currentRole.title} with hands-on client service experience in a beauty and appointment-based environment. Brings${volumePhrase} ${sentenceList(beautyStrengths)} into ${targetRoleFamilyText(data, target)}.`,
      3
    );
  }
  // One honest template for every lane: background + grounded strengths only,
  // no invented working-style claims.
  const strengthText = strengths.length ? sentenceList(strengths) : "hands-on work experience";
  const aiPhrase = aiWorkflowPhrase(data);
  const aiSentence = aiPhrase ? ` Uses AI-assisted workflows for ${aiPhrase}.` : "";

  return limitSentences(`${target} candidate with hands-on experience in ${environment}. Strongest reported areas include ${strengthText}.${aiSentence}`, 3);
}

function buildHeadline(data: IntakeData, target: string, skills: string[], experience: ExperienceRole[]) {
  const background = cleanWhitespace(experience[0]?.title ?? "") || cleanWhitespace(data.currentTitle) || "Career Switcher";
  const occupation = experience[0] ? detectOccupationProfile(data, experience[0]) : detectOccupationProfile(data);
  if (occupation) {
    return buildOccupationHeadline(data, occupation);
  }
  const strengths = headlineStrengths(data, skills);
  const direction = directionLabel(data, target);
  // Same-title moves would otherwise read "CSM | CSM | ..." — collapse
  // duplicate segments.
  const lead = background.toLowerCase() === direction.toLowerCase() ? [background] : [background, direction];
  const headline = `${lead.join(" | ")} | ${strengths.join(", ") || roleStrategies[data.roleFamily].valueArea}`;
  return headline.length > 115 ? `${lead.join(" | ")} | ${strengths.slice(0, 2).join(", ")}` : headline;
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

  // Belt-and-braces: no termination reason may survive into any narrative
  // surface, even if it slipped through a free-text field.
  const withGuards = (resume: ResumePackage): ResumePackage => ({
    ...resume,
    summary: stripTerminationReasons(resume.summary).text,
    linkedinSummary: stripTerminationReasons(resume.linkedinSummary).text,
    linkedinHeadline: stripTerminationReasons(resume.linkedinHeadline).text,
    experience: resume.experience.map((role) => ({
      ...role,
      bullets: role.bullets.map((bullet) => stripTerminationReasons(bullet).text).filter(Boolean)
    }))
  });

  return polishResumePackage(withGuards(qualityCheckResume({
    summary: buildSummary(data, target, experience),
    coreSkills: skills,
    experience,
    education,
    linkedinHeadline: buildHeadline(data, target, skills, experience),
    linkedinSummary: buildLinkedInSummary(data, target, experience)
  })));
}
