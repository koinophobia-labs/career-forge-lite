export type LaneBlueprint = {
  key: string;
  title: string;
  summary: string;
  whyFit: string;
  resumeAngle: string;
  proof: string[];
  gaps: string[];
  keywords: string[];
};

// Curated lanes for candidates moving from operations, customer-facing, or
// non-tech work into tech-adjacent roles. Every "why it fits" is grounded in
// transferable experience — nothing here assumes credentials the user may not have.
export const laneLibrary: LaneBlueprint[] = [
  {
    key: "ai-support-specialist",
    title: "AI Support Specialist",
    summary: "Help users of AI products succeed; triage issues, explain model behavior, escalate edge cases.",
    whyFit:
      "Customer-facing experience plus hands-on AI tool use is the core of this role. Companies shipping AI products need people who can translate between confused users and technical teams — patience and clear writing beat a CS degree here.",
    resumeAngle:
      "Frame yourself as a translator: real experience de-escalating and resolving customer issues, plus daily working fluency with AI tools. Lead bullets with issue volume, resolution quality, and written communication.",
    proof: [
      "Concrete examples of explaining something technical or confusing to a non-expert",
      "Daily/weekly AI tool workflows you actually run (prompting, automation, evaluation)",
      "Metrics from any support or service work: volume handled, satisfaction, speed",
      "A short public write-up or doc showing you can explain AI behavior clearly"
    ],
    gaps: [
      "Learn the basics of how LLMs fail (hallucination, prompt injection, context limits) and be able to discuss them plainly",
      "Get comfortable with a ticketing tool (Zendesk, Intercom) via free trials or sandbox demos",
      "Document 2–3 real troubleshooting stories in STAR format"
    ],
    keywords: ["customer support", "AI tools", "troubleshooting", "triage", "escalation", "documentation", "LLM", "prompt", "ticketing", "empathy"]
  },
  {
    key: "trust-safety-analyst",
    title: "Trust & Safety Analyst",
    summary: "Review flagged content and behavior, enforce policy, protect users and platforms.",
    whyFit:
      "Roles that required judgment calls under pressure — handling difficult customers, spotting suspicious behavior, applying rules fairly and consistently — map directly to policy enforcement work. Teams hire for judgment and consistency, then train the policy.",
    resumeAngle:
      "Emphasize consistent rule application, documentation discipline, and calm handling of conflict or gray-area situations. Show you can make defensible decisions quickly and log them accurately.",
    proof: [
      "Situations where you applied policy consistently under pressure or pushback",
      "Experience spotting and reporting fraud, theft, abuse, or unsafe behavior",
      "Accuracy or compliance metrics from any prior role",
      "Evidence of resilience: high-volume, emotionally demanding work handled reliably"
    ],
    gaps: [
      "Read 2–3 public T&S policy docs (e.g., major platform community guidelines) and practice applying them to sample cases",
      "Learn the basic vocabulary: content moderation, policy enforcement, abuse vectors, escalation paths",
      "Prepare for wellness questions — interviewers ask how you handle disturbing content"
    ],
    keywords: ["trust and safety", "content moderation", "policy enforcement", "risk", "escalation", "investigation", "judgment", "compliance", "documentation"]
  },
  {
    key: "fraud-risk-operations",
    title: "Fraud / Risk Operations",
    summary: "Investigate suspicious transactions and accounts, reduce loss, refine detection rules.",
    whyFit:
      "Cash handling, loss prevention, dispute resolution, and any work where you verified identity or caught discrepancies are the raw material of fraud ops. The job is pattern recognition plus process discipline — both learnable on the floor, both provable from operational work.",
    resumeAngle:
      "Lead with accuracy, attention to detail, and any experience catching errors or suspicious activity. Quantify what you protected: cash reconciled, discrepancies caught, disputes resolved.",
    proof: [
      "Any experience detecting or preventing loss, theft, or billing errors",
      "Reconciliation, auditing, or verification work with accuracy numbers",
      "Examples of following an investigation or escalation process end to end",
      "Comfort with spreadsheets and structured data review"
    ],
    gaps: [
      "Learn common fraud typologies (account takeover, friendly fraud, synthetic identity) from public fintech blogs",
      "Build basic spreadsheet fluency: filters, pivot tables, VLOOKUP/XLOOKUP",
      "Practice writing a short, factual case note — the daily artifact of this job"
    ],
    keywords: ["fraud", "risk", "chargeback", "investigation", "KYC", "account takeover", "reconciliation", "detection", "case management", "accuracy"]
  },
  {
    key: "community-manager",
    title: "Community Manager",
    summary: "Grow and moderate a product's community; run programs, surface feedback, set the tone.",
    whyFit:
      "If you've built rapport with regulars, defused conflicts in public, or organized people around anything, you've done community work without the title. Companies want someone users trust who can also report signal back to the product team.",
    resumeAngle:
      "Show you can hold a room: repeat relationships built, conflicts resolved publicly, events or groups organized. Pair it with writing samples — community management is a writing job.",
    proof: [
      "Any group, event, server, or audience you organized or grew (numbers help)",
      "Public writing: posts, announcements, guides, even a well-run group chat",
      "Examples of turning user complaints into concrete feedback for a team",
      "Familiarity with community platforms: Discord, Reddit, forums, social"
    ],
    gaps: [
      "Create or document one visible community artifact — a guide, an event recap, a moderation policy",
      "Learn basic community metrics: retention, engagement rate, response time",
      "Study 2–3 communities in your target lane and form opinions on what they do well"
    ],
    keywords: ["community", "engagement", "moderation", "Discord", "events", "advocacy", "feedback loop", "social media", "content", "retention"]
  },
  {
    key: "product-support-specialist",
    title: "Product Support Specialist",
    summary: "Own customer issues for a software product from first reply to resolution.",
    whyFit:
      "This is the most direct bridge from customer-facing work into a software company. The skill is the same — resolve issues, keep people calm, document clearly — the domain (a software product) is what you learn on the job.",
    resumeAngle:
      "Position every service interaction as issue resolution: diagnose, resolve, document, escalate. Quantify volume and quality. Show curiosity about how products work under the hood.",
    proof: [
      "Support/service metrics: tickets or customers per day, satisfaction, resolution rate",
      "Examples of troubleshooting methodically instead of guessing",
      "Any self-taught product or tool depth (settings, integrations, workarounds)",
      "Clear written explanations — a help-doc-style writing sample is strong proof"
    ],
    gaps: [
      "Learn one ticketing system and one help-center tool at a demo level",
      "Practice reading basic logs or error messages without panic",
      "Write two mock help-center articles for a product you know well"
    ],
    keywords: ["product support", "SaaS", "tickets", "troubleshooting", "knowledge base", "escalation", "CSAT", "onboarding", "documentation", "customer experience"]
  },
  {
    key: "qa-tester",
    title: "QA Tester",
    summary: "Find, reproduce, and document software bugs before customers do.",
    whyFit:
      "QA rewards exactly what strong operational workers have: attention to detail, process discipline, and the patience to check things others skip. Entry QA does not require coding — it requires being reliably thorough and writing reproducible bug reports.",
    resumeAngle:
      "Emphasize precision and process: checklists followed, errors caught, quality standards enforced. Show you notice what's broken and can describe it so someone else can fix it.",
    proof: [
      "Any quality-control, inspection, or checklist-driven work with error-catch examples",
      "A few real bug reports you've written (any app — write them now if needed)",
      "Methodical habits: documentation, edge-case thinking, consistency over shifts",
      "Basic familiarity with test-case structure: steps, expected vs. actual"
    ],
    gaps: [
      "Write 5 practice bug reports against a real app using steps/expected/actual format",
      "Learn what a test case, regression test, and smoke test are",
      "Explore one bug-tracking tool (Jira, Linear) at a surface level"
    ],
    keywords: ["QA", "testing", "bug report", "reproduce", "regression", "test case", "attention to detail", "edge case", "Jira", "quality"]
  },
  {
    key: "junior-product-ops",
    title: "Junior Product Ops",
    summary: "Keep a product team running: process, tooling, data hygiene, feedback triage.",
    whyFit:
      "Operations experience is the qualification — the 'product' part is context you acquire. Teams need someone who makes processes actually happen: routing feedback, maintaining docs, keeping dashboards honest, chasing loose ends.",
    resumeAngle:
      "Lead with process ownership: things you organized, systematized, or made reliable. Show you reduce chaos. Any tooling fluency (spreadsheets, docs, automation) multiplies this.",
    proof: [
      "Processes you built or fixed, with the before/after difference",
      "Cross-team coordination: keeping multiple people aligned on one outcome",
      "Spreadsheet/docs/tooling competence with concrete examples",
      "Feedback handling: collecting, organizing, and routing input to a decision"
    ],
    gaps: [
      "Learn product vocabulary: roadmap, backlog, sprint, launch checklist",
      "Build one small automation or tracker (spreadsheet or no-code) as a portfolio piece",
      "Read a few public product-ops job posts and mirror their language honestly"
    ],
    keywords: ["product operations", "process", "coordination", "backlog", "triage", "documentation", "tooling", "spreadsheets", "stakeholders", "launch"]
  },
  {
    key: "customer-success",
    title: "Customer Success",
    summary: "Own ongoing customer relationships for a product; drive adoption, renewal, and expansion.",
    whyFit:
      "Repeat-customer relationships, upselling honestly, and keeping people happy over time is customer success — retail and service work builds this daily. CS teams hire relationship skill and train the product.",
    resumeAngle:
      "Frame around retention and relationships: customers who came back because of you, problems solved before they became complaints, revenue you influenced. Show proactive habits, not just reactive service.",
    proof: [
      "Repeat business or loyalty you personally drove, with numbers where possible",
      "Proactive saves: spotting an unhappy customer and turning it around",
      "Revenue influence: upsells, renewals, referrals",
      "Organized follow-through: CRM-like habits even without a CRM"
    ],
    gaps: [
      "Learn CS vocabulary: onboarding, adoption, QBR, churn, NRR, health score",
      "Get demo-level familiarity with a CRM (HubSpot free tier works)",
      "Prepare 2–3 stories of turning a detractor into a promoter"
    ],
    keywords: ["customer success", "retention", "onboarding", "adoption", "renewal", "churn", "relationship", "CRM", "upsell", "health score"]
  },
  {
    key: "technical-support",
    title: "Technical Support",
    summary: "Diagnose and resolve technical issues for users; the deepest end of the support pool.",
    whyFit:
      "If you're the person friends and coworkers ask when technology breaks, this lane converts that instinct into a title. It values systematic diagnosis and calm communication over formal credentials, and it's a proven entry point into IT, QA, and engineering-adjacent tracks.",
    resumeAngle:
      "Highlight every instance of technical troubleshooting, however informal: systems fixed, workarounds found, tools mastered without training. Pair with service metrics to show you can do it at volume, with people watching.",
    proof: [
      "Real troubleshooting stories with a diagnosis process, not just outcomes",
      "Self-taught technical depth: hardware, software, networks, automations",
      "Service-under-pressure metrics from any customer-facing role",
      "Home-lab, side-project, or volunteer IT work of any size"
    ],
    gaps: [
      "Study structured troubleshooting frameworks (isolate, reproduce, escalate)",
      "Consider CompTIA A+ material — even without the exam, the vocabulary matters",
      "Practice explaining one technical fix at three levels: expert, coworker, grandparent"
    ],
    keywords: ["technical support", "troubleshooting", "diagnosis", "hardware", "software", "networking", "escalation", "SLA", "remote support", "root cause"]
  }
];

export function getLaneBlueprint(key: string): LaneBlueprint | undefined {
  return laneLibrary.find((lane) => lane.key === key);
}
