import type { IntakeData, RoleFamily } from "@/types/career";

export type CareerRecommendationConfidence = "High confidence" | "Medium confidence" | "Stretch";

export type CareerEvidence = {
  id: string;
  label: string;
  chainLabel: string;
  why: string;
};

export type CareerRecommendation = {
  title: string;
  roleFamily: RoleFamily;
  confidence: CareerRecommendationConfidence;
  why: string[];
  evidenceChain: string[];
};

type WorkerProfile = "barber" | "warehouse" | "security" | "food_service" | "retail" | "general";

type EvidenceRule = CareerEvidence & {
  patterns: RegExp[];
  profileDefaults?: WorkerProfile[];
};

type RecommendationRule = {
  title: string;
  roleFamily: RoleFamily;
  profile: WorkerProfile;
  level: "strong" | "realistic" | "stretch";
  evidence: string[];
};

const profilePatterns: Array<{ profile: WorkerProfile; patterns: RegExp[] }> = [
  { profile: "barber", patterns: [/\bbarber\b/i, /\bhair stylist\b/i, /\bstylist\b/i, /\bsalon\b/i, /\bbeauty\b/i] },
  { profile: "warehouse", patterns: [/\bwarehouse\b/i, /\bfulfillment\b/i, /\binventory\b/i, /\bstocker\b/i, /\bforklift\b/i, /\bpick(?:er|ing)\b/i, /\bpack(?:er|ing)\b/i] },
  { profile: "security", patterns: [/\bsecurity\b/i, /\bguard\b/i, /\baccess control\b/i, /\bsurveillance\b/i, /\bloss prevention\b/i, /\basset protection\b/i] },
  { profile: "food_service", patterns: [/\bfood service\b/i, /\bserver\b/i, /\brestaurant\b/i, /\bbarista\b/i, /\bcook\b/i, /\bkitchen\b/i, /\bhospitality\b/i] },
  { profile: "retail", patterns: [/\bretail\b/i, /\bcashier\b/i, /\bsales associate\b/i, /\bstore\b/i, /\bmerchandis/i, /\bpos\b/i] }
];

const evidenceRules: EvidenceRule[] = [
  {
    id: "repeat_clients",
    label: "Built repeat clientele",
    chainLabel: "Built long-term client relationships",
    why: "Built repeat client relationships.",
    patterns: [/\brepeat\b/i, /\bregulars?\b/i, /\bclientele\b/i, /\bretention\b/i, /\breferrals?\b/i],
    profileDefaults: ["barber"]
  },
  {
    id: "customer_communication",
    label: "Customer communication",
    chainLabel: "Communicated directly with customers",
    why: "Communicated directly with customers every day.",
    patterns: [/\bcustomers?\b/i, /\bclients?\b/i, /\bguests?\b/i, /\bpatients?\b/i, /\bmembers?\b/i, /\banswered questions\b/i, /\bservice\b/i],
    profileDefaults: ["barber", "food_service", "retail", "security"]
  },
  {
    id: "scheduling",
    label: "Appointment scheduling",
    chainLabel: "Managed scheduling and expectations",
    why: "Managed scheduling, appointments, or expectations.",
    patterns: [/\bschedul/i, /\bappointments?\b/i, /\bbook(?:ed|ing|s)?\b/i, /\bcalendar\b/i, /\bshift coverage\b/i],
    profileDefaults: ["barber"]
  },
  {
    id: "issue_resolution",
    label: "Conflict resolution",
    chainLabel: "Resolved customer concerns",
    why: "Solved customer issues in real time.",
    patterns: [/\bissues?\b/i, /\bcomplaints?\b/i, /\bconcerns?\b/i, /\bupset\b/i, /\bde-?escalat/i, /\bresolved?\b/i],
    profileDefaults: ["barber", "security", "food_service", "retail"]
  },
  {
    id: "retention",
    label: "Retention and referrals",
    chainLabel: "Maintained high repeat business",
    why: "Relied on referrals, repeat business, or customer retention.",
    patterns: [/\bretention\b/i, /\breferrals?\b/i, /\brepeat business\b/i, /\bbook of business\b/i, /\bclient book\b/i],
    profileDefaults: ["barber"]
  },
  {
    id: "upselling",
    label: "Upselling services",
    chainLabel: "Recommended services or products",
    why: "Recommended services, products, or next steps to customers.",
    patterns: [/\bupsell/i, /\brecommended\b/i, /\bproducts?\b/i, /\bservices?\b/i, /\bsales?\b/i],
    profileDefaults: ["barber", "retail"]
  },
  {
    id: "time_management",
    label: "Time management",
    chainLabel: "Kept work moving on time",
    why: "Kept appointments, orders, or shift work moving on time.",
    patterns: [/\btime\b/i, /\bdeadline\b/i, /\bfast-paced\b/i, /\bbusy\b/i, /\borders?\b/i, /\broutes?\b/i],
    profileDefaults: ["barber", "warehouse", "food_service", "retail"]
  },
  {
    id: "independent_work",
    label: "Independent work",
    chainLabel: "Handled work independently",
    why: "Worked independently while staying accountable for results.",
    patterns: [/\bindependent\b/i, /\bself-employed\b/i, /\bfreelance\b/i, /\bbooth\b/i, /\bown clients?\b/i],
    profileDefaults: ["barber"]
  },
  {
    id: "inventory_accuracy",
    label: "Inventory accuracy",
    chainLabel: "Tracked inventory and order accuracy",
    why: "Tracked inventory, stock, orders, or materials accurately.",
    patterns: [/\binventory\b/i, /\bstock/i, /\border accuracy\b/i, /\bscanner\b/i, /\bcycle count\b/i, /\breceiving\b/i],
    profileDefaults: ["warehouse", "retail"]
  },
  {
    id: "logistics_flow",
    label: "Logistics flow",
    chainLabel: "Moved orders through a workflow",
    why: "Moved orders, shipments, or handoffs through a clear workflow.",
    patterns: [/\blogistics\b/i, /\bfulfillment\b/i, /\bshipping\b/i, /\breceiving\b/i, /\bpicking\b/i, /\bpacking\b/i, /\bhandoffs?\b/i],
    profileDefaults: ["warehouse"]
  },
  {
    id: "safety_procedures",
    label: "Safety and procedures",
    chainLabel: "Followed safety and procedure standards",
    why: "Followed safety, quality, or policy procedures.",
    patterns: [/\bsafety\b/i, /\bpolicy\b/i, /\bprocedures?\b/i, /\bcompliance\b/i, /\bsanit/i, /\bclean\b/i],
    profileDefaults: ["warehouse", "security", "food_service"]
  },
  {
    id: "documentation",
    label: "Documentation",
    chainLabel: "Documented issues and records",
    why: "Documented notes, reports, logs, or records.",
    patterns: [/\bdocument/i, /\breports?\b/i, /\brecords?\b/i, /\blogs?\b/i, /\bpaperwork\b/i, /\bnotes?\b/i],
    profileDefaults: ["warehouse", "security"]
  },
  {
    id: "access_control",
    label: "Access control",
    chainLabel: "Monitored access and safety risks",
    why: "Monitored access, visitors, safety risks, or policy exceptions.",
    patterns: [/\baccess control\b/i, /\bvisitors?\b/i, /\bpatrol\b/i, /\bmonitor/i, /\bsurveillance\b/i, /\bincident\b/i],
    profileDefaults: ["security"]
  },
  {
    id: "order_accuracy",
    label: "Order accuracy",
    chainLabel: "Kept orders accurate under pressure",
    why: "Kept orders, requests, or transactions accurate under pressure.",
    patterns: [/\border\b/i, /\baccur/i, /\bpayments?\b/i, /\btransactions?\b/i, /\bregister\b/i, /\bpos\b/i],
    profileDefaults: ["food_service", "retail"]
  },
  {
    id: "team_coordination",
    label: "Team coordination",
    chainLabel: "Coordinated with teammates during service",
    why: "Coordinated with teammates during busy service or operations work.",
    patterns: [/\bteam\b/i, /\bstaff\b/i, /\bcoworkers?\b/i, /\bshift\b/i, /\bcrew\b/i, /\bmanager\b/i],
    profileDefaults: ["food_service", "retail"]
  },
  {
    id: "merchandising",
    label: "Merchandising and store standards",
    chainLabel: "Maintained store presentation and stock",
    why: "Maintained store presentation, shelves, stock, or merchandising standards.",
    patterns: [/\bmerchandis/i, /\bshelves\b/i, /\bdisplays?\b/i, /\bstore standards?\b/i, /\bstockroom\b/i],
    profileDefaults: ["retail"]
  }
];

const recommendationRules: RecommendationRule[] = [
  { profile: "barber", title: "Client Success Representative", roleFamily: "Customer Success", level: "strong", evidence: ["repeat_clients", "customer_communication", "scheduling", "issue_resolution", "retention"] },
  { profile: "barber", title: "Customer Success Associate", roleFamily: "Customer Success", level: "strong", evidence: ["repeat_clients", "customer_communication", "scheduling", "issue_resolution", "retention"] },
  { profile: "barber", title: "Salon Manager", roleFamily: "Operations", level: "strong", evidence: ["repeat_clients", "scheduling", "time_management", "customer_communication", "issue_resolution"] },
  { profile: "barber", title: "Beauty Brand Sales Representative", roleFamily: "Sales", level: "strong", evidence: ["customer_communication", "upselling", "retention", "independent_work"] },
  { profile: "barber", title: "Scheduling Coordinator", roleFamily: "Operations", level: "realistic", evidence: ["scheduling", "customer_communication", "time_management"] },
  { profile: "barber", title: "Office Coordinator", roleFamily: "Admin", level: "realistic", evidence: ["scheduling", "customer_communication", "documentation", "time_management"] },
  { profile: "barber", title: "Retail Supervisor", roleFamily: "Operations", level: "realistic", evidence: ["customer_communication", "upselling", "issue_resolution", "time_management"] },
  { profile: "barber", title: "Account Coordinator", roleFamily: "Customer Success", level: "realistic", evidence: ["customer_communication", "scheduling", "retention", "documentation"] },
  { profile: "barber", title: "Sales Development Representative", roleFamily: "Sales", level: "stretch", evidence: ["customer_communication", "upselling", "issue_resolution", "retention"] },
  { profile: "barber", title: "Customer Success Manager", roleFamily: "Customer Success", level: "stretch", evidence: ["repeat_clients", "customer_communication", "issue_resolution", "retention"] },
  { profile: "barber", title: "Territory Representative", roleFamily: "Sales", level: "stretch", evidence: ["customer_communication", "upselling", "independent_work", "time_management"] },

  { profile: "warehouse", title: "Logistics Coordinator", roleFamily: "Operations", level: "strong", evidence: ["inventory_accuracy", "logistics_flow", "time_management", "safety_procedures"] },
  { profile: "warehouse", title: "Inventory Coordinator", roleFamily: "Operations", level: "strong", evidence: ["inventory_accuracy", "documentation", "time_management", "safety_procedures"] },
  { profile: "warehouse", title: "Operations Specialist", roleFamily: "Operations", level: "strong", evidence: ["logistics_flow", "inventory_accuracy", "team_coordination", "documentation"] },

  { profile: "security", title: "Trust & Safety Associate", roleFamily: "Security", level: "strong", evidence: ["access_control", "safety_procedures", "documentation", "issue_resolution"] },
  { profile: "security", title: "Loss Prevention Analyst", roleFamily: "Business", level: "realistic", evidence: ["access_control", "documentation", "safety_procedures"] },
  { profile: "security", title: "Compliance Coordinator", roleFamily: "Business", level: "realistic", evidence: ["safety_procedures", "documentation", "access_control"] },

  { profile: "food_service", title: "Restaurant Operations", roleFamily: "Operations", level: "strong", evidence: ["order_accuracy", "team_coordination", "time_management", "safety_procedures"] },
  { profile: "food_service", title: "Hospitality Coordinator", roleFamily: "Operations", level: "strong", evidence: ["customer_communication", "order_accuracy", "team_coordination", "issue_resolution"] },
  { profile: "food_service", title: "Customer Experience Associate", roleFamily: "Customer Success", level: "realistic", evidence: ["customer_communication", "issue_resolution", "order_accuracy", "time_management"] },

  { profile: "retail", title: "Store Operations", roleFamily: "Operations", level: "strong", evidence: ["customer_communication", "inventory_accuracy", "merchandising", "team_coordination"] },
  { profile: "retail", title: "Merchandising Coordinator", roleFamily: "Operations", level: "strong", evidence: ["merchandising", "inventory_accuracy", "time_management"] },
  { profile: "retail", title: "Customer Success", roleFamily: "Customer Success", level: "realistic", evidence: ["customer_communication", "issue_resolution", "order_accuracy", "team_coordination"] },

  { profile: "general", title: "Customer Experience Associate", roleFamily: "Customer Success", level: "realistic", evidence: ["customer_communication", "issue_resolution", "time_management"] },
  { profile: "general", title: "Operations Coordinator", roleFamily: "Operations", level: "realistic", evidence: ["time_management", "documentation", "team_coordination"] },
  { profile: "general", title: "Administrative Coordinator", roleFamily: "Admin", level: "realistic", evidence: ["scheduling", "documentation", "customer_communication"] }
];

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function intakeHaystack(data: IntakeData) {
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
    data.tools,
    ...data.selectedResponsibilities,
    ...data.selectedActions,
    ...data.customRoleWorkStyles,
    ...data.customRoleTransferableSkills,
    ...data.selectedOutcomes,
    ...data.selectedIndependentWorkSignals
  ].join(" ");
}

function detectProfiles(text: string): WorkerProfile[] {
  const profiles = profilePatterns
    .filter((profile) => profile.patterns.some((pattern) => pattern.test(text)))
    .map((profile) => profile.profile);

  return profiles.length ? unique(profiles) : ["general"];
}

function confidenceFor(level: RecommendationRule["level"], evidenceCount: number): CareerRecommendationConfidence {
  if (level === "stretch") return "Stretch";
  if (evidenceCount >= 4 && level === "strong") return "High confidence";
  if (evidenceCount >= 3) return "Medium confidence";
  return "Stretch";
}

export function buildCareerEvidence(data: IntakeData): CareerEvidence[] {
  const text = intakeHaystack(data);
  const profiles = detectProfiles(text);
  const evidence = evidenceRules.filter((rule) => {
    const textMatch = rule.patterns.some((pattern) => pattern.test(text));
    const profileMatch = rule.profileDefaults?.some((profile) => profiles.includes(profile));
    return textMatch || profileMatch;
  });

  return evidence.map(({ id, label, chainLabel, why }) => ({ id, label, chainLabel, why }));
}

export function buildCareerRecommendations(data: IntakeData): CareerRecommendation[] {
  const text = intakeHaystack(data);
  const profiles = detectProfiles(text);
  const activeProfiles = profiles.includes("general") ? profiles : [...profiles, "general"];
  const evidence = buildCareerEvidence(data);
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const recommendations = recommendationRules
    .filter((rule) => activeProfiles.includes(rule.profile))
    .map((rule) => {
      const matchingEvidence = rule.evidence.map((id) => evidenceById.get(id)).filter(Boolean) as CareerEvidence[];
      if (matchingEvidence.length < 3) return null;
      return {
        title: rule.title,
        roleFamily: rule.roleFamily,
        confidence: confidenceFor(rule.level, matchingEvidence.length),
        why: matchingEvidence.slice(0, 5).map((item) => item.why),
        evidenceChain: [...matchingEvidence.slice(0, 4).map((item) => item.chainLabel), rule.title]
      };
    })
    .filter(Boolean) as CareerRecommendation[];

  return recommendations
    .filter((item, index, items) => items.findIndex((candidate) => candidate.title === item.title) === index)
    .slice(0, 6);
}
