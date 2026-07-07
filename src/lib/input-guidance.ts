import type { ApplicationRecord, CareerProfile } from "@/types/command-center";
import type { PrepCategory } from "@/lib/interview-prep";

// ---------------------------------------------------------------------------
// Composition helpers: quick-pick chips flow into stored fields as clean human
// language — full sentences and readable lines, never tag soup.
// ---------------------------------------------------------------------------

export function appendSentence(existing: string, phrase: string): string {
  const clean = phrase.trim().replace(/[.;,]\s*$/, "");
  if (!clean) return existing;
  const base = existing.trim();
  if (base.toLowerCase().includes(clean.toLowerCase())) return existing;
  if (!base) return `${clean}.`;
  const separator = /[.!?]$/.test(base) ? " " : ". ";
  return `${base}${separator}${clean}.`;
}

export function appendLine(existing: string, phrase: string): string {
  const clean = phrase.trim().replace(/[.;]\s*$/, "");
  if (!clean) return existing;
  const base = existing.trim();
  const alreadyThere = base
    .split(/\r?\n/)
    .some((line) => line.trim().toLowerCase() === clean.toLowerCase() || line.toLowerCase().includes(clean.toLowerCase()));
  if (alreadyThere) return existing;
  return base ? `${base}\n${clean}` : clean;
}

export function mergeChips(existing: string[], additions: string[]): string[] {
  const merged = [...existing];
  for (const addition of additions) {
    const clean = addition.trim();
    if (clean && !merged.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      merged.push(clean);
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Quick-pick phrase banks. Every phrase is a complete, honest, first-person
// statement a career changer could truthfully select — no numbers, employers,
// or credentials are ever baked in.
// ---------------------------------------------------------------------------

export const situationPhrases: string[] = [
  "I'm transitioning from sportsbook operations into fraud/risk, trust and safety, product support, or AI support",
  "I'm moving from customer-facing work into tech-adjacent roles",
  "I'm coming from operations into product support, QA, or product ops",
  "I'm building software products on the side while looking for a salaried role",
  "I'm searching full-time after a layoff",
  "I'm employed but quietly looking to change fields"
];

export const targetRolePhrases: string[] = [
  "AI Support Specialist",
  "Trust & Safety Analyst",
  "Fraud / Risk Operations",
  "Product Support Specialist",
  "QA Tester",
  "Customer Success",
  "Community Manager",
  "Technical Support",
  "Junior Product Ops"
];

export const constraintPhrases: string[] = [
  "I need a salaried role with benefits",
  "Remote or hybrid strongly preferred",
  "I need room to keep building my own product outside work hours",
  "I can start immediately",
  "Location-bound — not able to relocate",
  "Open to contract-to-hire if it converts"
];

export const workStylePhrases: string[] = [
  "I work best with clear goals and independent execution",
  "I'm comfortable in high-volume, high-pressure environments",
  "I'm async-friendly and strong in written communication",
  "I like structured process, with room to improve it",
  "I stay steady under escalation and conflict",
  "I learn fastest by doing, then documenting what I learned"
];

export const proofPointPhrases: string[] = [
  "Shipped a product to TestFlight and ran real user feedback loops",
  "Built AI and prompt workflows I use every day",
  "Handled high-pressure customer escalations and policy enforcement",
  "Managed payments, tickets, and payout disputes under strict rules",
  "Made responsible-gaming-adjacent judgment calls with real customers",
  "Ran QA-style testing passes on my own product before release",
  "Trained and onboarded new team members",
  "Wrote documentation or procedures other people still use"
];

export const strengthPhrases: string[] = [
  "user judgment",
  "fast learning",
  "calm communication",
  "pattern recognition",
  "product feedback instincts",
  "calm under pressure",
  "reliable follow-through",
  "clear writing",
  "de-escalation",
  "systems thinking"
];

export const skillPhrases: string[] = [
  "customer communication",
  "de-escalation",
  "policy enforcement",
  "payments and payouts handling",
  "fraud spotting",
  "responsible gaming awareness",
  "escalation handling",
  "risk-based judgment",
  "troubleshooting",
  "written documentation",
  "AI tools (daily use)",
  "prompt workflows",
  "user feedback triage",
  "QA-style testing",
  "spreadsheets",
  "training new hires",
  "process improvement",
  "attention to detail"
];

export const relationshipPhrases: Array<{ key: string; label: string; note: string; templateKey: string }> = [
  {
    key: "cold",
    label: "Never spoken — cold",
    note: "We've never spoken; this is cold outreach.",
    templateKey: "recruiter_intro"
  },
  {
    key: "applied",
    label: "Recruiter/HM at a company I applied to",
    note: "They work at a company where I have an active application.",
    templateKey: "hiring_manager"
  },
  {
    key: "warm",
    label: "Loose connection",
    note: "We're loosely connected — mutual community, past interaction, or shared contact.",
    templateKey: "referral_request"
  },
  {
    key: "peer",
    label: "Doing the job I want",
    note: "They're doing the role I'm targeting; I want insight, not a favor.",
    templateKey: "informational"
  },
  {
    key: "known",
    label: "I actually know them",
    note: "We know each other; a referral ask is reasonable.",
    templateKey: "referral_request"
  }
];

// ---------------------------------------------------------------------------
// Starter packs: one-click honest seeds for common transition backgrounds.
// Deliberately number-free — users add their own real metrics.
// ---------------------------------------------------------------------------

export type StarterPack = {
  key: string;
  label: string;
  situation: string;
  experienceSeed: string;
  skills: string[];
  strengths: string[];
  proofLines: string[];
};

export const starterPacks: StarterPack[] = [
  {
    key: "sportsbook",
    label: "Sportsbook operations",
    situation: "I'm transitioning from sportsbook operations into fraud/risk, trust and safety, product support, or AI support",
    experienceSeed:
      "Sportsbook operations: high-pressure customer situations, policy enforcement, payments and tickets, escalations, and responsible-gaming-adjacent judgment calls",
    skills: ["policy enforcement", "payments and payouts handling", "escalation handling", "risk-based judgment", "responsible gaming awareness"],
    strengths: ["user judgment", "calm under pressure", "pattern recognition"],
    proofLines: [
      "Handled high-pressure customer situations and payout disputes under strict rules",
      "Enforced house policy consistently, including with angry customers",
      "Made responsible-gaming-adjacent judgment calls with real customers"
    ]
  },
  {
    key: "fraud_risk",
    label: "Fraud / risk",
    situation: "I'm coming from fraud- and risk-adjacent work and targeting fraud operations, trust and safety, or payments roles",
    experienceSeed:
      "Fraud/risk-adjacent work: spotting suspicious behavior, verifying identity, catching discrepancies, and documenting decisions",
    skills: ["fraud spotting", "risk-based judgment", "attention to detail", "written documentation"],
    strengths: ["pattern recognition", "reliable follow-through"],
    proofLines: [
      "Caught discrepancies or suspicious activity others missed",
      "Documented decisions so someone else could act on them"
    ]
  },
  {
    key: "responsible_gaming",
    label: "Responsible gaming",
    situation: "My background includes responsible-gaming judgment, and I'm targeting trust and safety or risk operations",
    experienceSeed:
      "Responsible-gaming-adjacent work: applying protective policy to real customers, balancing care with enforcement, escalating the hard cases",
    skills: ["responsible gaming awareness", "policy enforcement", "de-escalation", "escalation handling"],
    strengths: ["user judgment", "calm communication"],
    proofLines: [
      "Applied protective policies to real customers, balancing care with enforcement",
      "Escalated gray-area cases with clear, factual write-ups"
    ]
  },
  {
    key: "customer_facing",
    label: "Customer-facing work",
    situation: "I'm moving from customer-facing work into tech-adjacent roles",
    experienceSeed:
      "Customer-facing work: resolving issues at volume, de-escalating conflict, and keeping service quality consistent shift after shift",
    skills: ["customer communication", "de-escalation", "troubleshooting", "escalation handling"],
    strengths: ["calm communication", "reliable follow-through"],
    proofLines: [
      "De-escalated angry customers and turned bad interactions around",
      "Resolved issues at volume while keeping quality consistent"
    ]
  },
  {
    key: "operations",
    label: "Operations",
    situation: "I'm coming from operations into product support, QA, or product ops",
    experienceSeed:
      "Operations work: running processes reliably, catching errors, coordinating people, and keeping things moving under time pressure",
    skills: ["process improvement", "attention to detail", "spreadsheets", "training new hires"],
    strengths: ["systems thinking", "reliable follow-through"],
    proofLines: [
      "Built or fixed processes that others still follow",
      "Caught errors before they became customer problems"
    ]
  },
  {
    key: "security",
    label: "Security",
    situation: "I'm transitioning from security work into trust and safety, fraud operations, or technical support",
    experienceSeed:
      "Security work: access control, incident response, consistent rule enforcement, and staying calm when situations escalate",
    skills: ["policy enforcement", "risk-based judgment", "de-escalation", "written documentation"],
    strengths: ["calm under pressure", "pattern recognition"],
    proofLines: [
      "Enforced rules consistently under pushback",
      "Wrote incident reports others could act on"
    ]
  },
  {
    key: "community",
    label: "Community",
    situation: "I've organized or moderated communities and I'm targeting community, support, or trust and safety roles",
    experienceSeed:
      "Community work: growing and moderating groups, defusing public conflict, and turning member feedback into signal",
    skills: ["customer communication", "de-escalation", "user feedback triage", "written documentation"],
    strengths: ["user judgment", "clear writing"],
    proofLines: [
      "Moderated public conflict without losing the room",
      "Turned member complaints into concrete feedback"
    ]
  },
  {
    key: "product_support",
    label: "Product support",
    situation: "I'm deepening a support background into product support at a software company",
    experienceSeed:
      "Support work: diagnosing issues methodically, writing clear explanations, and knowing when to escalate versus resolve",
    skills: ["troubleshooting", "customer communication", "written documentation", "escalation handling"],
    strengths: ["calm communication", "fast learning"],
    proofLines: [
      "Diagnosed problems methodically instead of guessing",
      "Wrote explanations non-experts could actually follow"
    ]
  },
  {
    key: "qa",
    label: "QA / testing",
    situation: "I'm targeting QA roles on the strength of detail-oriented, checklist-driven work and my own testing loops",
    experienceSeed:
      "Quality-focused work: checklist discipline, edge-case thinking, catching what others skip, and writing up what I find",
    skills: ["QA-style testing", "attention to detail", "written documentation"],
    strengths: ["pattern recognition", "reliable follow-through"],
    proofLines: [
      "Ran QA-style testing passes on my own product before release",
      "Wrote reproducible bug reports with steps, expected, and actual"
    ]
  },
  {
    key: "ai_support",
    label: "AI support",
    situation: "I use AI tools daily and I'm targeting AI support and AI operations roles",
    experienceSeed:
      "Hands-on AI fluency: daily prompt workflows, verifying model output, explaining AI behavior and limits in plain language",
    skills: ["AI tools (daily use)", "prompt workflows", "troubleshooting", "customer communication"],
    strengths: ["fast learning", "product feedback instincts"],
    proofLines: [
      "Built AI and prompt workflows I use every day",
      "Explained AI behavior and limitations to non-technical people"
    ]
  },
  {
    key: "technical_support",
    label: "Technical support",
    situation: "I'm the person people come to when technology breaks, and I'm making that my job title",
    experienceSeed:
      "Informal and formal technical troubleshooting: isolating problems, finding workarounds, and explaining fixes at any level",
    skills: ["troubleshooting", "customer communication", "written documentation"],
    strengths: ["fast learning", "calm communication"],
    proofLines: [
      "Diagnosed and fixed technical problems for people without being asked twice",
      "Explained the same fix to technical and non-technical audiences"
    ]
  },
  {
    key: "builder",
    label: "Building software",
    situation: "I'm building software products on the side while looking for a salaried role",
    experienceSeed:
      "Independent product work: shipping builds, TestFlight distribution, QA flows, user feedback loops, prompt systems, and product iteration",
    skills: ["QA-style testing", "user feedback triage", "prompt workflows", "AI tools (daily use)"],
    strengths: ["product feedback instincts", "fast learning", "systems thinking"],
    proofLines: [
      "Shipped a product to TestFlight and ran real user feedback loops",
      "Iterated a product based on tester feedback and my own QA passes"
    ]
  }
];

export function applyStarterPack(profile: CareerProfile, pack: StarterPack): CareerProfile {
  let proofPoints = profile.proofPoints;
  for (const line of pack.proofLines) {
    proofPoints = appendLine(proofPoints, line);
  }
  return {
    ...profile,
    currentSituation: appendSentence(profile.currentSituation, pack.situation),
    experienceSummary: appendSentence(profile.experienceSummary, pack.experienceSeed),
    transferableSkills: mergeChips(profile.transferableSkills, pack.skills),
    strengths: mergeChips(profile.strengths, pack.strengths),
    proofPoints,
    updatedAt: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// Lightweight validation. Flags, never blocks.
// ---------------------------------------------------------------------------

export type FieldAssessment = {
  field: keyof CareerProfile;
  label: string;
  severity: "warn" | "info";
  message: string;
};

export function assessProfile(profile: CareerProfile): FieldAssessment[] {
  const issues: FieldAssessment[] = [];

  if (!profile.currentSituation.trim()) {
    issues.push({ field: "currentSituation", label: "Current situation", severity: "warn", message: "Empty — one honest sentence unlocks the transition questions in interview prep." });
  } else if (profile.currentSituation.trim().length < 30) {
    issues.push({ field: "currentSituation", label: "Current situation", severity: "warn", message: "Very thin — add where you're coming from and where you're headed." });
  }

  if (!profile.targetRoles.trim()) {
    issues.push({ field: "targetRoles", label: "Target roles", severity: "warn", message: "Empty — name at least one role type so lanes and tailoring have a direction." });
  }

  if (!profile.transferableSkills.length) {
    issues.push({ field: "transferableSkills", label: "Transferable skills", severity: "warn", message: "Empty — the tailoring engine matches these against every job post." });
  } else if (profile.transferableSkills.length < 3) {
    issues.push({ field: "transferableSkills", label: "Transferable skills", severity: "warn", message: `Only ${profile.transferableSkills.length} — aim for at least 5 so keyword matching has material.` });
  }

  if (!profile.experienceSummary.trim()) {
    issues.push({ field: "experienceSummary", label: "Experience summary", severity: "warn", message: "Empty — requirement matching is guesswork without your real history." });
  } else if (profile.experienceSummary.trim().length < 60) {
    issues.push({ field: "experienceSummary", label: "Experience summary", severity: "warn", message: "Thin — add roles, industries, scale, and what you were trusted with." });
  }

  if (!profile.proofPoints.trim()) {
    issues.push({ field: "proofPoints", label: "Proof points", severity: "warn", message: "Empty — proof is what makes tailored bullets and interview answers specific." });
  } else if (profile.proofPoints.trim().length < 40) {
    issues.push({ field: "proofPoints", label: "Proof points", severity: "warn", message: "Thin — one line per real project, metric, or artifact." });
  }

  if (!profile.strengths.length) {
    issues.push({ field: "strengths", label: "Strengths", severity: "info", message: "Empty — strengths feed behavioral interview questions." });
  }
  if (!profile.constraints.trim()) {
    issues.push({ field: "constraints", label: "Constraints", severity: "info", message: "Optional, but being clear here saves wasted applications." });
  }
  if (!profile.workStyle.trim()) {
    issues.push({ field: "workStyle", label: "Work style", severity: "info", message: "Optional — useful for screening roles and culture questions." });
  }

  return issues;
}

export type JobPostAssessment = {
  status: "empty" | "too_short" | "thin" | "good";
  wordCount: number;
  message: string;
};

export function assessJobPost(text: string): JobPostAssessment {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  if (!wordCount) {
    return { status: "empty", wordCount, message: "Paste the full job posting — title, responsibilities, and requirements." };
  }
  if (wordCount < 40) {
    return {
      status: "too_short",
      wordCount,
      message: `Only ${wordCount} words — this looks like a title or snippet, not a full posting. The analysis will be shallow; paste everything from the job page, especially the requirements section.`
    };
  }
  if (wordCount < 120) {
    return {
      status: "thin",
      wordCount,
      message: `${wordCount} words — that's short for a real posting. If the page had "Responsibilities" or "Requirements" sections, make sure they made it into the paste.`
    };
  }
  return { status: "good", wordCount, message: `${wordCount} words — enough material for a real analysis.` };
}

export function validateApplicationInput(input: { company: string; roleTitle: string }): string[] {
  const issues: string[] = [];
  if (!input.company.trim()) issues.push("Add the company name — follow-ups and outreach both key off it.");
  if (!input.roleTitle.trim()) issues.push("Add the role title — interview prep uses it to frame questions.");
  return issues;
}

export function assessApplication(record: ApplicationRecord): string[] {
  const flags: string[] = [];
  if (!record.company.trim() || record.company === "Unknown company") flags.push("missing company");
  if (!record.roleTitle.trim() || record.roleTitle === "Untitled role") flags.push("missing role title");
  if (!record.status) flags.push("missing status");
  return flags;
}

// ---------------------------------------------------------------------------
// Interview answer scaffolds: structure prompts shown before the user writes,
// matched to the question category. Deterministic and honesty-first.
// ---------------------------------------------------------------------------

export function answerScaffold(category: PrepCategory): string[] {
  const core = [
    "Situation — one line of real context: where, when, what was at stake",
    "Action — the specific things you did (say \"I\", not just \"we\")",
    "Result — what changed, with an honest number only if one exists"
  ];
  if (category === "gap_defense") {
    return [
      "Acknowledge — name the gap plainly in your first sentence; no squirming",
      ...core,
      "Plan — the concrete step you're taking to close the gap"
    ];
  }
  if (category === "transition") {
    return [...core, "Bridge — connect your old work to this lane explicitly"];
  }
  return core;
}

export function scaffoldTemplate(category: PrepCategory): string {
  const lines =
    category === "gap_defense"
      ? ["What I don't have yet (said plainly): ", "Closest real experience I do have: ", "What I did in that situation: ", "What came of it: ", "My concrete plan to close the gap: "]
      : ["Situation: ", "What I did: ", "What changed because of it: ", ...(category === "transition" ? ["Why that points to this role: "] : [])];
  return lines.join("\n");
}
