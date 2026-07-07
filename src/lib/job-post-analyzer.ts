import type { CareerProfile, TargetLane } from "@/types/command-center";

export type KeywordHit = {
  term: string;
  count: number;
  inProfile: boolean;
};

export type RequirementMatch = {
  requirement: string;
  status: "covered" | "partial" | "gap";
  evidence: string;
};

export type BulletSuggestion = {
  suggestion: string;
  basedOn: string;
};

export type JobPostAnalysis = {
  keywords: KeywordHit[];
  requirements: RequirementMatch[];
  weakSpots: string[];
  bulletSuggestions: BulletSuggestion[];
  honestyNote: string;
};

// Skill and quality terms worth surfacing when they appear in a job post.
// Grouped loosely; matching is case-insensitive whole-phrase.
const KEYWORD_BANK: string[] = [
  // Support / service
  "customer support", "customer service", "customer success", "technical support", "product support",
  "troubleshooting", "ticketing", "zendesk", "intercom", "salesforce", "hubspot", "crm", "csat", "sla",
  "escalation", "onboarding", "retention", "churn", "knowledge base", "help center", "documentation",
  // Trust & safety / fraud / risk
  "trust and safety", "content moderation", "policy enforcement", "fraud", "risk", "chargeback",
  "kyc", "aml", "investigation", "compliance", "case management", "account takeover", "abuse",
  // Community / product
  "community", "discord", "moderation", "engagement", "social media", "advocacy", "feedback",
  "product operations", "roadmap", "backlog", "triage", "stakeholders", "cross-functional",
  // QA / technical
  "qa", "quality assurance", "test case", "regression", "bug report", "jira", "linear", "reproduce",
  "sql", "excel", "spreadsheets", "google sheets", "data entry", "reporting", "dashboards", "api",
  // AI
  "ai", "llm", "machine learning", "prompt", "chatgpt", "automation", "generative",
  // Qualities
  "communication", "written communication", "attention to detail", "empathy", "problem solving",
  "time management", "self-starter", "fast-paced", "remote", "collaboration", "adaptability",
  "de-escalation", "multitasking", "prioritization", "organized", "independent"
];

const REQUIREMENT_LINE_PATTERN =
  /^\s*(?:[-*•●]|\d+[.)])\s+(.{10,})$|^\s*(?:must have|required|you have|you are|you will|responsibilities include|we need)[:\s]+(.{10,})$/i;

const REQUIREMENT_SIGNAL =
  /\b(\d\+?\s*years?|experience (?:with|in)|proficien|familiar(?:ity)? with|knowledge of|ability to|strong|excellent|required|must|degree|certification|bachelor|track record|comfortable (?:with|working))\b/i;

const CREDENTIAL_SIGNAL = /\b(degree|bachelor|master|phd|certification|certified|license|clearance)\b/i;
const YEARS_SIGNAL = /\b(\d)\+?\s*(?:-\s*\d+\s*)?years?\b/i;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

function countOccurrences(haystack: string, phrase: string): number {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "gi");
  return (haystack.match(pattern) ?? []).length;
}

function profileCorpus(profile: CareerProfile, lane?: TargetLane | null): string {
  return normalize(
    [
      profile.currentSituation,
      profile.targetRoles,
      profile.transferableSkills.join(" "),
      profile.experienceSummary,
      profile.strengths.join(" "),
      profile.workStyle,
      profile.proofPoints,
      lane ? lane.proof.join(" ") : "",
      lane ? lane.keywords.join(" ") : ""
    ].join(" ")
  );
}

export function extractKeywords(jobPost: string, profile: CareerProfile, lane?: TargetLane | null): KeywordHit[] {
  const post = normalize(jobPost);
  const corpus = profileCorpus(profile, lane);

  return KEYWORD_BANK.map((term) => ({
    term,
    count: countOccurrences(post, term),
    inProfile: countOccurrences(corpus, term) > 0
  }))
    .filter((hit) => hit.count > 0)
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}

export function extractRequirements(jobPost: string): string[] {
  const lines = jobPost
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const requirements: string[] = [];
  for (const line of lines) {
    const bulletMatch = line.match(REQUIREMENT_LINE_PATTERN);
    const candidate = bulletMatch ? (bulletMatch[1] ?? bulletMatch[2] ?? "").trim() : line;
    if (candidate.length >= 10 && candidate.length <= 240 && REQUIREMENT_SIGNAL.test(candidate)) {
      requirements.push(candidate.replace(/[.;]\s*$/, ""));
    }
  }
  return [...new Set(requirements)].slice(0, 18);
}

function matchRequirement(requirement: string, profile: CareerProfile, lane?: TargetLane | null): RequirementMatch {
  const corpus = profileCorpus(profile, lane);
  const reqNorm = normalize(requirement);

  if (CREDENTIAL_SIGNAL.test(requirement) && !CREDENTIAL_SIGNAL.test(corpus)) {
    return {
      requirement,
      status: "gap",
      evidence:
        "This asks for a formal credential. Never claim one you don't hold — many posts treat these as flexible, so lean on demonstrated skill instead."
    };
  }

  const skillHits = profile.transferableSkills.filter((skill) => skill.trim() && reqNorm.includes(normalize(skill)));
  const keywordHits = (lane?.keywords ?? []).filter((keyword) => keyword.trim() && reqNorm.includes(normalize(keyword)));
  const meaningfulWords = reqNorm.match(/[a-z]{5,}/g) ?? [];
  const overlap = meaningfulWords.filter((word) => corpus.includes(word));

  if (skillHits.length || keywordHits.length) {
    const evidenceSource = skillHits[0] ?? keywordHits[0];
    return {
      requirement,
      status: "covered",
      evidence: `Maps to your ${skillHits.length ? "transferable skill" : "lane strength"}: "${evidenceSource}". Say this in their vocabulary, with a concrete example.`
    };
  }

  if (YEARS_SIGNAL.test(requirement) && overlap.length >= 2) {
    return {
      requirement,
      status: "partial",
      evidence:
        "You have related experience but maybe not the stated years. Quantify what you have honestly — depth and results can offset duration."
    };
  }

  if (overlap.length >= 3) {
    return {
      requirement,
      status: "partial",
      evidence: `Your profile touches this (${overlap.slice(0, 3).join(", ")}) but doesn't state it directly. Add an explicit line if it's true.`
    };
  }

  return {
    requirement,
    status: "gap",
    evidence: "Nothing in your profile speaks to this yet. Either it's a real gap to close, or experience you have but haven't written down."
  };
}

export function analyzeJobPost(jobPost: string, profile: CareerProfile, lane?: TargetLane | null): JobPostAnalysis {
  const keywords = extractKeywords(jobPost, profile, lane);
  const requirementLines = extractRequirements(jobPost);
  const requirements = requirementLines.map((line) => matchRequirement(line, profile, lane));

  const weakSpots: string[] = [];
  const gapCount = requirements.filter((req) => req.status === "gap").length;
  const missingKeywords = keywords.filter((hit) => !hit.inProfile).slice(0, 6);

  if (missingKeywords.length) {
    weakSpots.push(
      `The post emphasizes ${missingKeywords.map((hit) => `"${hit.term}"`).join(", ")} — none appear in your profile. Add the ones that genuinely describe your experience, in their words.`
    );
  }
  if (gapCount > 0) {
    weakSpots.push(
      `${gapCount} requirement${gapCount === 1 ? "" : "s"} ${gapCount === 1 ? "has" : "have"} no supporting evidence in your profile. Decide for each: real gap (address in cover letter or close it) or missing documentation (add it).`
    );
  }
  if (!profile.proofPoints.trim()) {
    weakSpots.push(
      "Your profile has no proof points (projects, metrics, artifacts). Specific evidence is what separates a tailored application from a keyword-stuffed one."
    );
  }
  if (!weakSpots.length) {
    weakSpots.push("No structural weak spots detected. Focus on making each bullet specific: numbers, tools, and outcomes.");
  }

  const bulletSuggestions = buildBulletSuggestions(keywords, profile, lane);

  return {
    keywords,
    requirements,
    weakSpots,
    bulletSuggestions,
    honestyNote:
      "Every suggestion below is a framing of experience you claimed in your profile — use only the ones that are true, and adjust numbers to reality. Never invent credentials, employers, or metrics."
  };
}

function buildBulletSuggestions(
  keywords: KeywordHit[],
  profile: CareerProfile,
  lane?: TargetLane | null
): BulletSuggestion[] {
  const suggestions: BulletSuggestion[] = [];
  const matchedKeywords = keywords.filter((hit) => hit.inProfile).slice(0, 4);

  for (const hit of matchedKeywords) {
    suggestions.push({
      suggestion: `Rework a bullet to lead with "${hit.term}" — the post uses it ${hit.count} time${hit.count === 1 ? "" : "s"}. Pattern: action verb + ${hit.term} + scale + outcome.`,
      basedOn: `Keyword overlap between the post and your profile ("${hit.term}")`
    });
  }

  const skills = profile.transferableSkills.filter((skill) => skill.trim()).slice(0, 2);
  for (const skill of skills) {
    suggestions.push({
      suggestion: `Turn "${skill}" from a claim into a story: one bullet with the situation, what you did, and a measurable result.`,
      basedOn: `Your transferable skill: "${skill}"`
    });
  }

  if (lane) {
    suggestions.push({
      suggestion: `Open your summary with the ${lane.title} angle: ${lane.resumeAngle}`,
      basedOn: `Your active lane: ${lane.title}`
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      suggestion:
        "Your profile is too thin to generate specific rewrites. Add transferable skills and proof points first — then re-run this analysis.",
      basedOn: "Profile completeness check"
    });
  }

  return suggestions.slice(0, 7);
}
