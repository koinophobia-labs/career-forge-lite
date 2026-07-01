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

type WorkerProfile =
  | "barber"
  | "bartender"
  | "warehouse"
  | "security"
  | "food_service"
  | "retail"
  | "delivery"
  | "janitor"
  | "caregiver"
  | "receptionist"
  | "construction"
  | "general";

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
  { profile: "bartender", patterns: [/\bbartender\b/i, /\bbar back\b/i, /\bbarback\b/i] },
  { profile: "warehouse", patterns: [/\bwarehouse\b/i, /\bfulfillment\b/i, /\binventory\b/i, /\bstocker\b/i, /\bforklift\b/i, /\bpick(?:er|ing)\b/i, /\bpack(?:er|ing)\b/i] },
  { profile: "security", patterns: [/\bsecurity\b/i, /\bguard\b/i, /\baccess control\b/i, /\bsurveillance\b/i, /\bloss prevention\b/i, /\basset protection\b/i] },
  { profile: "food_service", patterns: [/\bfood service\b/i, /\bserver\b/i, /\brestaurant\b/i, /\bbarista\b/i, /\bcook\b/i, /\bkitchen\b/i, /\bhospitality\b/i] },
  { profile: "retail", patterns: [/\bretail\b/i, /\bcashier\b/i, /\bsales associate\b/i, /\bstore\b/i, /\bmerchandis/i, /\bpos\b/i] },
  { profile: "delivery", patterns: [/\bdoordash\b/i, /\bdoor dash\b/i, /\bdasher\b/i, /\bdelivery driver\b/i, /\bdeliver(?:ed|ies|ing)\s+(orders?|food|packages?)\b/i, /\bcourier\b/i, /\bdriver\b/i, /\broutes?\b/i] },
  { profile: "janitor", patterns: [/\bjanitor\b/i, /\bcustodian\b/i, /\bcleaner\b/i, /\bmaintenance helper\b/i, /\bfacilities\b/i] },
  { profile: "caregiver", patterns: [/\bcaregiver\b/i, /\bhome health\b/i, /\bhome health aide\b/i, /\bcna\b/i, /\bnursing assistant\b/i, /\bpatient care\b/i, /\bresident care\b/i] },
  { profile: "receptionist", patterns: [/\breceptionist\b/i, /\bfront desk\b/i, /\boffice assistant\b/i, /\badministrative assistant\b/i] },
  { profile: "construction", patterns: [/\bconstruction\b/i, /\bgeneral labor\b/i, /\blaborer\b/i, /\bjob site\b/i] }
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
    profileDefaults: ["barber", "bartender", "food_service", "retail", "security", "delivery", "caregiver", "receptionist"]
  },
  {
    id: "scheduling",
    label: "Appointment scheduling",
    chainLabel: "Managed scheduling and expectations",
    why: "Managed scheduling, appointments, or expectations.",
    patterns: [/\bschedul/i, /\bappointments?\b/i, /\bbook(?:ed|ing|s)?\b/i, /\bcalendar\b/i, /\bshift coverage\b/i],
    profileDefaults: ["barber", "caregiver", "receptionist"]
  },
  {
    id: "issue_resolution",
    label: "Conflict resolution",
    chainLabel: "Resolved customer concerns",
    why: "Solved customer issues in real time.",
    patterns: [/\bissues?\b/i, /\bcomplaints?\b/i, /\bconcerns?\b/i, /\bupset\b/i, /\bde-?escalat/i, /\bresolved?\b/i],
    profileDefaults: ["barber", "bartender", "security", "food_service", "retail"]
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
    profileDefaults: ["barber", "bartender", "warehouse", "food_service", "retail", "delivery", "janitor", "construction"]
  },
  {
    id: "independent_work",
    label: "Independent work",
    chainLabel: "Handled work independently",
    why: "Worked independently while staying accountable for results.",
    patterns: [/\bindependent\b/i, /\bself-employed\b/i, /\bfreelance\b/i, /\bbooth\b/i, /\bown clients?\b/i],
    profileDefaults: ["barber", "delivery"]
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
    profileDefaults: ["warehouse", "delivery"]
  },
  {
    id: "safety_procedures",
    label: "Safety and procedures",
    chainLabel: "Followed safety and procedure standards",
    why: "Followed safety, quality, or policy procedures.",
    patterns: [/\bsafety\b/i, /\bpolicy\b/i, /\bprocedures?\b/i, /\bcompliance\b/i, /\bsanit/i, /\bclean\b/i],
    profileDefaults: ["warehouse", "security", "food_service", "janitor", "construction", "caregiver"]
  },
  {
    id: "documentation",
    label: "Documentation",
    chainLabel: "Documented issues and records",
    why: "Documented notes, reports, logs, or records.",
    patterns: [/\bdocument/i, /\breports?\b/i, /\brecords?\b/i, /\blogs?\b/i, /\bpaperwork\b/i, /\bnotes?\b/i],
    profileDefaults: ["warehouse", "security", "janitor", "caregiver", "receptionist"]
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
    profileDefaults: ["bartender", "food_service", "retail", "delivery"]
  },
  {
    id: "team_coordination",
    label: "Team coordination",
    chainLabel: "Coordinated with teammates during service",
    why: "Coordinated with teammates during busy service or operations work.",
    patterns: [/\bteam\b/i, /\bstaff\b/i, /\bcoworkers?\b/i, /\bshift\b/i, /\bcrew\b/i, /\bmanager\b/i],
    profileDefaults: ["bartender", "food_service", "retail", "construction"]
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
  { profile: "barber", title: "Customer Experience Associate", roleFamily: "Customer Success", level: "strong", evidence: ["repeat_clients", "customer_communication", "scheduling", "issue_resolution", "retention"] },
  { profile: "barber", title: "Client Support Associate", roleFamily: "Customer Success", level: "strong", evidence: ["repeat_clients", "customer_communication", "issue_resolution", "retention"] },
  { profile: "barber", title: "Appointment Coordinator", roleFamily: "Operations", level: "realistic", evidence: ["scheduling", "customer_communication", "time_management"] },
  { profile: "barber", title: "Salon Operations Assistant", roleFamily: "Operations", level: "realistic", evidence: ["repeat_clients", "scheduling", "time_management", "customer_communication", "issue_resolution"] },
  { profile: "barber", title: "Beauty Brand Sales Support", roleFamily: "Sales", level: "realistic", evidence: ["customer_communication", "upselling", "retention", "independent_work"] },
  { profile: "barber", title: "Scheduling Coordinator", roleFamily: "Operations", level: "realistic", evidence: ["scheduling", "customer_communication", "time_management"] },
  { profile: "barber", title: "Office Assistant", roleFamily: "Admin", level: "realistic", evidence: ["scheduling", "customer_communication", "documentation", "time_management"] },
  { profile: "barber", title: "Sales Support Associate", roleFamily: "Sales", level: "stretch", evidence: ["customer_communication", "upselling", "issue_resolution", "retention"] },

  { profile: "bartender", title: "Customer Service Professional", roleFamily: "Customer Success", level: "strong", evidence: ["customer_communication", "issue_resolution", "order_accuracy", "time_management"] },
  { profile: "bartender", title: "Hospitality Operations Assistant", roleFamily: "Operations", level: "realistic", evidence: ["customer_communication", "order_accuracy", "team_coordination", "time_management"] },
  { profile: "bartender", title: "Sales Support Associate", roleFamily: "Sales", level: "realistic", evidence: ["customer_communication", "upselling", "issue_resolution"] },

  { profile: "warehouse", title: "Warehouse Associate", roleFamily: "Operations", level: "strong", evidence: ["inventory_accuracy", "logistics_flow", "time_management", "safety_procedures"] },
  { profile: "warehouse", title: "Fulfillment Associate", roleFamily: "Operations", level: "strong", evidence: ["inventory_accuracy", "logistics_flow", "time_management", "safety_procedures"] },
  { profile: "warehouse", title: "Inventory Associate", roleFamily: "Operations", level: "strong", evidence: ["inventory_accuracy", "documentation", "time_management", "safety_procedures"] },
  { profile: "warehouse", title: "Logistics Associate", roleFamily: "Operations", level: "realistic", evidence: ["logistics_flow", "inventory_accuracy", "team_coordination", "documentation"] },

  { profile: "security", title: "Operations Assistant", roleFamily: "Operations", level: "strong", evidence: ["access_control", "safety_procedures", "documentation", "issue_resolution"] },
  { profile: "security", title: "Facilities Assistant", roleFamily: "Operations", level: "realistic", evidence: ["access_control", "documentation", "safety_procedures"] },
  { profile: "security", title: "Compliance Support", roleFamily: "Business", level: "realistic", evidence: ["safety_procedures", "documentation", "access_control"] },
  { profile: "security", title: "IT Support Trainee", roleFamily: "IT Support", level: "stretch", evidence: ["customer_communication", "documentation", "issue_resolution"] },

  { profile: "food_service", title: "Operations Associate", roleFamily: "Operations", level: "strong", evidence: ["order_accuracy", "team_coordination", "time_management", "safety_procedures"] },
  { profile: "food_service", title: "Hospitality Support Associate", roleFamily: "Operations", level: "strong", evidence: ["customer_communication", "order_accuracy", "team_coordination", "issue_resolution"] },
  { profile: "food_service", title: "Inventory Associate", roleFamily: "Operations", level: "realistic", evidence: ["order_accuracy", "time_management", "safety_procedures"] },
  { profile: "food_service", title: "Customer Experience Associate", roleFamily: "Customer Success", level: "realistic", evidence: ["customer_communication", "issue_resolution", "order_accuracy", "time_management"] },

  { profile: "retail", title: "Inventory Associate", roleFamily: "Operations", level: "strong", evidence: ["customer_communication", "inventory_accuracy", "merchandising", "team_coordination"] },
  { profile: "retail", title: "Operations Assistant", roleFamily: "Operations", level: "strong", evidence: ["merchandising", "inventory_accuracy", "time_management"] },
  { profile: "retail", title: "Customer Support Associate", roleFamily: "Customer Success", level: "realistic", evidence: ["customer_communication", "issue_resolution", "order_accuracy", "team_coordination"] },
  { profile: "retail", title: "Sales Support Associate", roleFamily: "Sales", level: "realistic", evidence: ["customer_communication", "upselling", "order_accuracy"] },

  { profile: "delivery", title: "Warehouse Associate", roleFamily: "Operations", level: "strong", evidence: ["logistics_flow", "order_accuracy", "time_management", "customer_communication"] },
  { profile: "delivery", title: "Fulfillment Associate", roleFamily: "Operations", level: "strong", evidence: ["logistics_flow", "time_management", "order_accuracy"] },
  { profile: "delivery", title: "Logistics Support", roleFamily: "Operations", level: "realistic", evidence: ["logistics_flow", "time_management", "order_accuracy", "issue_resolution"] },
  { profile: "delivery", title: "Dispatch Assistant", roleFamily: "Operations", level: "realistic", evidence: ["logistics_flow", "customer_communication", "time_management"] },
  { profile: "delivery", title: "Customer Experience Associate", roleFamily: "Customer Success", level: "realistic", evidence: ["customer_communication", "issue_resolution", "order_accuracy", "time_management"] },

  { profile: "janitor", title: "Facilities Assistant", roleFamily: "Operations", level: "strong", evidence: ["safety_procedures", "documentation", "time_management"] },
  { profile: "janitor", title: "Maintenance Assistant", roleFamily: "Operations", level: "realistic", evidence: ["safety_procedures", "documentation", "time_management"] },
  { profile: "janitor", title: "Building Operations Support", roleFamily: "Operations", level: "realistic", evidence: ["safety_procedures", "documentation", "time_management"] },

  { profile: "caregiver", title: "Patient Services Representative", roleFamily: "Customer Success", level: "strong", evidence: ["customer_communication", "documentation", "safety_procedures", "scheduling"] },
  { profile: "caregiver", title: "Healthcare Admin Assistant", roleFamily: "Admin", level: "realistic", evidence: ["customer_communication", "documentation", "scheduling"] },
  { profile: "caregiver", title: "Client Support Associate", roleFamily: "Customer Success", level: "realistic", evidence: ["customer_communication", "issue_resolution", "documentation"] },

  { profile: "receptionist", title: "Administrative Assistant", roleFamily: "Admin", level: "strong", evidence: ["customer_communication", "scheduling", "documentation", "time_management"] },
  { profile: "receptionist", title: "Office Assistant", roleFamily: "Admin", level: "strong", evidence: ["customer_communication", "scheduling", "documentation"] },
  { profile: "receptionist", title: "Customer Support Associate", roleFamily: "Customer Success", level: "realistic", evidence: ["customer_communication", "issue_resolution", "documentation"] },

  { profile: "construction", title: "Facilities Assistant", roleFamily: "Operations", level: "strong", evidence: ["safety_procedures", "team_coordination", "time_management"] },
  { profile: "construction", title: "Maintenance Assistant", roleFamily: "Operations", level: "realistic", evidence: ["safety_procedures", "documentation", "team_coordination"] },
  { profile: "construction", title: "Building Operations Support", roleFamily: "Operations", level: "realistic", evidence: ["safety_procedures", "time_management", "team_coordination"] },

  { profile: "general", title: "Customer Experience Associate", roleFamily: "Customer Success", level: "realistic", evidence: ["customer_communication", "issue_resolution", "time_management"] },
  { profile: "general", title: "Operations Assistant", roleFamily: "Operations", level: "realistic", evidence: ["time_management", "documentation", "team_coordination"] },
  { profile: "general", title: "Administrative Assistant", roleFamily: "Admin", level: "realistic", evidence: ["scheduling", "documentation", "customer_communication"] }
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
