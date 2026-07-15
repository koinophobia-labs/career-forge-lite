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
const YEARS_SIGNAL = /\b(\d+(?:\.\d+)?)\s*(?:\+|(?:-\s*\d+(?:\.\d+)?))?\s*years?\b/i;

const REQUIREMENT_STOPWORDS = new Set([
  "ability", "and", "are", "comfortable", "demonstrated", "do", "excellent", "experience", "familiarity",
  "for", "have", "knowledge", "least", "minimum", "must", "of", "plus", "preferred", "proficiency",
  "record", "required", "responsibilities", "strong", "the", "track", "with", "working", "years", "year", "you"
]);

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8,
  sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};

type DatedEvidenceInterval = {
  start: number;
  end: number;
  evidenceIds: string[];
};

export type DurationEvidenceResult = {
  requiredYears: number | null;
  verifiedYears: number | null;
  hasRelevantWork: boolean;
  supportingEvidenceIds: string[];
  qualificationSupport: "direct" | "transferred" | "none";
};

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

function requirementTerms(requirement: string): string[] {
  const withoutDuration = normalize(requirement).replace(YEARS_SIGNAL, " ");
  return [...new Set((withoutDuration.match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [])
    .filter((word) => !REQUIREMENT_STOPWORDS.has(word)))];
}

function directlySupportsQualification(requirement: string, detail: string): boolean {
  const terms = requirementTerms(requirement);
  if (!terms.length) return false;
  const haystack = normalize(detail);
  return terms.every((term) => haystack.includes(term));
}

function transferSupportsQualification(requirement: string, detail: string): boolean {
  const normalizedDetail = normalize(detail);
  if (/\b(saas|technical|product) support\b/i.test(requirement)) {
    return /customer (?:service|support)|issue resolution|dispute|escalation/.test(normalizedDetail);
  }
  if (/\b(fraud|risk|trust and safety|abuse)\b/i.test(requirement)) {
    return /policy enforcement|responsible gaming|id verification|dispute|compliance/.test(normalizedDetail);
  }
  return false;
}

export function requiredYearsFromRequirement(requirement: string): number | null {
  const match = requirement.match(YEARS_SIGNAL);
  if (!match) return null;
  const years = Number(match[1]);
  return Number.isFinite(years) && years > 0 ? years : null;
}

function safeNow(value: Date | string): Date {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(0);
}

function dateBoundary(value: string, boundary: "start" | "end", now: Date): number | null {
  const clean = value.trim().replace(/[–—]/g, "-");
  if (!clean) return null;
  if (/^(?:present|current|now)$/i.test(clean)) return now.getTime();

  const iso = clean.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]) - 1;
    const day = iso[3] ? Number(iso[3]) : 1;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    if (boundary === "end" && !iso[3]) return Date.UTC(year, month + 1, 1);
    return Date.UTC(year, month, day) + (boundary === "end" && iso[3] ? 86_400_000 : 0);
  }

  const monthYear = clean.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase()];
    if (month === undefined) return null;
    const year = Number(monthYear[2]);
    return boundary === "end" ? Date.UTC(year, month + 1, 1) : Date.UTC(year, month, 1);
  }

  const yearOnly = clean.match(/^(\d{4})$/);
  return yearOnly ? Date.UTC(Number(yearOnly[1]), 0, 1) : null;
}

function intervalFromValues(startValue: string, endValue: string, now: Date): Omit<DatedEvidenceInterval, "evidenceIds"> | null {
  const start = dateBoundary(startValue, "start", now);
  const end = dateBoundary(endValue, "end", now);
  return start !== null && end !== null && end > start ? { start, end } : null;
}

function intervalFromText(value: string, now: Date): Omit<DatedEvidenceInterval, "evidenceIds"> | null {
  const clean = value.replace(/[–—]/g, "-");
  const monthRange = clean.match(/\b([A-Za-z]{3,9}\s+\d{4})\s+(?:to|-)\s+([A-Za-z]{3,9}\s+\d{4}|present|current|now)\b/i);
  if (monthRange) return intervalFromValues(monthRange[1], monthRange[2], now);
  const isoRange = clean.match(/\b(\d{4}-\d{1,2}(?:-\d{1,2})?)\s+(?:to|-)\s+(\d{4}-\d{1,2}(?:-\d{1,2})?|present|current|now)\b/i);
  if (isoRange) return intervalFromValues(isoRange[1], isoRange[2], now);
  const yearRange = clean.match(/\b(\d{4})\s*-\s*(\d{4}|present|current|now)\b/i);
  return yearRange ? intervalFromValues(yearRange[1], yearRange[2], now) : null;
}

function mergedDurationYears(intervals: DatedEvidenceInterval[]): number | null {
  if (!intervals.length) return null;
  const sorted = intervals
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (!sorted.length) return null;
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) merged.push({ start: interval.start, end: interval.end });
    else previous.end = Math.max(previous.end, interval.end);
  }
  const milliseconds = merged.reduce((total, item) => total + item.end - item.start, 0);
  return milliseconds / (365.2425 * 86_400_000);
}

export function verifiedDurationForRequirement(
  requirement: string,
  dossier: CareerDossier,
  now: Date | string = new Date()
): DurationEvidenceResult {
  const requiredYears = requiredYearsFromRequirement(requirement);
  const approved = approvedRecords(dossier);
  const approvedById = new Map(approved.map((item) => [item.id, item]));
  const evaluationDate = safeNow(now);
  const directRecords = approved.filter((item) => directlySupportsQualification(requirement, item.detail));
  const transferredRecords = approved.filter((item) => transferSupportsQualification(requirement, item.detail));
  const intervals: DatedEvidenceInterval[] = [];
  const supportingIds = new Set(directRecords.map((item) => item.id));
  let structuredDirect = false;

  const addStructuredInterval = (content: string, start: string, end: string, evidenceIds: string[]) => {
    if (!directlySupportsQualification(requirement, content)) return;
    const associated = evidenceIds
      .map((id) => approvedById.get(id))
      .filter((item): item is DossierEvidenceRecord => Boolean(item))
      .filter((item) => directlySupportsQualification(requirement, item.detail) || item.kind === "role" || item.kind === "project");
    if (!associated.length) return;
    structuredDirect = true;
    associated.forEach((item) => supportingIds.add(item.id));
    const interval = intervalFromText(start, evaluationDate) ?? intervalFromValues(start, end, evaluationDate);
    if (interval) intervals.push({ ...interval, evidenceIds: associated.map((item) => item.id) });
  };

  for (const role of dossier.roles) {
    addStructuredInterval(
      [role.title, ...role.responsibilities, ...role.tools, ...role.outcomes].join(" "),
      role.startDate,
      role.current ? "Present" : role.endDate,
      role.evidenceIds
    );
  }
  for (const project of dossier.projects) {
    const range = intervalFromText(project.dates, evaluationDate);
    if (!range) {
      addStructuredInterval(
        [project.name, project.description, ...project.responsibilities, ...project.tools, ...project.outcomes].join(" "),
        "",
        "",
        project.evidenceIds
      );
      continue;
    }
    const content = [project.name, project.description, ...project.responsibilities, ...project.tools, ...project.outcomes].join(" ");
    if (!directlySupportsQualification(requirement, content)) continue;
    const ids = project.evidenceIds.filter((id) => approvedById.has(id));
    if (!ids.length) continue;
    ids.forEach((id) => supportingIds.add(id));
    intervals.push({ ...range, evidenceIds: ids });
  }

  for (const record of directRecords.filter((item) => item.kind === "role" || item.kind === "project")) {
    const interval = intervalFromText(record.detail, evaluationDate);
    if (interval) intervals.push({ ...interval, evidenceIds: [record.id] });
  }

  const verifiedYears = mergedDurationYears(intervals);
  const intervalEvidenceIds = intervals.flatMap((item) => item.evidenceIds);
  return {
    requiredYears,
    verifiedYears,
    hasRelevantWork: directRecords.length > 0 || transferredRecords.length > 0 || intervals.length > 0,
    supportingEvidenceIds: [...new Set(directRecords.length || intervals.length
      ? verifiedYears !== null ? intervalEvidenceIds : [...supportingIds]
      : transferredRecords.map((item) => item.id))],
    qualificationSupport: directRecords.length || structuredDirect || intervals.length ? "direct" : transferredRecords.length ? "transferred" : "none"
  };
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

function matchRequirement(requirement: string, profile: CareerProfile, dossier?: CareerDossier | null, now: Date | string = new Date()): RequirementMatch {
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
  const meaningfulWords = requirementTerms(requirement);
  const overlap = meaningfulWords.filter((word) => corpus.includes(word));
  const directlyRelevant = records.filter((item) => {
    if (!meaningfulWords.length) return false;
    const detail = normalize(item.detail);
    const hits = meaningfulWords.filter((word) => detail.includes(word));
    return hits.length >= Math.min(2, meaningfulWords.length);
  });

  const transferred = records.filter((item) => {
    return transferSupportsQualification(requirement, item.detail);
  });

  const requiredYears = requiredYearsFromRequirement(requirement);
  if (requiredYears !== null) {
    const duration = dossier
      ? verifiedDurationForRequirement(requirement, dossier, now)
      : { requiredYears, verifiedYears: null, hasRelevantWork: overlap.length >= 1, supportingEvidenceIds: [], qualificationSupport: "none" as const };
    const supportingIds = duration.supportingEvidenceIds;
    if (
      duration.qualificationSupport === "direct" &&
      duration.verifiedYears !== null &&
      duration.verifiedYears + 0.02 >= requiredYears
    ) {
      return {
        requirement,
        status: "covered",
        evidence: `Approved evidence proves the requested work and at least ${requiredYears} year${requiredYears === 1 ? "" : "s"} of non-overlapping duration.`,
        evidenceIds: supportingIds,
        supportType: "direct"
      };
    }
    if (duration.qualificationSupport === "direct" && duration.verifiedYears !== null) {
      const verified = Math.floor((duration.verifiedYears + 0.001) * 10) / 10;
      return {
        requirement,
        status: "partial",
        evidence: `Approved evidence verifies about ${verified.toFixed(1)} year${verified === 1 ? "" : "s"} of the requested work, below the ${requiredYears}-year requirement.`,
        evidenceIds: supportingIds,
        supportType: "transferred"
      };
    }
    if (duration.qualificationSupport === "direct") {
      return {
        requirement,
        status: "partial",
        evidence: `Approved evidence supports the requested work, but the requested ${requiredYears}-year duration is not verified by unambiguous dates.`,
        evidenceIds: supportingIds,
        supportType: "transferred"
      };
    }
    if (duration.qualificationSupport === "transferred" || transferred.length) {
      const ids = supportingIds.length ? supportingIds : transferred.map((item) => item.id);
      return {
        requirement,
        status: "partial",
        evidence: `Approved evidence is related to the work, but it does not prove the exact qualification or the requested ${requiredYears}-year duration.`,
        evidenceIds: ids,
        supportType: "transferred"
      };
    }
    if (skillHits.length || directlyRelevant.length || duration.hasRelevantWork) {
      const supporting = uniqueRecords([...skillHits, ...directlyRelevant]);
      return {
        requirement,
        status: "partial",
        evidence: `Approved evidence shows related familiarity, but it does not prove the full responsibility or the requested ${requiredYears}-year duration.`,
        evidenceIds: supporting.map((item) => item.id).filter(Boolean),
        supportType: "transferred"
      };
    }
    return {
      requirement,
      status: "gap",
      evidence: `No approved dossier evidence proves this work or the requested ${requiredYears}-year duration. A lane keyword cannot change that.`,
      evidenceIds: [],
      supportType: null
    };
  }

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

  if (transferred.length) {
    return {
      requirement,
      status: "partial",
      evidence: `Approved evidence is transferable but does not prove the exact qualification: "${transferred[0].detail}".`,
      evidenceIds: transferred.map((item) => item.id),
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

export function analyzeJobPost(
  jobPost: string,
  profile: CareerProfile,
  lane?: TargetLane | null,
  dossier?: CareerDossier | null,
  now: Date | string = new Date()
): JobPostAnalysis {
  const keywords = extractKeywords(jobPost, profile, lane, dossier);
  const requirementLines = extractRequirements(jobPost);
  const requirements = requirementLines.map((line) => matchRequirement(line, profile, dossier, now));

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
