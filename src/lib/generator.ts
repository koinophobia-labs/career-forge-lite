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

/**
 * Grounding evidence that describes the WORK, with job titles and employer
 * names removed. A title says who someone was called, not what they did, so it
 * must not authorise an activity claim — see buildResponsibilityList.
 */
export function buildActivityCorpus(data: IntakeData) {
  return [
    // data.tools is deliberately ABSENT. Naming a tool says what was in reach,
    // not what was done with it: "POS Systems, Cash Drawer" was grounding
    // "Processed payments" and the skill "Cash Handling" for a user who never
    // described handling payments. Tools still reach output as tool phrases
    // ("… using X") and the Tools section, which is what naming one supports.
    data.responsibilities,
    data.outcomes,
    data.customRoleNotes,
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
  // Situation words (conflict, upset customers, tense moments) may ground
  // resolution claims, but never the de-escalation ACTION — being near tense
  // moments is not performing de-escalation, so that stem only grounds when
  // the user described de-escalating or defusing themselves (RA-P0-03).
  ["conflict", "upset", "angry", "complaint", "calm", "tense", "resolut", "resolv", "frustrat"],
  ["de-escalat", "deescalat", "defus"],
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
  // "We were busy" describes the ENVIRONMENT; it does not evidence that the
  // candidate managed time. Only evidence about their own time performance
  // authorises the competency.
  ["time management", /\b(deadlines?|on time|prioriti\w*|multitask\w*|juggl\w*|time management|scheduled around)\b/],
  // A room is not a team: "kitchen" was grounding Team Coordination for a
  // user who described cleaning it alone. People words only.
  ["team coordination", /\b(teams?|coworkers?|crews?|staff|colleagues?|handoffs?)\b/],
  // Performing a checking TASK ("checked labels") is not the same claim as
  // possessing the QUALITY. This is the same over-claim as the ungated canned
  // bullets that asserted "attention to detail" and were removed; the label
  // now needs language about the quality itself or about errors actually caught.
  ["attention to detail", /\b(attention to detail|double-?check\w*|meticulous\w*|careful\w*|caught (?:errors?|mistakes?|discrepanc\w*)|mismatch\w*)\b/],
  ["order accuracy", /\b(orders?|accuracy|accurate)\b/],
  ["problem solving", /\b(problems?|issues?|resolved?|fixed|solved?|troubleshoot|troubleshot)\b/],
  ["patient support", /\b(patients?|residents?|clients?|care)\b/],
  // "The dock always felt safe" describes how a place felt, not that the
  // candidate followed safety procedures. The bare adjective is out.
  ["safety procedures", /\b(safety|ppe|osha|sanitation)\b/],
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
  // No ["it", "IT"]. "it" is an ordinary pronoun far more often than an
  // acronym, and the rule rewrote the user's sentence: "Checked every shipment
  // before it left the dock" rendered as "…before IT left the dock".
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
  // Free text the user typed: preserve their casing. titleCase() lowercases the
  // whole string before re-capitalizing each word, which destroys every
  // interior capital — "Walla Walla" -> "Walla Walla" only by luck, while
  // "DeKalb" -> "Dekalb", "McDonald's" -> "Mcdonald's", "O'Hare" -> "O'hare"
  // and "Coca-Cola" -> "Coca-cola". Those are falsified proper nouns, and they
  // survived persistence and export. titleCase stays confined to taxonomy
  // labels, where the input is a known short phrase rather than prose.
  return cleanWhitespace(value)
    .replace(/\bcrm\b/gi, "CRM")
    .replace(/\bsop\b/gi, "SOP")
    .replace(/\bkpi\b/gi, "KPI");
}

function readablePhrase(value: string) {
  return value
    .split(" ")
    .map((word) => acronyms.get(word.toLowerCase()) ?? word.toLowerCase())
    .join(" ");
}

/**
 * Case-preserving counterpart of readablePhrase, for text the USER wrote.
 *
 * readablePhrase lowercases every word that is not a known acronym. That is
 * correct for taxonomy and template LABELS ("Team Coordination" -> "team
 * coordination" reads properly mid-sentence), and destructive for user prose:
 * "Supported the Walla Walla distribution center." came back as "…the walla
 * walla distribution center.", a falsified place name that then survived JSON
 * persistence and plain-text export.
 *
 * Acronyms are still normalized, because that is a spelling fix rather than a
 * meaning change. Nothing else is touched — readablePhrase must stay confined
 * to labels.
 */
/**
 * Lowercase only the LEADING character, for embedding a user's sentence inside
 * a larger one ("…, handling supported the Walla Walla distribution center").
 * A blanket .toLowerCase() on the joined clause was falsifying every proper
 * noun the user wrote, and the corruption reached the printed résumé.
 * Left untouched when the first word is an acronym or already all-caps.
 */
function midSentence(value: string) {
  const first = value.split(" ")[0] ?? "";
  if (!first || first === first.toUpperCase()) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function readableUserPhrase(value: string) {
  return value
    .split(" ")
    .map((word) => acronyms.get(word.toLowerCase()) ?? word)
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
  // Split on sentence boundaries ONLY. Splitting on "," and "and" tore compound
  // objects apart — "Logged calls from O'Fallon and DeSoto." became a bullet
  // plus the fabricated fragment "Supported DeSoto." A sentence the user wrote
  // is one claim and stays one claim.
  return text
    .split(/\n|;|(?<=[.!?])\s+/)
    .map((item) => cleanWhitespace(item).replace(/[.!?]+$/, "").replace(/^(i|we)\s+(also\s+)?/i, "").replace(/^(and|or|plus|also)\s+/i, ""))
    .filter((item) => item.length > 2 && !isWeakFreeText(item) && !isUncertaintyStatement(item))
    .filter((item) => !/^(worked|was|am|is|work)\s+(at|in|for|as)\b/i.test(item));
    // The narration filter that used to sit here DELETED any sentence mentioning
    // "my manager", "they", "me" and so on. It destroyed true statements —
    // "Reported to my manager and the shift lead." vanished from every surface —
    // while the leftover token "manager" separately authorised an unrelated
    // canned claim. Narration is the user's own wording and is kept.
}

// Extraction artifacts ("Clients About What They Wanted") read as narration,
// not responsibilities; they are dropped rather than templated. Only
// title-cased heading fragments match: a sentence the user actually wrote is
// sentence-cased and is a claim, not an artifact — "It was my job to
// reconcile the drawer." and "They told me to cover the front desk." must
// survive verbatim (RA-P0-03).
function looksLikeNarrationFragment(item: string) {
  if (!/\b(they|them|about what|it was|i was)\b/i.test(item)) return false;
  const words = item.split(/\s+/).filter((word) => /[a-z]/i.test(word));
  if (words.length < 3) return true;
  const capitalized = words.filter((word) => /^[A-Z]/.test(word));
  return capitalized.length >= Math.ceil(words.length * 0.8);
}

function buildUserResponsibilityList(data: IntakeData) {
  return compact([
    ...data.selectedIndependentWorkSignals.map(normalizeResponsibility),
    ...data.customRoleTransferableSkills.map(normalizeResponsibility),
    ...data.customRoleWorkStyles.map(normalizeResponsibility),
    ...data.selectedResponsibilities.map(normalizeResponsibility),
    // customRoleIndustry is deliberately absent: an industry chip ("Retail")
    // names a sector, not a duty — rendering it as a responsibility produced
    // fused fake bullets like "Supported Escalation handling, Retail, and the
    // shift lead."
    ...splitResponsibilityText(data.responsibilities).map(normalizeResponsibility)
  ])
    .filter((item) => !looksLikeNarrationFragment(item))
    .slice(0, 10);
}

function buildResponsibilityList(data: IntakeData) {
  const userResponsibilities = buildUserResponsibilityList(data);
  const occupation = detectOccupationProfile(data);
  if (occupation) {
    // Occupation taxonomy survives ONLY where the user's own words evidence it,
    // and a JOB TITLE is not such a word. Grounding against the full corpus let
    // the title do the work: "Custodian" grounded the task claim "sanitation"
    // through an alias group, so a user who typed nothing still got
    // "Supported sanitation." on their résumé. A title states identity; only a
    // description of the work states activity.
    const corpus = buildActivityCorpus(data);
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
  // Activity corpus: a SKILL is a claim about the candidate, so it must be
  // evidenced by what they described doing. Against the full corpus the
  // employer name did the work — "Corner Kitchen" grounded "Team Coordination"
  // and "Brightpath Care" grounded "Patient Support", both then printed under
  // "Strengths the candidate reports include…" when the candidate had reported
  // nothing at all.
  const corpus = buildActivityCorpus(data);
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

type GroundedBullet = { text: string; when?: RegExp; evidence?: RegExp[] };

/**
 * A bullet assembled clause by clause, where every clause must be evidenced by
 * the user's own words before it appears.
 *
 * The occupation bank previously held fixed multi-claim sentences behind a
 * single-token gate: the word "customers" alone emitted "Assisted customers
 * with purchases, returns, and questions while keeping transactions accurate",
 * asserting four activities from one. One evidenced token may authorise exactly
 * one clause about that token, and nothing else.
 *
 * `clauses` are [evidence, phrase] pairs. `min` is how many must match before
 * the sentence is worth emitting at all — below it the bullet is dropped, and
 * the missing clauses become material for a targeted question instead of
 * silently becoming résumé content.
 */

const THIRD_PARTY_DETERMINER = /^(?:the|a|an|our|their|his|her|its|this|that|these|those|every|each)$/i;

// Irregular leads a suffix rule cannot stem.
const LEAD_STEM_OVERRIDES = new Map<string, string>([
  ["kept", "keep|kept"], ["held", "hold|held"], ["led", "lead|led"], ["built", "build|built"],
  ["ran", "run|ran"], ["made", "make|made"], ["took", "take|took"], ["drove", "drive|drove"],
  ["sent", "send|sent"], ["met", "meet|met"], ["set", "set"], ["put", "put"],
]);

/**
 * True when the corpus evidences the ACT named by a composed bullet's lead verb.
 * Derived from the lead's own first word so every call site is covered without
 * each one restating its verb.
 */
function leadIsEvidenced(corpus: string, lead: string): boolean {
  const first = (lead.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!first) return true;
  const override = LEAD_STEM_OVERRIDES.get(first);
  const stem = override ?? first.replace(/(?:ed|d)$/, "");
  if (stem.length < 3) return true;
  const occurrence = new RegExp(`\\b(?:${stem})\\w*`, "gi");
  let hit: RegExpExecArray | null;
  while ((hit = occurrence.exec(corpus)) !== null) {
    // The act has to be the CANDIDATE'S. "The facility keeps care notes"
    // evidences the word "keeps" but attributes it to the employer, so it is no
    // licence for the résumé to claim "Kept care notes." A third-party subject
    // immediately before the verb disqualifies that occurrence.
    const preceding = corpus.slice(0, hit.index).trimEnd().split(/\s+/).slice(-2);
    const thirdParty = preceding.length === 2 && THIRD_PARTY_DETERMINER.test(preceding[0] ?? "");
    if (!thirdParty) return true;
  }
  return false;
}

function composed(
  corpus: string,
  lead: string,
  clauses: Array<[RegExp, string]>,
  options: { min?: number; tail?: string } = {}
): GroundedBullet {
  const matched = clauses.filter(([evidence]) => evidence.test(corpus)).map(([, phrase]) => phrase);
  const min = options.min ?? 1;
  if (matched.length < min) return { text: "" };
  // The LEAD carries a claim too. Gating only the clauses meant "Maintained the
  // safety log" emitted "Reported safety concerns." — a correctly grounded
  // clause bolted to a verb the user never used. A gated clause attached to an
  // invented verb is still fabrication, so the lead must be evidenced as well.
  if (!leadIsEvidenced(corpus, lead)) return { text: "" };
  // `concepts` records exactly what this bullet claims, so a later pass can tell
  // whether it restates the user or adds something.
  const evidence = clauses.filter(([test]) => test.test(corpus)).map(([test]) => test);
  return { text: `${lead} ${sentenceList(matched)}${options.tail ?? ""}.`.replace(/\s+/g, " "), evidence };
}


function buildOccupationBullets(data: IntakeData, role: ExperienceRole, occupation: OccupationProfile) {
  // Activity corpus, not the full grounding corpus: a clause about what the
  // candidate DID must be evidenced by a description of the work, never by the
  // job title or the employer's name. Grounding these gates against the full
  // corpus meant the title "Line Cook" authorised "preparing food" and the
  // employer "Corner Kitchen" authorised a coworkers claim, so a user who typed
  // nothing still received two factual bullets.
  const corpus = buildActivityCorpus(data);
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
      composed(corpus, `Served ${customerScope ? customerScope.phrase : "guests"} by`, [
        [/\bdrinks?\b|\bcocktails?\b|\bpour\w*|\bmixed\b/, "preparing drinks"],
        [/\borders?\b|\btabs?\b/, "taking orders"],
        [/\bbusy\b|\brush\w*|\bhigh-?volume\b|\bpeak\b/, "keeping pace during high-volume periods"]
      ]),
      composed(corpus, "Handled", [
        [/\bpayments?\b|\bcards?\b/, "payments"],
        [/\bcash\b/, "cash"],
        [/\btabs?\b/, "tabs"],
        [/\bregisters?\b|\bpos\b|\bcheckout\b/, "register transactions"]
      ], { tail: toolPhrase }),
      composed(corpus, "Resolved guest concerns using", [
        [/\bcalm\w*|\bde-?escalat\w*/, "calm communication"],
        [/\bpolic(?:y|ies)\b|\bids?\b|\brules?\b/, "policy-aware judgment"]
      ]),
      { text: "Coordinated with coworkers during service.", when: /\b(coworkers?|team|handoffs?)\b/ },
      composed(corpus, "Kept work areas", [
        [/\bclean\w*|\bsanit\w*|\bwiped?\b/, "clean"],
        [/\bstock\w*|\brestock\w*/, "stocked"],
        [/\borganiz\w*/, "organized"]
      ])
    ],
    retail: [
      // Each clause's evidence names the SAME concept as its phrase. A loose
      // synonym ("helped" licensing "questions") is how one typed word turns
      // into a specific activity the user never described.
      composed(corpus, `Assisted ${customerScope ? customerScope.phrase : "customers"} with`, [
        [/\bpurchase\w*|\bsales?\b|\bbought\b|\bbuying\b/, "purchases"],
        // "returns" and "refunds" are different activities: a user who wrote
        // "Handled customer complaints and refunds." never described returns.
        [/\breturns?\b|\bexchang\w*/, "returns"],
        [/\brefund\w*/, "refunds"],
        [/\bquestions?\b|\basked\b|\binquir\w*/, "questions"],
        [/\bfind\w*|\blocat\w*|\bproducts?\b|\bmerchandis\w*/, "locating products"]
      ]),
      composed(corpus, "Processed", [
        [/\bcheckout|\bregisters?\b|\brang\b/, "checkout activity"],
        [/\bcash\b|\bpayments?\b|\bpos\b|\bcards?\b/, "payments"]
      ], { tail: toolPhrase }),
      composed(corpus, "Kept the sales floor stocked by", [
        [/\brestock\w*|\bstock\w*/, "restocking merchandise"],
        [/\bdisplays?\b|\bpresentation|\bfacing|\bmerchandis\w*/, "maintaining store presentation"],
        [/\binventory\b|\bshelves\b|\bshelf\b|\bbackroom\b/, "organizing inventory areas"]
      ]),
      // The gate names the ACTION only. "my manager" says who was nearby, not
      // that anything was escalated; "de-escalated" is the opposite action and
      // must not match through the hyphen boundary.
      { text: "Escalated customer issues to leads or managers.", when: /(?<!de[\s-])\bescalat\w*/i },
      composed(corpus, "Balanced", [
        [/\bregisters?\b|\baccura\w*/, "register accuracy"],
        [/\bcustomers?\b|\bservice\b/, "customer service"],
        [/\bshifts?\b|\bbusy\b|\brush\w*/, "shift responsibilities during busy periods"]
      ], { min: 2 })
    ],
    warehouse: [
      composed(corpus, `Handled ${operationsScope ? operationsScope.phrase : "orders"} by`, [
        [/\bpick\w*/, "picking"],
        [/\bpack\w*/, "packing"],
        [/\bscan\w*/, "scanning"],
        [/\bmoved\b|\bloading\b|\bloaded\b|\bunloaded\b|\bsort\w*/, "moving stock"]
      ]),
      composed(corpus, "Used", [
        [/\bscanners?\b/, "handheld scanners"],
        [/\bforklifts?\b|\bpallet ?jacks?\b/, "powered equipment"],
        [/\bpallets?\b|\bcarts?\b/, "pallets and carts"]
      ], { tail: toolPhrase }),
      composed(corpus, "Followed", [
        [/\bsafety\b|\bsafe\b|\bppe\b/, "safety procedures"],
        [/\bclean\w*|\borganiz\w*/, "housekeeping standards"]
      ]),
      { text: "Coordinated with coworkers during shift handoffs.", when: /\b(coworkers?|crew|team|handoffs?|shifts?)\b/ },
      composed(corpus, "Checked", [
        [/\blabels?\b|\bbarcodes?\b/, "labels"],
        [/\bdates\b|\bexpir\w*/, "dates"],
        [/\bcounts?\b|\bquantit\w*|\baccura\w*/, "counts"]
      ])
    ],
    security: [
      composed(corpus, "Monitored", [
        [/\bpatrol\w*|\brounds?\b|\bperimeter\b|\bwalked\b/, "site activity"],
        [/\bdoors?\b|\baccess\b|\bbadges?\b|\bentry\b/, "access points"],
        [/\bvisitors?\b|\bguests?\b|\bsign-?in\b/, "visitor flow"],
        [/\bcameras?\b|\bsurveillance\b|\bmonitors?\b/, "camera feeds"]
      ]),
      composed(corpus, "Communicated with", [
        [/\bvisitors?\b|\bguests?\b/, "visitors"],
        [/\bstaff\b|\bemployees?\b|\btenants?\b/, "staff"],
        [/\bsupervisors?\b|\bmanagers?\b|\bdispatch\b/, "supervisors"]
      ]),
      composed(corpus, `Documented ${operationsScope ? operationsScope.phrase : "shift activity"} including`, [
        [/\bincidents?\b/, "incidents"],
        [/\bobservations?\b|\bnoticed\b/, "observations"],
        [/\bnotes?\b|\blogs?\b|\blogged\b|\bwrote\b|\breport\w*/, "shift notes"]
      ]),
      // Same rule: only escalation language grounds an escalation claim.
      // "called" (phoning anyone) and "policies" (existing) did not.
      { text: "Escalated concerns in line with site policies.", when: /(?<!de[\s-])\bescalat\w*/i },
      // (ungated canned bullet removed: it asserted reliability / attention to
      // detail with nothing in the user's corpus behind it, and could be the ONLY
      // experience bullet on the résumé. A role with nothing grounded renders
      // heading-only instead.)
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
      composed(corpus, "Used", [
        [/\bapps?\b|\bplatforms?\b/, "delivery apps"],
        [/\bnavigation\b|\bgps\b|\bmaps?\b/, "navigation tools"]
      ], { tail: toolPhrase }),
      composed(corpus, "Communicated", [
        [/\bdelays?\b|\blate\b|\btraffic\b/, "delays"],
        [/\bsubstitutions?\b|\bout of stock\b|\bunavailable\b/, "substitutions"],
        [/\bissues?\b|\bproblems?\b|\bwrong\b/, "order issues"]
      ]),
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
      composed(corpus, "Maintained assigned spaces by", [
        [/\bclean\w*|\bmopp?\w*|\bsweep\w*|\bvacuum\w*/, "cleaning"],
        [/\bstock\w*|\brestock\w*|\bsupplies\b/, "restocking supplies"],
        [/\bsanit\w*|\bdisinfect\w*/, "sanitizing"],
        [/\bupkeep\b|\brepairs?\b|\bmaintenance\b/, "routine upkeep"]
      ]),
      composed(corpus, "Used", [
        [/\bsupplies\b|\bchemicals?\b/, "cleaning supplies"],
        [/\bequipment\b|\bmachines?\b|\bbuffers?\b/, "equipment"],
        [/\bmops?\b|\btools?\b|\bcarts?\b/, "basic tools"]
      ], { tail: toolPhrase }),
      composed(corpus, "Reported", [
        [/\bbroken\b|\bfixtures?\b|\bdamage\w*/, "broken fixtures"],
        [/\bsupply\b|\bsupplies\b|\breorder\w*/, "supply needs"],
        [/\bsafety\b|\bhazards?\b|\bconcerns?\b/, "safety concerns"]
      ]),
      composed(corpus, "Followed", [
        [/\bsanit\w*|\bclean\w*|\bmop\w*/, "sanitation procedures"],
        [/\bsafety\b|\bsafe\b|\bppe\b/, "safety procedures"]
      ]),
    ],
    "food-service": [
      composed(corpus, `Served ${customerScope ? customerScope.phrase : "guests"} by`, [
        [/\borders?\b|\bprepared?\b|\bmade\b/, "preparing orders"],
        [/\bdrinks?\b|\bcoffee\b|\bbeverages?\b/, "making drinks"],
        [/\bfood\b|\bcook\w*|\bgrill\w*|\bfr(?:y|ied|ying)\b/, "preparing food"],
        [/\bbusy\b|\brush\w*|\bpeak\b|\bfast\b/, "keeping pace during rushes"]
      ]),
      composed(corpus, "Followed shift procedures for", [
        [/\bregisters?\b|\bpos\b|\bpayments?\b|\bcash\b/, "register use"],
        [/\brestock\w*|\bstock\w*|\bsupplies\b/, "restocking"],
        [/\bclean\w*|\bsanit\w*|\bwiped?\b/, "cleaning"]
      ], { tail: toolPhrase }),
      composed(corpus, "Kept work areas", [
        [/\bclean\w*|\bwiped?\b/, "clean"],
        [/\borganiz\w*|\bstation\b|\bstocked\b/, "organized"]
      ]),
      // "kitchen" is a room, not collaboration: "Scrubbed the kitchen floors
      // after close." described solo work and was grounding a two-claim
      // coordination bullet. The gate names people, not places.
      { text: "Coordinated with coworkers to keep orders moving.", when: /\b(coworkers?|teammates?|team|crew|servers?|expo)\b/ },
      composed(corpus, "Handled", [
        [/\bquestions?\b|\basked\b/, "customer questions"],
        [/\bissues?\b|\bcomplaints?\b|\bwrong\b|\bremade?\b/, "order issues"]
      ])
    ],
    caregiver: [
      composed(corpus, "Supported clients with", [
        [/\broutines?\b|\bdaily\b|\bschedules?\b/, "daily routines"],
        [/\bbath\w*|\bdress\w*|\bgroom\w*|\bhygiene\b|\btoilet\w*/, "personal care"],
        [/\bmeals?\b|\bfeed\w*|\bcook\w*/, "meals"],
        [/\bmobility\b|\btransfers?\b|\bwalk\w*|\bwheelchairs?\b/, "mobility"]
      ]),
      composed(corpus, "Kept", [
        [/\bnotes?\b|\bcharts?\b|\brecords?\b/, "care notes"],
        [/\breminders?\b|\bmedications?\b|\bmeds\b/, "reminders"],
        [/\bschedul\w*|\bappointments?\b/, "schedule details"]
      ], { tail: toolPhrase }),
      composed(corpus, "Communicated updates to", [
        [/\bfamil\w*|\brelatives?\b/, "families"],
        [/\bsupervisors?\b|\bmanagers?\b|\bagency\b/, "supervisors"],
        [/\bnurses?\b|\bcare teams?\b|\bdoctors?\b/, "care teams"]
      ]),
      composed(corpus, "Followed", [
        [/\bsafety\b|\bsafe\b|\bfalls?\b/, "safety procedures"],
        [/\bcare plans?\b|\bprocedures?\b|\bprotocols?\b/, "care procedures"]
      ]),
      composed(corpus, "Built trust through", [
        [/\battendance\b|\bshowed up\b|\bon time\b|\bpunctual\w*/, "consistent attendance"],
        [/\bcalm\w*|\bpatien\w*/, "calm communication"],
        [/\breliab\w*|\bdependab\w*|\bconsistent\w*|\bfollow-?through\b/, "dependable follow-through"]
      ], { min: 2 })
    ],
    receptionist: [
      composed(corpus, `Handled ${customerScope ? customerScope.phrase : "front desk traffic"} by`, [
        [/\bvisitors?\b|\bgreet\w*|\bwelcom\w*|\bsign-?in\b/, "welcoming visitors"],
        [/\bcalls?\b|\bcallers?\b|\bphones?\b/, "answering calls"],
        [/\bquestions?\b|\binquir\w*/, "answering questions"],
        [/\brouted?\b|\brouting\b|\btransferr\w*|\bdirected\b/, "routing requests"]
      ]),
      composed(corpus, "Supported", [
        [/\bschedul\w*|\bappointments?\b|\bcalendars?\b|\bbooking\w*/, "scheduling"],
        [/\brecords?\b|\bfiles?\b|\bfiling\b|\bdata entry\b/, "records"],
        [/\bemails?\b|\bmessages?\b|\bmail\b|\bcorrespondence\b/, "front desk communication"]
      ], { tail: toolPhrase }),
      composed(corpus, "Kept", [
        [/\bappointments?\b|\bschedul\w*/, "appointments"],
        [/\bmessages?\b|\bvoicemail\w*/, "messages"],
        [/\bhandoffs?\b|\borganiz\w*|\brecords?\b/, "handoffs"]
      ]),
      { text: "Handled interruptions and competing requests.", when: /\b(interruptions?|competing|priorit\w*)\b/ },
    ],
    construction: [
      composed(corpus, "Supported job site work by", [
        [/\bmaterials?\b|\bcarried\b|\bmoved\b|\bhauled\b|\bloaded\b/, "moving materials"],
        [/\bset ?up\b|\bprepar\w*|\bstaging\b|\bclear\w*/, "preparing work areas"],
        [/\bcrews?\b|\bteams?\b|\bhelped\b/, "assisting crews"]
      ]),
      composed(corpus, "Used", [
        [/\btools?\b|\bdrills?\b|\bsaws?\b|\bhammers?\b/, "hand and power tools"],
        [/\bequipment\b|\bmachines?\b|\blifts?\b/, "equipment"],
        [/\bppe\b|\bhard ?hats?\b|\bharness\w*|\bgoggles?\b/, "PPE"]
      ], { tail: toolPhrase }),
      composed(corpus, "Followed", [
        [/\bsafety\b|\bsafe\b|\bosha\b/, "safety procedures"],
        [/\bclean\w*|\borganiz\w*|\bswept\b/, "site housekeeping standards"]
      ]),
      composed(corpus, `Communicated with ${teamScope ? teamScope.phrase : "coworkers, leads, or foremen"} about`, [
        [/\bissues?\b|\bproblems?\b|\bdelays?\b/, "issues"],
        [/\bmaterials?\b|\bsupplies\b|\border\w*/, "material needs"],
        [/\bnext steps?\b|\bschedul\w*|\bsequence\b|\bplans?\b/, "next steps"]
      ]),
    ]
  };

  const canned = groundedBulletsByOccupation[occupation.id] ?? [];
  const grounded = canned.filter((bullet) => !bullet.when || bullet.when.test(corpus));
  // The user's own phrasing LEADS and is never displaced by occupation
  // vocabulary — the comment here used to say this while the code put the
  // canned bullets first, so a sparse line like "carried lumber" was replaced
  // by "Supported job site work by moving materials." Occupation bullets are
  // additive: they may say something the user's own lines do not, never
  // paraphrase away something they do.
  const userOwn = composeUserBullets(data, data.roleFamily);
  // REVERTED (independent review of 0eeb3f2): restatement suppression used to
  // drop a generated bullet whose every clause rested on evidence already in a
  // user line. It destroyed evidence — a scope metric interpolated into a clause
  // lead ("Handled 12 reports by …") vanished with the bullet, and because the
  // comparison joined all user bullets into one string, two unrelated user
  // sentences could suppress a claim neither of them restated.
  //
  // Duplicate truthful wording is a polish problem; deleting a supported metric
  // is a truth-integrity failure. Suppression will return only with per-bullet,
  // structured evidence dependencies that preserve independently supported
  // metrics and outcomes. Until then the user's line and the template both
  // stand.
  const combined = compact([...userOwn, ...grounded.map((bullet) => bullet.text)]);
  return qualityCheckBullets(combined);
}


function buildOccupationSummary(data: IntakeData, target: string, experience: ExperienceRole[], occupation: OccupationProfile) {
  // "Strengths the candidate reports include X" attributes a statement to the
  // user, so X must come from something the user actually described. Grounded
  // against the full corpus, the employer name supplied it: "Corner Kitchen"
  // produced "team coordination" and "Brightpath Care" produced "patient
  // support" for candidates who had reported nothing.
  const corpus = buildActivityCorpus(data);
  const currentRole = experience[0];
  const title = (currentRole?.title ?? cleanWhitespace(data.currentTitle)) || "Worker";
  const strengths = compact([
    ...data.customRoleTransferableSkills.map(normalizeResponsibility),
    ...data.customRoleWorkStyles.map(normalizeResponsibility),
    ...groundedOnly(occupation.transferables, corpus)
  ]).slice(0, 4);
  const responsibilities = buildResponsibilityList(data).map(readableUserPhrase).slice(0, 4);
  const aiPhrase = aiWorkflowPhrase(data);
  const handledClause = responsibilities.length ? `, handling ${midSentence(sentenceList(responsibilities))}` : "";
  const strengthSentence = strengths.length ? ` Strengths the candidate reports include ${midSentence(sentenceList(strengths))}.` : "";

  return limitSentences(
    `${title} with experience in a ${occupation.environment}${handledClause}.${strengthSentence} Now targeting ${target} roles.${aiPhrase ? ` Uses AI-assisted workflows for ${aiPhrase}.` : ""}`,
    4
  );
}

function buildOccupationLinkedInSummary(data: IntakeData, target: string, experience: ExperienceRole[], occupation: OccupationProfile) {
  // "Brings X into ..." asserts a competency, so X must come from work
  // the user described. Against the full corpus the employer name supplied it:
  // "Corner Kitchen" produced "team coordination", "Accurate Inventory Co"
  // produced "inventory", "Safety Solutions Group" produced "safety
  // procedures" — for candidates who had described nothing. Propagates to
  // resume-pack linkedinAbout.
  const corpus = buildActivityCorpus(data);
  const currentRole = experience[0];
  const title = (currentRole?.title ?? cleanWhitespace(data.currentTitle)) || "Worker";
  const strengths = compact([
    ...groundedOnly(occupation.transferables, corpus),
    ...buildResponsibilityList(data).map(readableUserPhrase)
  ]).slice(0, 4);
  const strengthClause = strengths.length ? `Brings ${midSentence(sentenceList(strengths))} into ` : "Moving into ";

  return limitSentences(
    `${title} with hands-on experience in a ${occupation.environment}. ${strengthClause}${targetRoleFamilyText(data, target)}.`,
    3
  );
}

function buildOccupationHeadline(data: IntakeData, occupation: OccupationProfile) {
  // A headline skill is a claim about the candidate. Against the full
  // corpus "Route Runners LLC" produced "Route Planning" and "Precision
  // Cleaning Group" produced "Cleaning Standards" from the employer name alone.
  // Propagates to resume-pack linkedinHeadlines.
  const corpus = buildActivityCorpus(data);
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
  // A headline strength is a claim about the candidate, so it must be grounded
  // in described work. Against the full corpus the employer name grounded it:
  // "Accurate Inventory Co" produced the headline strength "Inventory
  // Accuracy" for a candidate who described nothing. This is the generic
  // (non-occupation) headline path, reached whenever no occupation profile
  // matches the title.
  const corpus = buildActivityCorpus(data);
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
    // Repetition is collapsed only for stopwords, where a genuine double is
    // always a typo. The unrestricted version deleted real repeated words:
    // "Walla Walla distribution center" became "walla distribution center", a
    // falsified place name. The `a` -> `an` rule is gone with it — the correct
    // article follows the vowel SOUND ("a user group", "a unique path"), which
    // a regex cannot determine, so the user's own article stands.
    .replace(/\b(the|and|of|to|a|an|in|on|for|that|is|was)\s+\1\b/gi, "$1")
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
  const responsibilities = buildResponsibilityList(data).map(readableUserPhrase);
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

  return qualityCheckBullets(compact(bullets));
}

const verbLedPhrase =
  /^(handled|helped|managed|supported|answered|made|processed|prepared|cleaned|stocked|restocked|checked|planned|delivered|drove|built|created|tested|wrote|fixed|resolved|coordinated|organized|scheduled|tracked|documented|maintained|trained|coached|served|greeted|rang|counted|updated|assisted|picked|packed|scanned|loaded|unloaded|sorted|monitored|patrolled|escalated|followed|improved|reduced|increased|launched|shipped|booked|styled|repaired|operated|entered|filed|routed|explained|communicated|took|kept|used|swept|held|led|sold|taught|spoke|brought|met|paid|set|sat|won|dealt|sent|ran|went|put|read|grew|cut|drew|fed|felt|found|gave|got|left|lost|rose|showed|told|wore)\b/i;

// A user's line is verb-led when the whitelist matches OR the first word is a
// regular past tense / gerund. The whitelist alone cannot be complete — every
// verb missing from it ("mopped", "poured", "wiped", "vacuumed", "dusted") was
// misread as a noun label and wrapped in an invented "Supported " lead, so
// "Mopped." rendered as "Supported mopped."
function isVerbLed(line: string) {
  const first = cleanWhitespace(line).split(/\s+/)[0] ?? "";
  return verbLedPhrase.test(line) || /^[a-z]{3,}(ed|ing)$/i.test(first);
}

// A clause has a subject and/or a copula: "It was hectic.", "They promoted
// me twice.", "was the closer". A word count cannot tell these from a chip
// label, and treating them as labels produced fabricated leads like
// "Supported It was hectic." Detected structurally — no verb whitelist.
function readsAsClause(line: string) {
  return /\b(?:it|they|them|we|he|she|you|i)\b/i.test(line) || /\b(?:is|was|were|are|am|be|been|being)\b/i.test(line);
}

// A line may take the "Supported …" lead ONLY when it is unmistakably a bare
// noun label — a short fragment with no verb and no clause structure of its
// own. Anything else is the user's own sentence and is emitted as written.
// Never guess a lead.
function isNounLabel(line: string) {
  const words = cleanWhitespace(line).split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 4 && !isVerbLed(line) && !readsAsClause(line);
}

function capitalizeSentence(value: string) {
  const cleaned = cleanWhitespace(value);
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "";
}

// Bullets composed strictly from what the user said: their own phrases, their
// numbers, their selected actions/outcomes, their tools. No template claims.
function composeUserBullets(data: IntakeData, roleFamily: RoleFamily) {
  // The USER's own lines only. buildResponsibilityList also carries
  // occupation- and label-derived entries, and joining those into the same
  // sentence rewrote the user: a typed "Mopped." came back as "Mopped and
  // cleaning standards." Bullets composed strictly from what the user said must
  // draw strictly from what the user said.
  const responsibilities = buildUserResponsibilityList(data);
  const verbLed = responsibilities.filter((item) => isVerbLed(item));
  const nounLed = responsibilities.filter((item) => !isVerbLed(item) && isNounLabel(item));
  // Neither a recognised verb nor a bare noun label: the user's own sentence.
  // It is emitted exactly as written rather than given a guessed lead.
  const asWritten = responsibilities.filter((item) => !isVerbLed(item) && !isNounLabel(item));
  const tools = buildToolList(data);
  const scopes = buildScopeItems(data);
  const outcome = buildOutcomeSupport(data);
  const selectedActions = compact(data.selectedActions.map((item) => cleanWhitespace(item))).filter((item) => !isWeakFreeText(item));
  const toolPhrase = chooseToolPhrase(tools, roleFamily, responsibilities[1] ?? responsibilities[0] ?? "");
  const bullets: string[] = [];

  if (verbLed.length) {
    const joined = sentenceList(verbLed.slice(0, 3).map(readableUserPhrase));
    // Skip the outcome clause when the phrases already state it (avoids
    // "improved compliance ... to support compliance").
    const outcomeClause = outcome && !joined.toLowerCase().includes(outcome.split(/\s+/)[0].toLowerCase()) ? ` to support ${outcome}` : "";
    bullets.push(capitalizeSentence(`${joined}${outcomeClause}.`));
  }
  if (nounLed.length) {
    // "Supported" is deliberately the weakest honest verb for noun-label
    // lists — family verbs like "Tested" would overstate what the user said.
    bullets.push(capitalizeSentence(`Supported ${sentenceList(nounLed.slice(0, 3).map(readableUserPhrase))}${toolPhrase}.`));
  }
  asWritten.slice(0, 3).forEach((line) => bullets.push(capitalizeSentence(`${readableUserPhrase(line)}.`)));
  if (verbLed.length > 3) {
    bullets.push(capitalizeSentence(`${sentenceList(verbLed.slice(3, 6).map(readableUserPhrase))}.`));
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
    bullets.push(capitalizeSentence(`${sentenceList(selectedActions.map(readableUserPhrase))}.`));
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
    return qualityCheckBullets(compact([...composeUserBullets(data, data.roleFamily), ...grounded]));
  }

  const occupation = detectOccupationProfile(data, role);
  if (occupation) {
    return buildOccupationBullets(data, role, occupation);
  }

  if (isBeautyServiceProfile(data, role)) {
    return buildBeautyServiceBullets(data);
  }

  return qualityCheckBullets(compact([...composeUserBullets(data, data.roleFamily), ...specificEvidenceBullets(data)]));
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

// Two behaviours were removed here, both of which silently rewrote or discarded
// the user's own words:
//
//   Opening-verb rotation — a second copy of the diversifyOpeningVerbs defect.
//   It replaced the first word of any bullet whose opener had been used, so
//   "Supported job site work…" became "Assisted job site work…". A résumé may
//   repeat a verb; it may not attribute one the user did not choose.
//
//   A `length > 30` filter — which dropped short, TRUE lines outright.
//   "Drove clients to appointments." is exactly 30 characters and vanished, so
//   a user who wrote one sparse sentence got an empty Experience section. Thin
//   evidence must stay visible and usable; judging it is the quality layer's
//   job, and that layer only ever suggests.
function qualityCheckBullets(bullets: string[]) {
  const seen = new Set<string>();
  return compact(bullets)
    .map(cleanSentence)
    .filter((bullet) => {
      const key = bullet.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
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
    ...responsibilities.map(readableUserPhrase),
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
  const responsibilities = buildResponsibilityList(data).slice(0, 3).map(readableUserPhrase);
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
    bullets: qualityCheckBullets(role.bullets).filter(
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
