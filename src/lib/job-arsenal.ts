import type { RoleFamily } from "@/types/career";

export type JobArsenal = {
  title: string;
  family: RoleFamily;
  aliases?: string[];
  responsibilities: string[];
  skills: string[];
  workflows: string[];
  atsKeywords: string[];
  tools: string[];
  measurableActivities: string[];
  domainLanguage: string[];
};

type ArsenalSeed = {
  title: string;
  family: RoleFamily;
  aliases?: string[];
  profile: keyof typeof arsenalProfiles;
  responsibilities?: string[];
  skills?: string[];
  workflows?: string[];
  atsKeywords?: string[];
  tools?: string[];
  measurableActivities?: string[];
  domainLanguage?: string[];
};

const arsenalProfiles = {
  customer: {
    responsibilities: ["Customer communication", "Issue resolution", "Escalation handling", "Account support", "Follow-up communication", "Record keeping"],
    skills: ["Service follow-through", "Client communication", "Documentation", "Problem solving", "Customer education", "Attention to detail"],
    workflows: ["Support request intake", "Customer follow-up", "Case documentation", "Issue escalation", "Knowledge base lookup", "Service handoff"],
    atsKeywords: ["Customer Support", "Customer Success", "Client Services", "CRM", "Retention Support", "Service Quality"],
    tools: ["Salesforce", "HubSpot", "Zendesk", "Intercom", "Google Workspace", "Slack"],
    measurableActivities: ["Customers supported", "Tickets handled", "Calls handled", "Follow-ups completed", "Account updates documented"],
    domainLanguage: ["customer experience", "client follow-through", "service expectations", "account context"]
  },
  sportsbook: {
    responsibilities: ["Cash handling", "Transaction accuracy", "Customer dispute resolution", "Identity verification", "Policy enforcement", "Customer education"],
    skills: ["High-volume customer interactions", "Compliance-aware service", "Operational accuracy", "De-escalation", "Record keeping", "Payment processing"],
    workflows: ["Wagering transaction intake", "Shift balancing", "Payment processing", "Customer issue escalation", "Responsible gaming checks", "Transaction record review"],
    atsKeywords: ["Cash Handling", "Transaction Accuracy", "Customer Service", "Compliance", "Payment Processing", "Escalation Handling"],
    tools: ["POS Systems", "Cash Drawer", "Payment Systems", "Excel", "Internal Ticketing Systems", "ID Verification Systems"],
    measurableActivities: ["Transactions processed", "Customers served", "Cash handled", "Shift reports completed", "Disputes escalated"],
    domainLanguage: ["high-volume gaming environment", "responsible gaming compliance", "ticket handling", "transaction records"]
  },
  security: {
    responsibilities: ["Incident reporting", "Access control", "Visitor management", "Emergency response", "Safety inspections", "Policy enforcement"],
    skills: ["De-escalation", "Conflict resolution", "Radio communication", "Compliance awareness", "Observation", "Calm communication"],
    workflows: ["Patrol documentation", "Visitor check-in", "Incident escalation", "Shift handoff", "Access log review", "Emergency response coordination"],
    atsKeywords: ["Access Control", "Incident Reporting", "Visitor Management", "Safety Procedures", "Emergency Response", "Compliance"],
    tools: ["Incident Reports", "Access Control System", "Radio Systems", "Surveillance Cameras", "CCTV Systems", "Microsoft Teams"],
    measurableActivities: ["Visitors assisted", "Incident reports completed", "Patrols completed", "Calls handled", "Sites monitored"],
    domainLanguage: ["safety-focused environment", "public-facing security", "site procedures", "compliance-aware operations"]
  },
  retail: {
    responsibilities: ["Customer service", "POS transactions", "Returns processing", "Inventory support", "Merchandising", "Stock replenishment"],
    skills: ["Transaction accuracy", "Customer education", "Upselling", "Store presentation", "Product knowledge", "Issue resolution"],
    workflows: ["Checkout support", "Return or exchange processing", "Inventory counts", "Shelf stocking", "Customer request handling", "Store opening or closing tasks"],
    atsKeywords: ["POS Systems", "Cash Handling", "Inventory", "Customer Service", "Merchandising", "Sales Support"],
    tools: ["POS Systems", "Inventory Systems", "RF Scanners", "Zebra Scanners", "Shopify POS", "Square"],
    measurableActivities: ["Customers served", "Transactions processed", "Returns handled", "Inventory counts completed", "Displays maintained"],
    domainLanguage: ["fast-paced retail environment", "store operations", "transaction accuracy", "customer-facing service"]
  },
  admin: {
    responsibilities: ["Calendar management", "Scheduling", "Documentation", "Meeting coordination", "Office support", "Data entry"],
    skills: ["Records accuracy", "Professional communication", "Organization", "Prioritization", "Confidentiality", "Follow-through"],
    workflows: ["Calendar coordination", "Meeting preparation", "File maintenance", "Email correspondence", "Vendor communication", "Document routing"],
    atsKeywords: ["Administrative Support", "Scheduling", "Data Entry", "Records Management", "Office Coordination", "Documentation"],
    tools: ["Google Workspace", "Microsoft Office", "Excel", "Outlook", "Calendly", "DocuSign"],
    measurableActivities: ["Calendars managed", "Records updated", "Meetings coordinated", "Reports prepared", "Requests handled"],
    domainLanguage: ["office workflows", "administrative requests", "records management", "cross-team support"]
  },
  operations: {
    responsibilities: ["Task coordination", "Process improvement", "Reporting", "Scheduling", "SOP support", "Inventory coordination"],
    skills: ["Operational accuracy", "Workflow coordination", "Process documentation", "Problem solving", "Cross-functional communication", "Follow-through"],
    workflows: ["Task tracking", "Shift or schedule coordination", "Report maintenance", "SOP updates", "Issue escalation", "Handoff coordination"],
    atsKeywords: ["Operations", "Process Improvement", "Reporting", "SOP", "Scheduling", "Workflow Coordination"],
    tools: ["Excel", "Google Sheets", "Notion", "Airtable", "SAP", "Oracle"],
    measurableActivities: ["Workflows supported", "Reports created", "Schedules coordinated", "Team members supported", "Orders or requests handled"],
    domainLanguage: ["daily operations", "process consistency", "task flow", "operational handoffs"]
  },
  sales: {
    responsibilities: ["Prospecting", "Lead generation", "Follow-up communication", "CRM updates", "Pipeline support", "Customer outreach"],
    skills: ["Account research", "Relationship building", "Clear communication", "Persistence", "Pipeline organization", "Sales coordination"],
    workflows: ["Lead list building", "CRM note updates", "Outbound follow-up", "Prospect research", "Meeting scheduling", "Account handoff"],
    atsKeywords: ["Sales Development", "Lead Generation", "CRM", "Pipeline", "Prospecting", "Outbound"],
    tools: ["Salesforce", "HubSpot", "Outreach", "Salesloft", "Apollo", "LinkedIn Sales Navigator"],
    measurableActivities: ["Prospects contacted", "Follow-ups completed", "CRM records updated", "Meetings scheduled", "Pipeline supported"],
    domainLanguage: ["sales pipeline", "prospect engagement", "account context", "revenue support"]
  },
  project: {
    responsibilities: ["Timeline tracking", "Status reporting", "Documentation", "Meeting coordination", "Stakeholder communication", "Milestone tracking"],
    skills: ["Cross-functional communication", "Organization", "Risk tracking", "Follow-through", "Detail management", "Prioritization"],
    workflows: ["Status update preparation", "Meeting note capture", "Timeline maintenance", "Action item tracking", "Stakeholder follow-up", "Project handoff"],
    atsKeywords: ["Project Coordination", "Status Reporting", "Documentation", "Milestones", "Stakeholder Communication", "Timeline Tracking"],
    tools: ["Asana", "Trello", "Monday.com", "Jira", "Google Sheets", "Slack"],
    measurableActivities: ["Projects supported", "Meetings coordinated", "Status reports created", "Milestones tracked", "Stakeholders supported"],
    domainLanguage: ["project timelines", "delivery coordination", "cross-functional support", "project visibility"]
  },
  it: {
    responsibilities: ["Ticket resolution", "Troubleshooting", "User support", "Documentation", "Software installation", "Escalation handling"],
    skills: ["Technical communication", "Root cause investigation", "Customer service", "Knowledge base documentation", "Issue triage", "System support"],
    workflows: ["Ticket intake", "Password resets", "Hardware support", "Software setup", "Issue escalation", "Resolution documentation"],
    atsKeywords: ["Help Desk", "IT Support", "Troubleshooting", "Ticketing", "Active Directory", "User Support"],
    tools: ["ServiceNow", "Jira", "Active Directory", "Windows", "macOS", "Office 365"],
    measurableActivities: ["Tickets resolved", "Users supported", "Password resets completed", "Escalations routed", "Knowledge notes created"],
    domainLanguage: ["technical support", "user service", "ticket resolution", "support documentation"]
  },
  business: {
    responsibilities: ["Reporting", "Analysis", "Documentation", "Stakeholder support", "Process improvement", "Data quality review"],
    skills: ["Analytical thinking", "Business communication", "Process documentation", "Data accuracy", "Research", "Operational insight"],
    workflows: ["Report preparation", "Data review", "Stakeholder updates", "Process mapping", "Research summaries", "Dashboard maintenance"],
    atsKeywords: ["Business Analysis", "Reporting", "Data Analysis", "Stakeholder Support", "Process Improvement", "Documentation"],
    tools: ["Excel", "Google Sheets", "SQL", "Tableau", "Power BI", "Looker"],
    measurableActivities: ["Reports created", "Datasets reviewed", "Stakeholders supported", "Processes documented", "Dashboards updated"],
    domainLanguage: ["business operations", "reporting context", "operational insight", "stakeholder visibility"]
  },
  tech: {
    responsibilities: ["Testing", "Documentation", "Tool support", "Implementation support", "Data handling", "Issue tracking"],
    skills: ["Technical documentation", "Quality assurance", "Product thinking", "Problem solving", "Workflow testing", "Detail accuracy"],
    workflows: ["Bug reporting", "Test case review", "Implementation checklist support", "Technical note updates", "Tool configuration", "Data validation"],
    atsKeywords: ["QA", "Implementation", "Product Operations", "Technical Support", "Issue Tracking", "Documentation"],
    tools: ["Jira", "GitHub", "Postman", "VS Code", "SQL", "Figma"],
    measurableActivities: ["Tests completed", "Issues documented", "Implementations supported", "Records updated", "Workflows reviewed"],
    domainLanguage: ["technical workflows", "implementation support", "product operations", "quality review"]
  }
};

function mergeUnique(...groups: Array<string[] | undefined>) {
  const seen = new Set<string>();
  return groups
    .flatMap((group) => group ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function createArsenal(seed: ArsenalSeed): JobArsenal {
  const profile = arsenalProfiles[seed.profile];
  return {
    title: seed.title,
    family: seed.family,
    aliases: seed.aliases,
    responsibilities: mergeUnique(seed.responsibilities, profile.responsibilities),
    skills: mergeUnique(seed.skills, profile.skills),
    workflows: mergeUnique(seed.workflows, profile.workflows),
    atsKeywords: mergeUnique(seed.atsKeywords, profile.atsKeywords),
    tools: mergeUnique(seed.tools, profile.tools),
    measurableActivities: mergeUnique(seed.measurableActivities, profile.measurableActivities),
    domainLanguage: mergeUnique(seed.domainLanguage, profile.domainLanguage)
  };
}

const seeds: ArsenalSeed[] = [
  { title: "Sportsbook Ticket Writer", family: "Customer Success", profile: "sportsbook", aliases: ["ticket writer", "sportsbook writer"] },
  { title: "Sportsbook Supervisor", family: "Operations", profile: "sportsbook", aliases: ["sportsbook lead"], responsibilities: ["Shift coordination", "Team communication"], skills: ["Team support", "Operational oversight"], workflows: ["Shift handoff", "Cash drawer review"] },
  { title: "Security Officer", family: "Security", profile: "security" },
  { title: "Security Guard", family: "Security", profile: "security" },
  { title: "Public Safety Officer", family: "Security", profile: "security" },
  { title: "Loss Prevention Associate", family: "Security", profile: "security", responsibilities: ["Asset protection", "Store patrols"], skills: ["Theft prevention"] },
  { title: "Retail Associate", family: "Customer Success", profile: "retail" },
  { title: "Cashier", family: "Customer Success", profile: "retail", responsibilities: ["Cash handling", "Checkout support"] },
  { title: "Sales Associate", family: "Sales", profile: "retail", responsibilities: ["Product education", "Upselling"], skills: ["Customer needs discovery"] },
  { title: "Store Associate", family: "Operations", profile: "retail" },
  { title: "Administrative Assistant", family: "Admin", profile: "admin" },
  { title: "Administrative Coordinator", family: "Admin", profile: "admin" },
  { title: "Office Coordinator", family: "Admin", profile: "admin" },
  { title: "Front Desk Coordinator", family: "Admin", profile: "admin", responsibilities: ["Visitor greeting", "Call routing"] },
  { title: "Receptionist", family: "Admin", profile: "admin", responsibilities: ["Call routing", "Visitor support"] },
  { title: "Executive Assistant", family: "Admin", profile: "admin", responsibilities: ["Executive calendar support", "Travel coordination"] },
  { title: "Records Coordinator", family: "Admin", profile: "admin", responsibilities: ["Records management", "File audits"] },
  { title: "Data Entry Specialist", family: "Admin", profile: "admin", skills: ["Data accuracy", "Typing accuracy"] },
  { title: "Office Assistant", family: "Admin", profile: "admin" },
  { title: "Program Assistant", family: "Admin", profile: "admin" },
  { title: "Operations Assistant", family: "Admin", profile: "admin" },
  { title: "Scheduling Assistant", family: "Admin", profile: "admin", responsibilities: ["Schedule coordination"] },
  { title: "Operations Associate", family: "Operations", profile: "operations" },
  { title: "Operations Coordinator", family: "Operations", profile: "operations" },
  { title: "Business Operations Associate", family: "Operations", profile: "operations" },
  { title: "Logistics Coordinator", family: "Operations", profile: "operations", responsibilities: ["Shipment coordination", "Delivery tracking"], tools: ["WMS", "ShipStation"] },
  { title: "Fulfillment Coordinator", family: "Operations", profile: "operations", responsibilities: ["Order fulfillment", "Inventory checks"], tools: ["WMS", "RF Scanners"] },
  { title: "Warehouse Operations Coordinator", family: "Operations", profile: "operations", responsibilities: ["Warehouse task coordination", "Inventory movement"], tools: ["WMS", "Zebra Scanners"] },
  { title: "Workforce Coordinator", family: "Operations", profile: "operations", responsibilities: ["Staffing coordination", "Schedule coverage"], tools: ["UKG", "Kronos"] },
  { title: "Scheduling Coordinator", family: "Operations", profile: "operations" },
  { title: "Process Coordinator", family: "Operations", profile: "operations" },
  { title: "Inventory Coordinator", family: "Operations", profile: "operations", responsibilities: ["Inventory counts", "Stock reconciliation"], tools: ["Inventory Systems", "RF Scanners"] },
  { title: "Service Operations Associate", family: "Operations", profile: "operations" },
  { title: "Retail Operations Associate", family: "Operations", profile: "retail" },
  { title: "Customer Success Associate", family: "Customer Success", profile: "customer" },
  { title: "Customer Success Specialist", family: "Customer Success", profile: "customer" },
  { title: "Customer Support Specialist", family: "Customer Success", profile: "customer" },
  { title: "Customer Experience Associate", family: "Customer Success", profile: "customer" },
  { title: "Client Services Associate", family: "Customer Success", profile: "customer" },
  { title: "Client Services Coordinator", family: "Customer Success", profile: "customer" },
  { title: "Member Services Representative", family: "Customer Success", profile: "customer" },
  { title: "Onboarding Specialist", family: "Customer Success", profile: "customer", responsibilities: ["Customer onboarding", "Training walkthroughs"] },
  { title: "Account Coordinator", family: "Customer Success", profile: "customer", responsibilities: ["Account updates", "Client follow-up"] },
  { title: "Support Specialist", family: "Customer Success", profile: "customer" },
  { title: "Customer Care Specialist", family: "Customer Success", profile: "customer" },
  { title: "Client Support Representative", family: "Customer Success", profile: "customer" },
  { title: "Sales Development Representative", family: "Sales", profile: "sales" },
  { title: "Business Development Representative", family: "Sales", profile: "sales" },
  { title: "Sales Coordinator", family: "Sales", profile: "sales" },
  { title: "Account Representative", family: "Sales", profile: "sales" },
  { title: "Inside Sales Representative", family: "Sales", profile: "sales" },
  { title: "Lead Generation Specialist", family: "Sales", profile: "sales" },
  { title: "Account Associate", family: "Sales", profile: "sales" },
  { title: "Sales Support Specialist", family: "Sales", profile: "sales" },
  { title: "Client Relations Associate", family: "Sales", profile: "sales" },
  { title: "Retail Sales Associate", family: "Sales", profile: "retail" },
  { title: "Business Analyst", family: "Business", profile: "business" },
  { title: "Junior Business Analyst", family: "Business", profile: "business" },
  { title: "Operations Analyst", family: "Business", profile: "business" },
  { title: "Process Analyst", family: "Business", profile: "business" },
  { title: "Strategy Associate", family: "Business", profile: "business" },
  { title: "Program Associate", family: "Business", profile: "business" },
  { title: "Reporting Analyst", family: "Business", profile: "business" },
  { title: "Data Analyst Associate", family: "Business", profile: "business" },
  { title: "Business Support Specialist", family: "Business", profile: "business" },
  { title: "Research Associate", family: "Business", profile: "business" },
  { title: "Project Coordinator", family: "Project Coordination", profile: "project" },
  { title: "Project Administrator", family: "Project Coordination", profile: "project" },
  { title: "Program Coordinator", family: "Project Coordination", profile: "project" },
  { title: "Implementation Coordinator", family: "Project Coordination", profile: "project" },
  { title: "PMO Coordinator", family: "Project Coordination", profile: "project" },
  { title: "Project Support Specialist", family: "Project Coordination", profile: "project" },
  { title: "Delivery Coordinator", family: "Project Coordination", profile: "project" },
  { title: "Operations Project Coordinator", family: "Project Coordination", profile: "project" },
  { title: "Client Implementation Coordinator", family: "Project Coordination", profile: "project" },
  { title: "Project Assistant", family: "Project Coordination", profile: "project" },
  { title: "Help Desk Technician", family: "IT Support", profile: "it" },
  { title: "IT Support Specialist", family: "IT Support", profile: "it" },
  { title: "Technical Support Representative", family: "IT Support", profile: "it" },
  { title: "Desktop Support Technician", family: "IT Support", profile: "it" },
  { title: "Service Desk Analyst", family: "IT Support", profile: "it" },
  { title: "Support Technician", family: "IT Support", profile: "it" },
  { title: "Field Support Technician", family: "IT Support", profile: "it" },
  { title: "IT Coordinator", family: "IT Support", profile: "it" },
  { title: "Systems Support Associate", family: "IT Support", profile: "it" },
  { title: "User Support Specialist", family: "IT Support", profile: "it" },
  { title: "QA Tester", family: "Tech", profile: "tech" },
  { title: "Junior QA Analyst", family: "Tech", profile: "tech" },
  { title: "Manual QA Tester", family: "Tech", profile: "tech" },
  { title: "Product Operations Associate", family: "Tech", profile: "tech" },
  { title: "Technical Operations Associate", family: "Tech", profile: "tech" },
  { title: "Implementation Specialist", family: "Tech", profile: "tech" },
  { title: "Data Associate", family: "Tech", profile: "tech" },
  { title: "Product Support Specialist", family: "Tech", profile: "tech" },
  { title: "Junior Product Analyst", family: "Tech", profile: "tech" },
  { title: "Technical Support Specialist", family: "Tech", profile: "it" }
];

export const jobArsenals: JobArsenal[] = seeds.map(createArsenal);

export function findJobArsenal(title: string) {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return null;
  return (
    jobArsenals.find((arsenal) => arsenal.title.toLowerCase() === normalized) ??
    jobArsenals.find((arsenal) => arsenal.aliases?.some((alias) => alias.toLowerCase() === normalized)) ??
    null
  );
}

export function getExperienceArsenal(titles: string[]) {
  const matches = titles.map(findJobArsenal).filter(Boolean) as JobArsenal[];
  if (!matches.length) return null;
  const primary = matches[0];
  return {
    title: primary.title,
    family: primary.family,
    responsibilities: mergeUnique(...matches.map((match) => match.responsibilities)).slice(0, 12),
    skills: mergeUnique(...matches.map((match) => match.skills)).slice(0, 12),
    workflows: mergeUnique(...matches.map((match) => match.workflows)).slice(0, 12),
    atsKeywords: mergeUnique(...matches.map((match) => match.atsKeywords)).slice(0, 12),
    tools: mergeUnique(...matches.map((match) => match.tools)).slice(0, 10),
    measurableActivities: mergeUnique(...matches.map((match) => match.measurableActivities)).slice(0, 10),
    domainLanguage: mergeUnique(...matches.map((match) => match.domainLanguage)).slice(0, 10)
  };
}
