import type { TargetLane } from "@/types/command-center";
import type {
  CareerDossier,
  DossierEvidenceRecord,
  EvidenceRelevanceReceipt,
  LanePack,
  ResumeVariant,
  RoleDistinctnessAudit,
  TargetRoleContract,
  TargetSignal
} from "@/types/dossier";
import { evidenceRevision } from "@/lib/evidence-integrity";

const CONCEPT_TERMS: Record<string, string[]> = {
  "customer-support": ["customer", "client", "support", "service", "ticket", "csat", "response", "issue", "resolution"],
  troubleshooting: ["troubleshoot", "diagnose", "debug", "technical issue", "root cause", "workaround", "resolve"],
  escalation: ["escalat", "triage", "priority", "incident", "handoff"],
  "knowledge-base": ["knowledge base", "help center", "guide", "faq", "documentation", "article"],
  onboarding: ["onboard", "setup", "implementation", "adoption", "training"],
  relationships: ["relationship", "retention", "renewal", "success", "stakeholder", "client communication"],
  "process-improvement": ["process", "workflow", "sop", "standardiz", "improv", "redesign", "automation"],
  analysis: ["analy", "report", "spreadsheet", "excel", "sheets", "dashboard", "metric", "data"],
  coordination: ["coordinat", "cross-functional", "project", "launch", "timeline", "backlog", "stakeholder", "requirements"],
  tracking: ["track", "tracker", "schedule", "status", "handoff", "routing", "inventory"],
  communication: ["communicat", "explain", "present", "write", "collaborat"],
  documentation: ["document", "guide", "sop", "knowledge", "article", "playbook"],
  technical: ["technical", "software", "saas", "api", "integration", "system", "jira", "zendesk"],
  leadership: ["lead", "manage", "mentor", "own", "supervis"],
  quality: ["quality", "test", "qa", "audit", "accuracy", "compliance"],
};

const TITLE_CONCEPTS: Array<[RegExp, string[]]> = [
  [/support|help.?desk|service/i, ["customer-support", "troubleshooting", "escalation", "knowledge-base", "communication", "technical"]],
  [/product ops|product operations|operations|coordinator/i, ["process-improvement", "analysis", "coordination", "tracking", "documentation"]],
  [/customer success|client success/i, ["relationships", "onboarding", "customer-support", "communication", "analysis"]],
  [/implementation/i, ["onboarding", "coordination", "tracking", "documentation", "technical"]],
  [/qa|quality|tester/i, ["quality", "technical", "documentation", "troubleshooting"]],
];

const emphasisConcepts: Record<keyof TargetRoleContract["emphases"], string[]> = {
  customerFacing: ["customer-support", "relationships", "onboarding", "communication"],
  operations: ["process-improvement", "tracking", "quality"],
  technical: ["technical", "troubleshooting", "quality"],
  analytical: ["analysis", "quality"],
  coordination: ["coordination", "tracking", "onboarding"],
  documentation: ["documentation", "knowledge-base"],
  leadership: ["leadership"]
};

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
}

function matchingConcepts(text: string): string[] {
  const value = normalized(text);
  return Object.entries(CONCEPT_TERMS)
    .filter(([, terms]) => terms.some((term) => value.includes(normalized(term))))
    .map(([concept]) => concept);
}

function titleConcepts(title: string): string[] {
  return [...new Set(TITLE_CONCEPTS.filter(([pattern]) => pattern.test(title)).flatMap(([, concepts]) => concepts))];
}

export function buildTargetRoleContract(lane: TargetLane): TargetRoleContract {
  const description = lane.targetDescription?.trim() ?? "";
  const descriptionSentences = description.split(/(?<=[.!?])\s+|\n+/).map((item) => item.trim()).filter(Boolean);
  const signals: TargetSignal[] = [];
  const add = (concept: string, source: TargetSignal["source"], sourceExcerpt: string, importance: TargetSignal["importance"], confidence: TargetSignal["confidence"]) => {
    if (signals.some((signal) => signal.concept === concept && signal.source === source && signal.sourceExcerpt === sourceExcerpt)) return;
    signals.push({ id: `${lane.id}-signal-${signals.length + 1}`, concept, source, sourceExcerpt, importance, confidence });
  };
  titleConcepts(lane.title).forEach((concept) => add(concept, "title", lane.title, "unspecified", "medium"));
  descriptionSentences.forEach((sentence) => {
    const importance = /\b(required|must|need(?:ed)?|essential)\b/i.test(sentence)
      ? "required" as const
      : /\b(preferred|nice to have|bonus)\b/i.test(sentence) ? "preferred" as const : "unspecified" as const;
    matchingConcepts(sentence).forEach((concept) => add(concept, "description", sentence, importance, "high"));
  });
  if (!description) {
    const taxonomyText = [...lane.keywords, ...lane.proof, lane.resumeAngle].join(" ");
    matchingConcepts(taxonomyText).forEach((concept) => add(concept, "lane-taxonomy", lane.keywords.join(", ") || lane.resumeAngle, "unspecified", "medium"));
  }
  const concepts = [...new Set(signals.map((signal) => signal.concept))];
  const emphases = Object.fromEntries(Object.entries(emphasisConcepts).map(([key, values]) => [key, values.filter((value) => concepts.includes(value)).length])) as TargetRoleContract["emphases"];
  return {
    laneId: lane.id,
    title: lane.title,
    description,
    basis: description ? "description-backed" : "title-only",
    signals,
    competencies: concepts,
    responsibilities: descriptionSentences.filter((sentence) => /\b(responsib|manage|support|coordinate|build|create|maintain|resolve|analy)/i.test(sentence)),
    outcomes: descriptionSentences.filter((sentence) => /\b(improve|reduce|increase|deliver|outcome|result|success)/i.test(sentence)),
    toolsAndSkills: [...new Set(descriptionSentences.flatMap(matchingConcepts))],
    emphases,
    ambiguity: signals.length ? [] : ["No bounded target signals could be derived; only general approved evidence can be used."]
  };
}

function strength(item: DossierEvidenceRecord): number {
  const kind = item.kind === "metric" ? 4 : ["proof", "project", "responsibility"].includes(item.kind) ? 3 : ["skill", "tool"].includes(item.kind) ? 2 : 1;
  return kind + (item.confidence === "high" ? 2 : item.confidence === "medium" ? 1 : 0);
}

export function rankEligibleEvidence(evidence: DossierEvidenceRecord[], contract: TargetRoleContract, dossier: CareerDossier): EvidenceRelevanceReceipt[] {
  const scored = evidence.map((item) => {
    const text = `${item.label} ${item.detail}`;
    const concepts = matchingConcepts(text);
    const matchedSignals = contract.signals.filter((signal) => concepts.includes(signal.concept));
    const exactTokens = new Set(normalized(text).split(" "));
    const targetTokens = new Set(normalized(`${contract.title} ${contract.description}`).split(" "));
    const tokenOverlap = [...exactTokens].filter((token) => token.length > 3 && [...targetTokens].some((target) => target === token || (target.length > 5 && token.slice(0, 6) === target.slice(0, 6)))).length;
    const specificityScore = matchedSignals.filter((signal) => signal.source === "description").length * 3 + Math.min(tokenOverlap, 3);
    const relevanceScore = matchedSignals.reduce((sum, signal) => sum + (signal.source === "description" ? 8 : signal.source === "title" ? 6 : 4) + (signal.importance === "required" ? 2 : 0), 0) + specificityScore + strength(item);
    return { item, concepts, matchedSignals, specificityScore, relevanceScore };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore || b.specificityScore - a.specificityScore || a.item.id.localeCompare(b.item.id));
  return scored.map((entry, index) => ({
    evidenceId: entry.item.id,
    evidenceRevision: evidenceRevision(entry.item, dossier),
    laneId: contract.laneId,
    targetSignalIds: entry.matchedSignals.map((signal) => signal.id),
    competencies: entry.matchedSignals.map((signal) => signal.concept),
    skillConcepts: entry.concepts,
    relevanceScore: entry.relevanceScore,
    specificityScore: entry.specificityScore,
    evidenceStrength: strength(entry.item),
    evidenceType: entry.item.kind,
    selected: false,
    rank: index + 1,
    exclusionReason: null,
    tieBreakReason: index > 0 && scored[index - 1].relevanceScore === entry.relevanceScore ? "Stable evidence ID order broke an equal-score tie." : "Higher relevance, specificity, then evidence strength ranked first.",
    selectedFor: [],
    claimPaths: []
  }));
}

function topEvidence(lane: LanePack): string[] {
  return [...(lane.relevanceReceipts ?? [])].filter((item) => item.selected).sort((a, b) => a.rank - b.rank).slice(0, 8).map((item) => item.evidenceId);
}

function normalizedBullet(value: string): string {
  return normalized(value).replace(/\b(supported|helped|assisted|targeting|candidate)\b/g, "").trim();
}

export function auditRoleDistinctness(laneA: LanePack, laneB: LanePack, variants: ResumeVariant[], dossier?: CareerDossier): RoleDistinctnessAudit {
  const aEvidence = topEvidence(laneA);
  const bEvidence = topEvidence(laneB);
  const overlap = aEvidence.filter((id) => bEvidence.includes(id));
  const uniqueA = aEvidence.filter((id) => !bEvidence.includes(id));
  const uniqueB = bEvidence.filter((id) => !aEvidence.includes(id));
  const aRanks = new Map((laneA.relevanceReceipts ?? []).map((item) => [item.evidenceId, item.rank]));
  const bRanks = new Map((laneB.relevanceReceipts ?? []).map((item) => [item.evidenceId, item.rank]));
  const rankChanges = overlap.flatMap((id) => {
    const rankA = aRanks.get(id) ?? 0; const rankB = bRanks.get(id) ?? 0;
    return Math.abs(rankA - rankB) >= 2 ? [{ evidenceId: id, rankA, rankB, delta: Math.abs(rankA - rankB) }] : [];
  });
  const aVariant = variants.find((item) => item.laneId === laneA.laneId && item.kind === "ats");
  const bVariant = variants.find((item) => item.laneId === laneB.laneId && item.kind === "ats");
  const aSkills = aVariant?.resume.coreSkills.slice(0, 6) ?? [];
  const bSkills = bVariant?.resume.coreSkills.slice(0, 6) ?? [];
  const skillOverlap = aSkills.filter((skill) => bSkills.includes(skill));
  const aBulletRefs = aVariant?.evidenceReferences.filter((ref) => ref.claimPath.includes(".bullets.")).slice(0, 4) ?? [];
  const bBulletRefs = bVariant?.evidenceReferences.filter((ref) => ref.claimPath.includes(".bullets.")).slice(0, 4) ?? [];
  const aBulletIds = [...new Set(aBulletRefs.flatMap((ref) => ref.evidenceIds))];
  const bBulletIds = [...new Set(bBulletRefs.flatMap((ref) => ref.evidenceIds))];
  const cosmetic = aBulletRefs.flatMap((a) => bBulletRefs.filter((b) => normalizedBullet(a.claimText) === normalizedBullet(b.claimText))).length;
  const projectIds = (lane: LanePack) => (lane.relevanceReceipts ?? []).filter((item) => item.selectedFor.includes("project")).sort((a, b) => a.rank - b.rank).map((item) => item.evidenceId);
  const aProjects = projectIds(laneA); const bProjects = projectIds(laneB);
  const summaryA = (laneA.relevanceReceipts ?? []).filter((item) => item.selectedFor.includes("summary")).flatMap((item) => item.targetSignalIds);
  const summaryB = (laneB.relevanceReceipts ?? []).filter((item) => item.selectedFor.includes("summary")).flatMap((item) => item.targetSignalIds);
  const summaryDifference = [...new Set([...summaryA.filter((id) => !summaryB.includes(id)), ...summaryB.filter((id) => !summaryA.includes(id))])];
  const eligibleCount = Math.max(laneA.relevanceReceipts?.length ?? 0, laneB.relevanceReceipts?.length ?? 0);
  const meaningfulAlternatives = uniqueA.length >= 2 && uniqueB.length >= 2;
  const insufficientEvidence = eligibleCount < 8 || !meaningfulAlternatives;
  const components = {
    evidence: uniqueA.length >= 3 && uniqueB.length >= 3 ? 35 : uniqueA.length >= 2 && uniqueB.length >= 2 ? 24 : 0,
    bullets: aBulletIds.some((id) => !bBulletIds.includes(id)) && bBulletIds.some((id) => !aBulletIds.includes(id)) ? 25 : 0,
    skills: aSkills.filter((item) => !bSkills.includes(item)).length >= 2 && bSkills.filter((item) => !aSkills.includes(item)).length >= 2 ? 15 : 0,
    projects: aProjects[0] && bProjects[0] && aProjects[0] !== bProjects[0] ? 10 : 0,
    summary: summaryDifference.length ? 10 : 0,
    supportingMaterial: laneA.supportingMaterial?.about !== laneB.supportingMaterial?.about ? 5 : 0
  };
  const score = Object.values(components).reduce((sum, value) => sum + value, 0);
  const pairVariants = variants.filter((variant) => variant.laneId === laneA.laneId || variant.laneId === laneB.laneId);
  const truthIntegrityFailures = pairVariants.flatMap((variant) => {
    const referenced = new Set(variant.evidenceReferences.map((reference) => reference.claimText));
    const claimPaths: Array<[string, string]> = [["summary", variant.resume.summary], ...variant.resume.coreSkills.map((claim, index): [string, string] => [`coreSkills.${index}`, claim]), ...variant.resume.experience.flatMap((entry, entryIndex) => entry.bullets.map((claim, index): [string, string] => [`experience.${entryIndex}.bullets.${index}`, claim]))];
    const missing = claimPaths.filter(([, claim]) => claim.trim() && !referenced.has(claim)).map(([path]) => `${variant.id}:${path}:missing-provenance`);
    if (!dossier) return missing;
    const eligible = new Set(dossier.evidence.filter((item) => item.approved && !item.rejected).map((item) => item.id));
    return [...missing, ...variant.evidenceReferences.flatMap((reference) => reference.evidenceIds.filter((id) => !eligible.has(id)).map((id) => `${variant.id}:${reference.claimPath}:${id}:ineligible`))];
  });
  const distinct = score >= 70 && components.evidence > 0 && components.bullets > 0 && truthIntegrityFailures.length === 0;
  const reasons = insufficientEvidence
    ? ["The approved dossier does not contain enough role-specific alternatives to justify stronger differentiation."]
    : truthIntegrityFailures.length ? ["One or more claims lacks eligible evidence provenance, so distinctness cannot pass."]
    : distinct ? ["Different approved evidence, claims, skills, and role-specific material drive the two lanes."] : ["Differences remain too cosmetic or too dependent on shared evidence."];
  return {
    laneA: laneA.laneId, laneB: laneB.laneId, evidenceOverlap: overlap, topEvidenceUniqueA: uniqueA, topEvidenceUniqueB: uniqueB,
    evidenceRankChanges: rankChanges, skillOverlap, uniqueSkillsA: aSkills.filter((item) => !bSkills.includes(item)), uniqueSkillsB: bSkills.filter((item) => !aSkills.includes(item)),
    bulletEvidenceOverlap: aBulletIds.filter((id) => bBulletIds.includes(id)), cosmeticBulletDuplicates: cosmetic,
    uniqueClaimPathsA: aBulletRefs.filter((ref) => ref.evidenceIds.some((id) => !bBulletIds.includes(id))).map((ref) => ref.claimPath),
    uniqueClaimPathsB: bBulletRefs.filter((ref) => ref.evidenceIds.some((id) => !aBulletIds.includes(id))).map((ref) => ref.claimPath),
    projectSelectionDifference: Boolean(components.projects), summaryTargetSignalDifference: summaryDifference,
    supportingMaterialDifference: Boolean(components.supportingMaterial), truthIntegrityFailures, insufficientEvidence, reasons, components,
    score: insufficientEvidence ? null : score,
    decision: insufficientEvidence ? "insufficient-evidence-for-distinctness" : distinct ? "meaningfully-distinct" : "not-distinct"
  };
}
