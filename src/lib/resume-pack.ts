// Public-safe metadata for the four finalized resume-pack lanes. This file
// intentionally contains NO private data: no email, no phone, no LinkedIn,
// no resume body text — only lane names, export file names, and the keyword
// sets used to recommend which resume fits a pasted job post. The actual
// resume files live outside the repo (git-ignored / iCloud).

export type PackResume = {
  id: string;
  laneTitle: string;
  fileName: string;
  headline: string;
  keywords: string[];
  usageNote: string;
};

export const resumePack: PackResume[] = [
  {
    id: "fraud-risk-ops",
    laneTitle: "Fraud / Risk Operations / Responsible Gaming",
    fileName: "Blake-Taylor-Resume-Fraud-Risk-Operations.pdf",
    headline: "Fraud & Risk Operations · Responsible Gaming · High-Volume Transaction Accuracy",
    keywords: [
      "fraud", "risk", "chargeback", "kyc", "aml", "responsible gaming", "compliance",
      "payment", "transaction", "investigation", "dispute", "cash handling", "sportsbook",
      "igaming", "casino", "wager", "account takeover", "loss prevention",
      "identity verification", "regulatory", "gaming"
    ],
    usageNote:
      "Leads with the DraftKings floor experience. Use for sportsbook/casino operators, fintech fraud and payments-risk teams, and responsible gaming programs."
  },
  {
    id: "ai-product-support-qa",
    laneTitle: "AI Product Support / Product QA / Product Operations",
    fileName: "Blake-Taylor-Resume-AI-Product-Support-QA.pdf",
    headline: "AI Product Support · QA & Product Operations · Founder, Koinophobia Labs",
    keywords: [
      "ai", "llm", "machine learning", "chatgpt", "prompt", "technical support",
      "product support", "customer support", "help desk", "qa", "quality assurance",
      "test case", "testing", "bug", "regression", "product operations",
      "troubleshooting", "saas", "ticketing", "zendesk", "documentation"
    ],
    usageNote:
      "Leads with the founder/builder story and the automated test-harness work. Use for AI support, QA tester/analyst, product operations, and technical support at software companies."
  },
  {
    id: "customer-success-implementation",
    laneTitle: "Customer Success / Implementation / Client Systems",
    fileName: "Blake-Taylor-Resume-Customer-Success-Implementation.pdf",
    headline: "Customer Success · Implementation · Client Systems & Automation",
    keywords: [
      "customer success", "implementation", "onboarding", "client", "account management",
      "renewal", "retention", "adoption", "crm", "salesforce", "hubspot", "relationship",
      "health score", "upsell", "churn", "discovery", "stakeholder", "training",
      "requirements", "workflow automation"
    ],
    usageNote:
      "Leads with the client audit-and-build story. Use for customer success, implementation/onboarding specialist, and client services roles at SaaS companies or agencies."
  },
  {
    id: "community-trust-safety",
    laneTitle: "Community / Trust & Safety / Discord Operations",
    fileName: "Blake-Taylor-Resume-Community-Trust-Safety.pdf",
    headline: "Community Operations · Trust & Safety · Moderation Judgment · Responsible Gaming",
    keywords: [
      "community", "discord", "moderation", "moderator", "trust and safety",
      "trust & safety", "content moderation", "policy", "escalation", "safety",
      "engagement", "social media", "creator", "guidelines", "enforcement", "abuse",
      "user support", "forum", "reddit"
    ],
    usageNote:
      "Pairs policy enforcement with the published responsible-gaming framework. Use for community manager, Discord operations, moderation, and trust & safety roles — strongest at gaming-adjacent platforms."
  }
];

export function getPackResume(id: string | null | undefined): PackResume | null {
  if (!id) return null;
  return resumePack.find((resume) => resume.id === id) ?? null;
}

export type LaneScore = {
  resume: PackResume;
  score: number;
  matchedTerms: string[];
};

export type ResumeRecommendation = {
  ranked: LaneScore[];
  best: LaneScore | null;
  runnerUp: LaneScore | null;
  weakFit: boolean;
  note: string;
};

export const RECOMMENDATION_NOTE =
  "Keyword-backed suggestion, not a verdict: the post's wording is scored against each resume's keyword set. Override it whenever you know the role better than the posting reads.";

const WEAK_FIT_MIN_SCORE = 4;
const WEAK_FIT_MIN_TERMS = 2;

function countTerm(post: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Optional trailing "s" tolerates simple plurals ("chargebacks", "disputes").
  const pattern = new RegExp(`(?<![a-z0-9])${escaped}s?(?![a-z0-9])`, "gi");
  return (post.match(pattern) ?? []).length;
}

// Deterministic keyword scoring: each matched term contributes its occurrence
// count (capped so one repeated word can't dominate), multi-word phrases count
// double because they're much stronger signals than single words.
export function recommendResume(jobPost: string): ResumeRecommendation {
  const post = jobPost.toLowerCase().replace(/\s+/g, " ");

  const ranked: LaneScore[] = resumePack
    .map((resume) => {
      let score = 0;
      const matchedTerms: string[] = [];
      for (const keyword of resume.keywords) {
        const count = Math.min(countTerm(post, keyword), 3);
        if (count > 0) {
          matchedTerms.push(keyword);
          score += count * (keyword.includes(" ") ? 2 : 1);
        }
      }
      return { resume, score, matchedTerms };
    })
    .sort((a, b) => b.score - a.score || b.matchedTerms.length - a.matchedTerms.length);

  const top = ranked[0];
  const best = top && top.score > 0 ? top : null;
  const second = ranked[1] && ranked[1].score > 0 ? ranked[1] : null;
  const weakFit = !best || best.score < WEAK_FIT_MIN_SCORE || best.matchedTerms.length < WEAK_FIT_MIN_TERMS;

  return {
    ranked,
    best,
    runnerUp: second,
    weakFit,
    note: RECOMMENDATION_NOTE
  };
}
