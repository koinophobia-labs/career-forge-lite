import type { ApplicationQuestion } from "@/types/command-center";
import type { CareerDossier, DossierEvidenceRecord, EvidenceKind } from "@/types/dossier";
import { requiredYearsFromRequirement, verifiedDurationForRequirement } from "@/lib/job-post-analyzer";

export type ApplicationQuestionCategory =
  | "behavioral"
  | "motivation"
  | "skills-experience"
  | "credential"
  | "eligibility-legal"
  | "compensation"
  | "availability-schedule"
  | "location-relocation"
  | "work-authorization"
  | "security-clearance"
  | "yes-no-factual"
  | "unknown";

export type RankedEvidence = {
  evidence: DossierEvidenceRecord;
  score: number;
  reasons: string[];
};

const MIN_RELEVANCE_SCORE = 5;
const REFUSAL = "I do not yet have approved dossier evidence to answer this honestly. Add or approve the relevant information before submitting.";
const GENERIC_WORDS = new Set([
  "about", "answer", "are", "can", "company", "describe", "did", "does", "example", "experience", "give",
  "has", "have", "interested", "opportunity", "role", "skills", "team", "tell", "this", "time", "was",
  "what", "when", "where", "which", "why", "will", "with", "work", "worked", "working", "would", "you", "your"
]);

const CATEGORY_KINDS: Record<ApplicationQuestionCategory, EvidenceKind[]> = {
  behavioral: ["role", "project", "responsibility", "metric", "proof", "story"],
  motivation: ["role", "project", "responsibility", "proof", "story", "goal"],
  "skills-experience": ["role", "project", "responsibility", "tool", "skill", "metric", "proof", "story"],
  credential: ["education"],
  "eligibility-legal": ["constraint"],
  compensation: ["constraint", "goal"],
  "availability-schedule": ["constraint"],
  "location-relocation": ["identity", "constraint", "goal"],
  "work-authorization": ["constraint"],
  "security-clearance": ["constraint"],
  "yes-no-factual": ["identity", "education", "constraint", "goal", "proof"],
  unknown: ["identity", "role", "project", "education", "responsibility", "tool", "skill", "metric", "proof", "story", "constraint", "goal"]
};

function words(value: string): string[] {
  return [...new Set((value.toLowerCase().match(/[a-z0-9+#.-]{3,}/g) ?? [])
    .filter((word) => !GENERIC_WORDS.has(word)))];
}

export function classifyApplicationQuestion(prompt: string): ApplicationQuestionCategory {
  if (/work authori[sz]ation|authorized to work|visa|sponsor(?:ship)?/i.test(prompt)) return "work-authorization";
  if (/security clearance|active clearance|clearance level/i.test(prompt)) return "security-clearance";
  if (/salary|compensation|pay range|hourly rate|desired rate/i.test(prompt)) return "compensation";
  if (/when can you start|start date|weekends?|evenings?|overnight|shift|schedule|availability|available to work/i.test(prompt)) return "availability-schedule";
  if (/relocat|location|located in|commut|on-?site|in[- ]office/i.test(prompt)) return "location-relocation";
  if (/degree|bachelor|master|phd|certif|license|credential|diploma|pmp\b/i.test(prompt)) return "credential";
  if (/legally|at least 18|background check|drug test|eligible to work/i.test(prompt)) return "eligibility-legal";
  if (/describe a time|tell (?:us|me) about|give (?:us|me) an example|conflict|under pressure|difficult customer/i.test(prompt)) return "behavioral";
  if (/why (?:are|do|would)|what excites|what interests|draws you|motivat/i.test(prompt)) return "motivation";
  if (/experience|proficien|familiar|knowledge|skill|years? of|administ|investigat|support/i.test(prompt)) return "skills-experience";
  if (/^(?:do|does|did|are|is|have|has|can|will|would)\b/i.test(prompt.trim())) return "yes-no-factual";
  return "unknown";
}

function categoryCompatible(category: ApplicationQuestionCategory, item: DossierEvidenceRecord): boolean {
  return CATEGORY_KINDS[category].includes(item.kind);
}

function exactFactMatch(category: ApplicationQuestionCategory, prompt: string, detail: string): boolean {
  const value = detail.toLowerCase();
  switch (category) {
    case "work-authorization":
      return /(?:authorized|eligible) to work|work authori[sz]ation|visa sponsorship|require sponsorship|do not require sponsorship/.test(value);
    case "security-clearance":
      return /(?:active |current )?(?:security )?clearance|clearance level/.test(value);
    case "compensation":
      return /salary|compensation|pay range|hourly rate|desired rate/.test(value) && /\$|\d/.test(value);
    case "availability-schedule": {
      const requested = words(prompt).filter((word) => /weekend|evening|overnight|shift|schedule|availab|start/.test(word));
      return /available|availability|weekend|evening|overnight|shift|schedule|start date/.test(value) &&
        (!requested.length || requested.some((word) => value.includes(word.replace(/s$/, ""))));
    }
    case "location-relocation": {
      const requested = words(prompt).filter((word) => !/relocat|location|located|commut|office|site/.test(word));
      return /relocat|location|located|commut|remote|hybrid|on-site|onsite/.test(value) || requested.some((word) => value.includes(word));
    }
    case "eligibility-legal":
      if (/at least 18|18 years old/i.test(prompt)) return /at least 18|18 years old|over 18/.test(value);
      if (/background check/i.test(prompt)) return /background check/.test(value);
      if (/drug test/i.test(prompt)) return /drug test/.test(value);
      return /legally eligible|legal eligibility/.test(value);
    case "credential": {
      const requested = words(prompt).filter((word) => /degree|bachelor|master|phd|certif|license|credential|diploma|pmp/.test(word));
      return requested.length > 0 && requested.some((word) => value.includes(word.replace(/s$/, "")));
    }
    case "yes-no-factual": {
      const requested = words(prompt);
      return requested.length > 0 && requested.every((word) => value.includes(word));
    }
    default:
      return true;
  }
}

function defensibleTransfer(prompt: string, detail: string): string | null {
  const value = detail.toLowerCase();
  if (/difficult customer|customer (?:problem|conflict)|client (?:problem|conflict)/i.test(prompt) &&
      /customer|client|user|dispute|de-escalat|resolution|resolved/.test(value)) {
    return "customer-resolution evidence";
  }
  if (/customer support/i.test(prompt) && /customer|client|support|service|dispute|resolution|resolved/.test(value)) {
    return "transferable customer-support evidence";
  }
  if (/under pressure|fast[- ]paced/i.test(prompt) && /fast[- ]paced|urgent|high volume|deadline|pressure/.test(value)) {
    return "pressure-handling evidence";
  }
  if (/conflict/i.test(prompt) && /conflict|dispute|de-escalat|resolution|resolved/.test(value)) {
    return "conflict-resolution evidence";
  }
  if (/\b(saas|technical|product) support\b/i.test(prompt) && /customer (?:service|support)|issue resolution|escalation/.test(value)) {
    return "transferable support evidence";
  }
  if (/\b(fraud|risk|trust and safety|abuse)\b/i.test(prompt) && /policy enforcement|responsible gaming|id verification|dispute|compliance/.test(value)) {
    return "transferable risk evidence";
  }
  return null;
}

function requiresCompoundTechnicalMatch(prompt: string): boolean {
  return /salesforce admin|fraud investigat|security engineer|database admin|systems? admin/i.test(prompt);
}

function compoundTechnicalMatch(prompt: string, detail: string): boolean {
  if (/salesforce admin/i.test(prompt)) return /salesforce/i.test(detail) && /administ/i.test(detail);
  if (/fraud investigat/i.test(prompt)) return /fraud/i.test(detail) && /investigat/i.test(detail);
  if (/security engineer/i.test(prompt)) return /security/i.test(detail) && /engineer/i.test(detail);
  if (/database admin/i.test(prompt)) return /database/i.test(detail) && /administ/i.test(detail);
  if (/systems? admin/i.test(prompt)) return /systems?/i.test(detail) && /administ/i.test(detail);
  return true;
}

export function rankEvidence(prompt: string, evidence: DossierEvidenceRecord[]): RankedEvidence[] {
  const category = classifyApplicationQuestion(prompt);
  const promptWords = words(prompt);
  return evidence
    .filter((item) => categoryCompatible(category, item))
    .map((item) => {
      const detail = item.detail.toLowerCase();
      const reasons: string[] = [];
      const factCategory = [
        "credential", "eligibility-legal", "compensation", "availability-schedule", "location-relocation",
        "work-authorization", "security-clearance", "yes-no-factual"
      ].includes(category);
      if (factCategory && !exactFactMatch(category, prompt, detail)) return { evidence: item, score: 0, reasons };

      const matchingWords = promptWords.filter((word) => detail.includes(word.replace(/s$/, "")));
      if (matchingWords.length) reasons.push(`topic overlap: ${matchingWords.join(", ")}`);
      let score = matchingWords.length * 3;
      const transfer = defensibleTransfer(prompt, detail);
      if (transfer) {
        score += 5;
        reasons.push(transfer);
      }
      if (factCategory) {
        score += 8;
        reasons.push("explicit approved fact");
      }
      if (requiresCompoundTechnicalMatch(prompt)) {
        if (!compoundTechnicalMatch(prompt, detail)) {
          return { evidence: item, score: 0, reasons: [] };
        }
        score += 5;
        reasons.push("complete technical concept match");
      }
      if (category === "motivation" && matchingWords.length === 0) return { evidence: item, score: 0, reasons: [] };
      if (category === "unknown" && matchingWords.length < 2) return { evidence: item, score: 0, reasons: [] };
      return { evidence: item, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.evidence.id.localeCompare(b.evidence.id));
}

function draftFromEvidence(category: ApplicationQuestionCategory, supporting: DossierEvidenceRecord[]): string {
  const details = supporting.map((item) => item.detail).join("; ");
  if (category === "behavioral") {
    return `A relevant example from my approved experience is: ${details}. I would refine this with the specific situation, action I personally took, and the verified result before submitting.`;
  }
  if (category === "motivation") {
    return `This opportunity connects to approved experience I can substantiate: ${details}. I would add my own researched reasons for this specific company before submitting.`;
  }
  if (category === "skills-experience") return `My approved dossier documents this relevant experience: ${details}.`;
  return `My approved dossier records: ${details}. I would verify that this directly answers the question before submitting.`;
}

export function draftApplicationQuestion(
  prompt: string,
  dossier: CareerDossier,
  id = `question-${Date.now().toString(36)}`,
  now: Date | string = new Date()
): ApplicationQuestion {
  const cleanPrompt = prompt.trim();
  const category = classifyApplicationQuestion(cleanPrompt);
  const approved = dossier.evidence.filter((item) => item.approved && !item.rejected);
  const requiredYears = requiredYearsFromRequirement(cleanPrompt);
  if (requiredYears !== null) {
    const duration = verifiedDurationForRequirement(cleanPrompt, dossier, now);
    if (
      duration.qualificationSupport !== "direct" ||
      duration.verifiedYears === null ||
      duration.verifiedYears + 0.02 < requiredYears
    ) {
      return { id, prompt: cleanPrompt, draftAnswer: REFUSAL, evidenceIds: [], userEdited: false };
    }
    const durationEvidence = duration.supportingEvidenceIds
      .map((evidenceId) => approved.find((item) => item.id === evidenceId))
      .filter((item): item is DossierEvidenceRecord => Boolean(item));
    return {
      id,
      prompt: cleanPrompt,
      draftAnswer: draftFromEvidence("skills-experience", durationEvidence),
      evidenceIds: durationEvidence.map((item) => item.id),
      userEdited: false
    };
  }
  const ranked = rankEvidence(cleanPrompt, approved).filter((item) => item.score >= MIN_RELEVANCE_SCORE);
  const first = ranked[0];
  const second = ranked.find((item) => item.evidence.id !== first?.evidence.id && item.evidence.kind !== first?.evidence.kind);
  const supporting = [first, second].filter((item): item is RankedEvidence => Boolean(item)).map((item) => item.evidence);
  const evidenceIds = supporting.map((item) => item.id);
  const draftAnswer = supporting.length
    ? draftFromEvidence(category, supporting)
    : category === "compensation"
      ? "Add your preferred compensation range before submitting this answer."
      : REFUSAL;
  return { id, prompt: cleanPrompt, draftAnswer, evidenceIds, userEdited: false };
}
