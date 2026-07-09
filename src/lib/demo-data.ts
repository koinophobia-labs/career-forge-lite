import { getLaneBlueprint } from "@/lib/lane-library";
import type { ApplicationRecord, CommandCenterState, OutreachContact, TargetLane } from "@/types/command-center";

// A complete sample job-search campaign so a visitor can tour the command
// center before entering anything. Entirely fictional persona ("Jordan
// Avery" — example.com contacts only); every id carries the demo- prefix so
// demo state is detectable and clearable without a schema change.

const DEMO_PREFIX = "demo-";

function daysFrom(nowIso: string, days: number): string {
  const date = new Date(nowIso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function demoLane(key: string, id: string, createdAt: string): TargetLane | null {
  const blueprint = getLaneBlueprint(key);
  if (!blueprint) return null;
  return {
    id,
    title: blueprint.title,
    status: "active",
    whyFit: blueprint.whyFit,
    resumeAngle: blueprint.resumeAngle,
    proof: [...blueprint.proof],
    gaps: [...blueprint.gaps],
    keywords: [...blueprint.keywords],
    source: "library",
    createdAt
  };
}

export function buildDemoState(nowIso: string): CommandCenterState {
  const start = daysFrom(nowIso, -12);
  const supportLane = demoLane("product-support-specialist", `${DEMO_PREFIX}lane-support`, start);
  const csLane = demoLane("customer-success", `${DEMO_PREFIX}lane-cs`, start);
  const lanes = [supportLane, csLane].filter((lane): lane is TargetLane => lane !== null);

  const applications: ApplicationRecord[] = [
    {
      id: `${DEMO_PREFIX}app-1`,
      company: "Brightline Software",
      roleTitle: "Product Support Specialist",
      laneId: supportLane?.id ?? null,
      status: "applied",
      jobPostUrl: "https://example.com/jobs/product-support-specialist",
      resumeVersionId: null,
      appliedAt: daysFrom(nowIso, -6),
      nextFollowUpAt: daysFrom(nowIso, -1),
      followUpsSent: [],
      interviewAt: null,
      notes: "Referred by a former coworker; emphasized ticket-volume experience.",
      analysisKeywords: ["customer support", "troubleshooting", "ticketing", "documentation"],
      analysisGaps: ["2+ years of SaaS support experience"],
      analysisWeakSpots: ["The post emphasizes \"zendesk\" — not in your profile yet."],
      packResumeId: null,
      briefText:
        "MATCH BRIEF — Product Support Specialist at Brightline Software\nMatch strength: STRONG — You directly cover 5 of 8 stated requirements.\n(Sample brief: in a real campaign the full analysis is saved here at apply time.)",
      outreachMessage:
        "Hi [Name] — I just applied for the Product Support Specialist opening at Brightline Software.\n\nQuick reason to pull my application out of the pile: my troubleshooting experience maps directly to your requirements.\n\nI know you're busy; even a \"we saw it\" would be appreciated. Thanks either way.",
      createdAt: daysFrom(nowIso, -6)
    },
    {
      id: `${DEMO_PREFIX}app-2`,
      company: "Harborview Health",
      roleTitle: "Customer Success Associate",
      laneId: csLane?.id ?? null,
      status: "interviewing",
      jobPostUrl: "https://example.com/jobs/customer-success-associate",
      resumeVersionId: null,
      appliedAt: daysFrom(nowIso, -10),
      nextFollowUpAt: null,
      followUpsSent: [daysFrom(nowIso, -5)],
      interviewAt: daysFrom(nowIso, 2),
      notes: "First-round screen went well; panel interview scheduled.",
      analysisKeywords: ["customer success", "onboarding", "retention", "crm"],
      analysisGaps: [],
      analysisWeakSpots: [],
      packResumeId: null,
      briefText:
        "MATCH BRIEF — Customer Success Associate at Harborview Health\nMatch strength: MODERATE — You cover 3 of 7 stated requirements outright and 2 partially.\n(Sample brief.)",
      outreachMessage: "Hi [Name] — thank you for the conversation today. Looking forward to next steps.",
      createdAt: daysFrom(nowIso, -10)
    },
    {
      id: `${DEMO_PREFIX}app-3`,
      company: "Northstar Logistics",
      roleTitle: "Support Specialist",
      laneId: supportLane?.id ?? null,
      status: "drafting",
      jobPostUrl: "",
      resumeVersionId: null,
      appliedAt: null,
      nextFollowUpAt: null,
      followUpsSent: [],
      interviewAt: null,
      notes: "Post analyzed; still tightening the outreach message before applying.",
      analysisKeywords: ["technical support", "sla", "escalation"],
      analysisGaps: ["Experience with enterprise SLAs"],
      analysisWeakSpots: [],
      packResumeId: null,
      briefText: "",
      outreachMessage: "",
      createdAt: daysFrom(nowIso, -2)
    }
  ];

  const outreach: OutreachContact[] = [
    {
      id: `${DEMO_PREFIX}contact-1`,
      name: "Sam Rivera",
      company: "Brightline Software",
      role: "Support Team Lead",
      channel: "linkedin",
      status: "sent",
      laneId: supportLane?.id ?? null,
      lastContactedAt: daysFrom(nowIso, -5),
      nextFollowUpAt: daysFrom(nowIso, 0),
      followUpCount: 0,
      notes: "Hiring manager for the open req; message sent after applying.",
      createdAt: daysFrom(nowIso, -5)
    },
    {
      id: `${DEMO_PREFIX}contact-2`,
      name: "Priya Shah",
      company: "Harborview Health",
      role: "CS Manager",
      channel: "referral",
      status: "replied",
      laneId: csLane?.id ?? null,
      lastContactedAt: daysFrom(nowIso, -7),
      nextFollowUpAt: null,
      followUpCount: 1,
      notes: "Replied warmly; flagged my application to the recruiter.",
      createdAt: daysFrom(nowIso, -9)
    }
  ];

  return {
    version: 1,
    profile: {
      currentSituation:
        "Demo persona: Jordan Avery — four years of retail service work, moving into software support roles.",
      targetRoles: "Product Support Specialist, Customer Success Associate",
      transferableSkills: ["de-escalation", "troubleshooting", "written communication", "queue management"],
      experienceSummary: "Four years of high-volume, customer-facing retail work with consistent service metrics.",
      strengths: ["calm under pressure", "methodical"],
      constraints: "Remote or Chicago-area hybrid.",
      workStyle: "Steady, documented, follow-through-heavy.",
      proofPoints:
        "Handled 60+ customer interactions a day with a 95% satisfaction score.\nWrote the store's returns troubleshooting checklist still in use.",
      updatedAt: start
    },
    lanes,
    applications,
    outreach,
    resumeVersions: []
  };
}

// Demo state is detectable by its id prefix — no schema flag needed, so real
// data (which uses createId()'s timestamp ids) can never be misdetected.
export function isDemoState(state: CommandCenterState): boolean {
  return (
    state.lanes.some((lane) => lane.id.startsWith(DEMO_PREFIX)) ||
    state.applications.some((app) => app.id.startsWith(DEMO_PREFIX))
  );
}
