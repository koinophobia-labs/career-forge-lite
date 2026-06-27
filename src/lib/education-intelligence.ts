export const educationTypes = [
  "High School Diploma",
  "GED",
  "Associate Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "MBA",
  "Doctorate",
  "Professional Degree",
  "Community College",
  "Trade School",
  "Apprenticeship",
  "Bootcamp",
  "Military Training",
  "Professional Certificate",
  "Industry Certification",
  "Continuing Education",
  "Online Course",
  "Self-Directed Learning",
  "Other"
] as const;

export const degreeMajorBank = [
  "Business",
  "Finance",
  "Accounting",
  "Economics",
  "Marketing",
  "Management",
  "Supply Chain",
  "Operations",
  "Communications",
  "Journalism",
  "English",
  "Psychology",
  "Sociology",
  "Political Science",
  "Education",
  "Biology",
  "Chemistry",
  "Physics",
  "Mathematics",
  "Statistics",
  "Computer Science",
  "Information Technology",
  "Cybersecurity",
  "Information Systems",
  "Software Engineering",
  "Data Science",
  "AI / Machine Learning",
  "Mechanical Engineering",
  "Civil Engineering",
  "Electrical Engineering",
  "Nursing",
  "Healthcare Administration",
  "Exercise Science",
  "Criminal Justice",
  "Hospitality",
  "Sports Management",
  "Graphic Design",
  "Film",
  "Music",
  "Fine Arts",
  "Architecture",
  "Construction Management",
  "Public Administration",
  "Human Resources",
  "Project Management",
  "Logistics",
  "Computer Information Systems",
  "Web Development",
  "Network Administration",
  "Digital Media",
  "Liberal Arts",
  "General Studies"
];

export type CertificationCategory = "Technology" | "Business" | "Marketing" | "Healthcare" | "Fitness" | "Creative" | "Food/Hospitality";

export const certificationBank: Array<{ label: string; category: CertificationCategory; aliases?: string[] }> = [
  { label: "CompTIA A+", category: "Technology", aliases: ["A+", "Comptia A Plus"] },
  { label: "CompTIA Network+", category: "Technology", aliases: ["Network+", "Network Plus"] },
  { label: "CompTIA Security+", category: "Technology", aliases: ["Security+", "Security Plus"] },
  { label: "AWS Certified Cloud Practitioner", category: "Technology", aliases: ["AWS CCP", "Cloud Practitioner"] },
  { label: "AWS Certified Solutions Architect - Associate", category: "Technology", aliases: ["AWS SAA", "Solutions Architect Associate"] },
  { label: "Microsoft Azure Fundamentals", category: "Technology", aliases: ["Azure Fundamentals", "AZ-900"] },
  { label: "Google IT Support Professional Certificate", category: "Technology", aliases: ["Google IT Support"] },
  { label: "Cisco CCNA", category: "Technology", aliases: ["CCNA"] },
  { label: "ITIL Foundation", category: "Technology", aliases: ["ITIL"] },
  { label: "Certified ScrumMaster", category: "Business", aliases: ["Scrum Master", "CSM"] },
  { label: "Project Management Professional (PMP)", category: "Business", aliases: ["PMP"] },
  { label: "Lean Six Sigma", category: "Business", aliases: ["Six Sigma"] },
  { label: "Certified Associate in Project Management (CAPM)", category: "Business", aliases: ["CAPM"] },
  { label: "Google Project Management Certificate", category: "Business", aliases: ["Google Project Management"] },
  { label: "Salesforce Administrator", category: "Business", aliases: ["Salesforce Admin"] },
  { label: "HubSpot Certifications", category: "Business", aliases: ["HubSpot Academy"] },
  { label: "Google Analytics Certification", category: "Marketing", aliases: ["Google Analytics"] },
  { label: "Google Ads Certification", category: "Marketing", aliases: ["Google Ads"] },
  { label: "Meta Blueprint Certification", category: "Marketing", aliases: ["Meta Blueprint"] },
  { label: "Hootsuite Social Marketing Certification", category: "Marketing", aliases: ["Hootsuite"] },
  { label: "CPR Certification", category: "Healthcare", aliases: ["CPR"] },
  { label: "Certified Nursing Assistant (CNA)", category: "Healthcare", aliases: ["CNA"] },
  { label: "Emergency Medical Technician (EMT)", category: "Healthcare", aliases: ["EMT"] },
  { label: "Basic Life Support (BLS)", category: "Healthcare", aliases: ["BLS"] },
  { label: "Advanced Cardiovascular Life Support (ACLS)", category: "Healthcare", aliases: ["ACLS"] },
  { label: "NASM Certified Personal Trainer", category: "Fitness", aliases: ["NASM"] },
  { label: "ACE Certified Personal Trainer", category: "Fitness", aliases: ["ACE"] },
  { label: "ISSA Certification", category: "Fitness", aliases: ["ISSA"] },
  { label: "Adobe Certified Professional", category: "Creative", aliases: ["Adobe Certified"] },
  { label: "Autodesk Certified User", category: "Creative", aliases: ["Autodesk"] },
  { label: "ServSafe Certification", category: "Food/Hospitality", aliases: ["ServSafe"] },
  { label: "Food Handler Certification", category: "Food/Hospitality", aliases: ["Food Handler"] }
];

export const tradeEducationBank = [
  {
    trade: "Electrician",
    credentials: ["Electrical Apprenticeship", "Journeyman Electrician License", "OSHA Safety Training"],
    skills: ["Electrical Systems", "Blueprint Reading", "Safety Compliance", "Troubleshooting"],
    tools: ["Multimeter", "Hand Tools", "Power Tools", "Conduit Benders"],
    atsKeywords: ["Electrical Installation", "Preventive Maintenance", "Code Compliance", "Safety Procedures"]
  },
  {
    trade: "Plumber",
    credentials: ["Plumbing Apprenticeship", "Journeyman Plumber License"],
    skills: ["Pipe Systems", "Fixture Installation", "Troubleshooting", "Customer Service"],
    tools: ["Pipe Wrenches", "Drain Equipment", "Power Tools"],
    atsKeywords: ["Plumbing Systems", "Preventive Maintenance", "Code Compliance"]
  },
  {
    trade: "HVAC",
    credentials: ["HVAC Certificate", "EPA Section 608 Certification", "HVAC Apprenticeship"],
    skills: ["Diagnostics", "Preventive Maintenance", "Customer Communication", "Safety Compliance"],
    tools: ["Gauges", "Meters", "Recovery Machines"],
    atsKeywords: ["HVAC Systems", "Refrigeration", "Equipment Maintenance"]
  },
  {
    trade: "Welder",
    credentials: ["Welding Certificate", "AWS Welding Certification"],
    skills: ["Blueprint Reading", "Fabrication", "Quality Control", "Safety Procedures"],
    tools: ["MIG Welder", "TIG Welder", "Grinders", "Measuring Tools"],
    atsKeywords: ["Welding", "Fabrication", "Inspection", "Shop Safety"]
  },
  {
    trade: "Carpenter",
    credentials: ["Carpentry Apprenticeship", "Construction Training"],
    skills: ["Measurements", "Framing", "Finish Work", "Jobsite Safety"],
    tools: ["Power Tools", "Hand Tools", "Measuring Tools"],
    atsKeywords: ["Carpentry", "Construction", "Blueprint Reading", "Safety Procedures"]
  },
  {
    trade: "Machinist",
    credentials: ["Machining Certificate", "CNC Training"],
    skills: ["Precision Measurement", "CNC Operation", "Quality Control", "Shop Safety"],
    tools: ["CNC Machines", "Calipers", "Micrometers", "Lathes"],
    atsKeywords: ["Machining", "CNC", "Quality Inspection", "Manufacturing"]
  },
  {
    trade: "Auto Technician",
    credentials: ["Automotive Technology Certificate", "ASE Certification"],
    skills: ["Diagnostics", "Repair Documentation", "Customer Communication", "Preventive Maintenance"],
    tools: ["Diagnostic Scanners", "Hand Tools", "Lift Equipment"],
    atsKeywords: ["Automotive Repair", "Diagnostics", "Preventive Maintenance"]
  },
  {
    trade: "Heavy Equipment Operator",
    credentials: ["Heavy Equipment Operator Training", "OSHA Safety Training"],
    skills: ["Equipment Operation", "Site Safety", "Preventive Maintenance", "Coordination"],
    tools: ["Forklifts", "Loaders", "Excavators"],
    atsKeywords: ["Heavy Equipment", "Site Safety", "Equipment Inspection"]
  },
  {
    trade: "CDL",
    credentials: ["Commercial Driver's License (CDL)", "DOT Safety Training"],
    skills: ["Route Planning", "Vehicle Inspection", "Safety Compliance", "Logistics"],
    tools: ["Commercial Vehicles", "ELD Systems", "GPS"],
    atsKeywords: ["CDL", "DOT Compliance", "Logistics", "Vehicle Inspection"]
  },
  {
    trade: "Construction",
    credentials: ["Construction Safety Training", "OSHA 10", "OSHA 30"],
    skills: ["Jobsite Safety", "Material Handling", "Team Coordination", "Quality Control"],
    tools: ["Power Tools", "Hand Tools", "Measuring Tools"],
    atsKeywords: ["Construction", "OSHA", "Safety Procedures", "Project Support"]
  },
  {
    trade: "Pipefitter",
    credentials: ["Pipefitter Apprenticeship", "Welding or Pipefitting Certificate"],
    skills: ["Pipe Layout", "Blueprint Reading", "Fabrication", "Safety Compliance"],
    tools: ["Pipe Tools", "Welding Equipment", "Measuring Tools"],
    atsKeywords: ["Pipefitting", "Industrial Maintenance", "Blueprint Reading"]
  },
  {
    trade: "Industrial Maintenance",
    credentials: ["Industrial Maintenance Certificate", "Mechanical Systems Training"],
    skills: ["Troubleshooting", "Preventive Maintenance", "Equipment Repair", "Safety Procedures"],
    tools: ["Meters", "Hand Tools", "Power Tools", "Maintenance Systems"],
    atsKeywords: ["Industrial Maintenance", "Preventive Maintenance", "Equipment Troubleshooting"]
  }
];

const educationTypePattern =
  /high school diploma|ged|associate|bachelor|master|mba|doctorate|professional degree|community college|trade school|apprenticeship|bootcamp|military training|professional certificate|industry certification|continuing education|online course|self[- ]directed learning/i;

const educationEvidencePattern =
  /education|certification|certificate|certified|course|training|degree|school|college|university|bootcamp|diploma|license|apprenticeship|military|ged|mba|doctorate|self[- ]directed/i;

function clean(value = "") {
  return value.replace(/[.!,]+$/g, "").replace(/\s+/g, " ").trim();
}

function unique(items: string[]) {
  const seen = new Set<string>();
  return items
    .map(clean)
    .filter((item) => item.length > 1)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function titleCase(value: string) {
  const keep = new Map([
    ["ai", "AI"],
    ["ged", "GED"],
    ["mba", "MBA"],
    ["hvac", "HVAC"],
    ["cdl", "CDL"],
    ["aws", "AWS"],
    ["ccna", "CCNA"],
    ["itil", "ITIL"],
    ["pmp", "PMP"],
    ["capm", "CAPM"],
    ["cna", "CNA"],
    ["emt", "EMT"],
    ["bls", "BLS"],
    ["acls", "ACLS"],
    ["nasm", "NASM"],
    ["ace", "ACE"],
    ["issa", "ISSA"]
  ]);

  return clean(value)
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      return keep.get(lower) ?? lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ")
    .replace(/\bIt\b/g, "IT")
    .replace(/\bCpr\b/g, "CPR");
}

export function normalizeEducationEntry(value: string) {
  const trimmed = clean(value);
  if (!trimmed) return "";

  const knownMajor = degreeMajorBank.find((major) => major.toLowerCase() === trimmed.toLowerCase());
  if (knownMajor) return `Study Focus: ${knownMajor}`;

  const knownTrade = tradeEducationBank.find((trade) => trade.trade.toLowerCase() === trimmed.toLowerCase());
  if (knownTrade) return `Trade Focus: ${knownTrade.trade}`;

  const knownCertification = certificationBank.find((certification) => {
    const labels = [certification.label, ...(certification.aliases ?? [])].map((item) => item.toLowerCase());
    return labels.some((label) => trimmed.toLowerCase().includes(label));
  });
  if (knownCertification && trimmed.length <= 48) return knownCertification.label;

  return trimmed
    .split(/\s*\|\s*/)
    .map((part) => titleCase(part))
    .join(" | ")
    .replace(/\bBachelor'?s Degree\b/i, "Bachelor's Degree")
    .replace(/\bMaster'?s Degree\b/i, "Master's Degree")
    .replace(/\bSelf Directed\b/i, "Self-directed")
    .replace(/\bGoogle It Support\b/i, "Google IT Support")
    .replace(/\bAws\b/g, "AWS");
}

export function findEducationSuggestions(query: string, limit = 8) {
  const normalized = query.trim().toLowerCase();
  const suggestions = [
    ...educationTypes,
    ...degreeMajorBank,
    ...certificationBank.map((certification) => certification.label),
    ...tradeEducationBank.flatMap((trade) => [trade.trade, ...trade.credentials])
  ];

  if (!normalized) return suggestions.slice(0, limit);

  return suggestions
    .filter((item) => {
      const matchText = [
        item,
        ...certificationBank.find((certification) => certification.label === item)?.aliases ?? []
      ].join(" ");
      return matchText.toLowerCase().includes(normalized);
    })
    .slice(0, limit);
}

export function educationPromptForSelection(value: string) {
  if (/trade school|apprenticeship|electrician|plumber|hvac|welder|carpenter|machinist|auto technician|cdl|construction|pipefitter|industrial maintenance/i.test(value)) {
    return "Add trade, apprenticeship, license, or certification details if they apply.";
  }
  if (/bachelor|associate|master|mba|doctorate|professional degree|college|university/i.test(value)) {
    return "Add school, major or program, degree, and graduation year if you want them shown.";
  }
  if (/bootcamp/i.test(value)) {
    return "Add program, provider, focus, and completion year.";
  }
  if (/military/i.test(value)) {
    return "Add military training, specialty, school, or course name without overstating rank or credentials.";
  }
  if (/self[- ]directed/i.test(value)) {
    return "Add the topic you studied and the practical work or projects it supported.";
  }
  return "Add only education, training, or credentials you want shown on the resume.";
}

export function extractEducationEntries(text: string) {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(clean)
    .filter(Boolean);
  const sentenceMatches = sentences.filter((sentence) => educationEvidencePattern.test(sentence));
  const explicitClauses = [
    ...text.matchAll(/\b(?:education is|education:|studied|completed|earned|hold|have|certified in|trained in)\s+([^.;]+)/gi)
  ].map((match) => match[1]);
  const certifications = certificationBank
    .filter((certification) => {
      const labels = [certification.label, ...(certification.aliases ?? [])];
      return labels.some((label) => new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
    })
    .map((certification) => certification.label);
  const trades = tradeEducationBank
    .filter((trade) => new RegExp(`\\b${trade.trade.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text))
    .flatMap((trade) => trade.credentials.filter((credential) => new RegExp(credential.split(" ")[0], "i").test(text)).slice(0, 2));
  const typeOnly = educationTypePattern.test(text) ? text.match(educationTypePattern)?.[0] ?? "" : "";

  return unique([...explicitClauses, ...sentenceMatches, ...certifications, ...trades, typeOnly].map(normalizeEducationEntry)).slice(0, 4);
}

export function formatEducationEntries(entries: string[]) {
  return unique(entries.map(normalizeEducationEntry)).join("\n");
}

export function hasEducationEvidence(value: string) {
  return educationEvidencePattern.test(value);
}
