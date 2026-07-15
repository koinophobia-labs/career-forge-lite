import type { CareerProfile, TargetLane } from "@/types/command-center";
import type { CareerDossier, DossierEvidenceRecord } from "@/types/dossier";

export type KeywordHit = {
  term: string;
  count: number;
  inProfile: boolean;
};

export type RequirementMatch = {
  requirement: string;
  status: "covered" | "partial" | "gap";
  evidence: string;
  evidenceIds: string[];
  supportType: "direct" | "transferred" | null;
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

function profileCorpus(profile: CareerProfile): string {
  return normalize(
    [
      profile.currentSituation,
      profile.targetRoles,
      profile.transferableSkills.join(" "),
      profile.experienceSummary,
      profile.strengths.join(" "),
      profile.workStyle,
      profile.proofPoints
    ].join(" ")
  );
}

function approvedRecords(dossier?: CareerDossier | null): DossierEvidenceRecord[] {
  return dossier?.evidence.filter((item) => item.approved && !item.rejected) ?? [];
}

function truthCorpus(profile: CareerProfile, dossier?: CareerDossier | null): string {
  const records = approvedRecords(dossier);
  return records.length ? normalize(records.map((item) => item.detail).join(" ")) : profileCorpus(profile);
}

export function extractKeywords(jobPost: string, profile: CareerProfile, _lane?: TargetLane | null, dossier?: CareerDossier | null): KeywordHit[] {
  const post = normalize(jobPost);
  const corpus = truthCorpus(profile, dossier);

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

function matchRequirement(requirement: string, profile: CareerProfile, dossier?: CareerDossier | null): RequirementMatch {
  const records = approvedRecords(dossier);
  const corpus = truthCorpus(profile, dossier);
  const reqNorm = normalize(requirement);

  if (CREDENTIAL_SIGNAL.test(requirement) && !CREDENTIAL_SIGNAL.test(corpus)) {
    return {
      requirement,
      status: "gap",
      evidence:
        "This asks for a formal credential. Never claim one you don't hold — many posts treat these as flexible, so lean on demonstrated skill instead.",
      evidenceIds: [],
      supportType: null
    };
  }

  const skillHits = records.length
    ? records.filter((item) => (item.kind === "skill" || item.kind === "tool") && reqNorm.includes(normalize(item.detail)))
    : profile.transferableSkills.filter((skill) => skill.trim() && reqNorm.includes(normalize(skill))).map((detail) => ({ id: "", detail }));
  const meaningfulWords = reqNorm.match(/[a-z]{5,}/g) ?? [];
  const overlap = meaningfulWords.filter((word) => corpus.includes(word));
  const directlyRelevant = records.filter((item) => {
    const detail = normalize(item.detail);
    const hits = meaningfulWords.filter((word) => detail.includes(word));
    return hits.length >= Math.min(2, meaningfulWords.length);
  });

  if (skillHits.length || directlyRelevant.length) {
    const evidenceSource = skillHits[0]?.detail ?? directlyRelevant[0]?.detail ?? "approved evidence";
    const supporting = uniqueRecords([...skillHits, ...directlyRelevant]);
    return {
      requirement,
      status: "covered",
      evidence: `Supported by approved dossier evidence: "${evidenceSource}".`,
      evidenceIds: supporting.map((item) => item.id).filter(Boolean),
      supportType: "direct"
    };
  }

  const transferred = records.filter((item) => {
    const detail = normalize(item.detail);
    if (/\b(saas|technical|product) support\b/i.test(requirement)) return /customer (?:service|support)|issue resolution|dispute|escalation/.test(detail);
    if (/\b(fraud|risk|trust and safety|abuse)\b/i.test(requirement)) return /policy enforcement|responsible gaming|id verification|dispute|compliance/.test(detail);
    return false;
  });
  if (transferred.length) {
    return {
      requirement,
      status: "partial",
      evidence: `Approved evidence is transferable but does not prove the exact qualification: "${transferred[0].detail}".`,
      evidenceIds: transferred.map((item) => item.id),
      supportType: "transferred"
    };
  }

  if (YEARS_SIGNAL.test(requirement) && overlap.length >= 2) {
    return {
      requirement,
      status: "partial",
      evidence:
        "You have related experience but not verified evidence for the stated duration. Quantify only what the dossier proves.",
      evidenceIds: records.filter((item) => overlap.some((word) => normalize(item.detail).includes(word))).map((item) => item.id),
      supportType: "transferred"
    };
  }

  if (overlap.length >= 3) {
    return {
      requirement,
      status: "partial",
      evidence: `Approved evidence is related (${overlap.slice(0, 3).join(", ")}) but does not prove the exact requirement.`,
      evidenceIds: records.filter((item) => overlap.some((word) => normalize(item.detail).includes(word))).map((item) => item.id),
      supportType: "transferred"
    };
  }

  return {
    requirement,
    status: "gap",
    evidence: "No approved dossier evidence supports this requirement. A lane keyword cannot change that.",
    evidenceIds: [],
    supportType: null
  };
}

function uniqueRecords<T extends { id: string }>(records: T[]): T[] {
  return [...new Map(records.map((item) => [item.id || JSON.stringify(item), item])).values()];
}

export function analyzeJobPost(jobPost: string, profile: CareerProfile, lane?: TargetLane | null, dossier?: CareerDossier | null): JobPostAnalysis {
  const keywords = extractKeywords(jobPost, profile, lane, dossier);
  const requirementLines = extractRequirements(jobPost);
  const requirements = requirementLines.map((line) => matchRequirement(line, profile, dossier));

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
