import type { TailorHandoff } from "@/lib/tailor-handoff";
import type { IntakeData, ResumePackage } from "@/types/career";

// Post-processes a generated resume package with the tailoring session's
// context. Runs AFTER the normal generator, so plain generation stays
// byte-identical when no session exists.
//
// Honesty rules, enforced structurally:
// - A keyword is only woven in if it has evidence in the user's own intake
//   answers or career profile (the "evidence corpus").
// - Keywords that appear in the posting's gap requirements are never claimed,
//   even if they'd otherwise match the corpus loosely.
// - Nothing is added that isn't already the user's claim: the layer reorders,
//   emphasizes, and frames — it does not write new experience.

export type TailoredResumeContext = {
  roleTitle: string;
  company: string;
  laneTitle: string | null;
  resumeAngle: string;
  keywords: string[];
  coveredRequirements: string[];
  partialRequirements: string[];
  gaps: string[];
};

export type TailoredInfluence = {
  targetFraming: string;
  keywordsWoven: string[];
  keywordsSkipped: Array<{ term: string; reason: string }>;
  gapsAvoided: string[];
  angleUsed: string | null;
  coveredEmphasized: string[];
  summaryText: string;
};

export function contextFromHandoff(handoff: TailorHandoff): TailoredResumeContext {
  return {
    roleTitle: handoff.roleTitle,
    company: handoff.company,
    laneTitle: handoff.laneTitle,
    resumeAngle: handoff.resumeAngle,
    keywords: handoff.keywords,
    coveredRequirements: handoff.coveredRequirements,
    partialRequirements: handoff.partialRequirements,
    gaps: handoff.gaps
  };
}

export function buildEvidenceCorpus(intake: IntakeData, extraEvidence = ""): string {
  return [
    intake.targetJobTitle,
    intake.currentTitle,
    intake.previousTitle,
    intake.additionalTitle,
    intake.tools,
    intake.selectedAiWorkflows.join(" "),
    intake.independentWorkType,
    intake.selectedIndependentWorkSignals.join(" "),
    intake.responsibilities,
    intake.selectedResponsibilities.join(" "),
    intake.selectedActions.join(" "),
    intake.customRoleIndustry,
    intake.customRoleWorkStyles.join(" "),
    intake.customRoleTransferableSkills.join(" "),
    intake.customRoleNotes,
    intake.outcomes,
    intake.selectedOutcomes.join(" "),
    intake.education,
    extraEvidence
  ]
    .join(" ")
    .toLowerCase();
}

function containsTerm(corpus: string, term: string): boolean {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(corpus);
}

function titleCaseSkill(term: string): string {
  return term
    .split(" ")
    .map((word) => (word.length > 2 ? word[0].toUpperCase() + word.slice(1) : word.toUpperCase()))
    .join(" ")
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOf\b/g, "of")
    .replace(/\bWith\b/g, "with");
}

function joinNaturally(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function applyTailoredContext(
  base: ResumePackage,
  context: TailoredResumeContext,
  intake: IntakeData,
  extraEvidence = ""
): { resume: ResumePackage; influence: TailoredInfluence } {
  const corpus = buildEvidenceCorpus(intake, extraEvidence);
  const gapText = context.gaps.join(" ").toLowerCase();

  // Partition the posting's keywords: only evidence-backed terms may be
  // claimed; anything tied to a gap requirement is off-limits regardless.
  const woven: string[] = [];
  const skipped: Array<{ term: string; reason: string }> = [];
  const gapsAvoided: string[] = [];

  for (const term of context.keywords) {
    const clean = term.trim();
    if (!clean) continue;
    const inGaps = containsTerm(gapText, clean);
    const inCorpus = containsTerm(corpus, clean);
    if (inGaps && !inCorpus) {
      gapsAvoided.push(clean);
      skipped.push({ term: clean, reason: "listed under a requirement you don't cover — claiming it would overstate" });
    } else if (!inCorpus) {
      skipped.push({ term: clean, reason: "no evidence in your answers or profile — add it there first if it's true" });
    } else {
      woven.push(clean);
    }
  }

  // --- Summary: one target-framing sentence up front, built only from the
  // user's own target and evidence-backed keywords.
  const targetLabel = context.roleTitle.trim() || context.laneTitle || "";
  const topWoven = woven.slice(0, 3);
  let targetFraming = "";
  if (targetLabel) {
    targetFraming = topWoven.length
      ? `Focused on ${targetLabel} work, with hands-on experience in ${joinNaturally(topWoven)}.`
      : `Focused on ${targetLabel} work.`;
  }
  const summary = targetFraming ? `${targetFraming} ${base.summary}`.trim() : base.summary;

  // --- Skills: evidence-backed posting keywords float to the front; new
  // evidence-backed keywords are added; gap terms never enter the list.
  const matchesWoven = (skill: string) => woven.some((term) => containsTerm(skill.toLowerCase(), term) || containsTerm(term.toLowerCase(), skill.toLowerCase()));
  const prioritized = base.coreSkills.filter((skill) => matchesWoven(skill));
  const rest = base.coreSkills.filter((skill) => !matchesWoven(skill));
  const additions = woven
    .filter((term) => !base.coreSkills.some((skill) => skill.toLowerCase() === term.toLowerCase() || containsTerm(skill.toLowerCase(), term)))
    .map(titleCaseSkill);
  const coreSkills = [...prioritized, ...additions, ...rest].slice(0, 15);

  // --- Bullets: within each role, bullets that speak to the posting's
  // evidence-backed keywords move to the top. No text is rewritten.
  const experience = base.experience.map((role) => {
    const hits = role.bullets.filter((bullet) => woven.some((term) => containsTerm(bullet.toLowerCase(), term)));
    const others = role.bullets.filter((bullet) => !hits.includes(bullet));
    return { ...role, bullets: [...hits, ...others] };
  });

  const influence: TailoredInfluence = {
    targetFraming,
    keywordsWoven: woven,
    keywordsSkipped: skipped,
    gapsAvoided,
    angleUsed: context.resumeAngle.trim() ? context.resumeAngle.trim() : null,
    coveredEmphasized: context.coveredRequirements,
    summaryText: buildInfluenceSummary(targetLabel, woven, skipped, gapsAvoided, context)
  };

  return {
    resume: { ...base, summary, coreSkills, experience },
    influence
  };
}

function buildInfluenceSummary(
  targetLabel: string,
  woven: string[],
  skipped: Array<{ term: string; reason: string }>,
  gapsAvoided: string[],
  context: TailoredResumeContext
): string {
  const parts: string[] = [];
  if (targetLabel) parts.push(`Framed for ${targetLabel}${context.company ? ` at ${context.company}` : ""}.`);
  if (woven.length) parts.push(`Wove in evidence-backed keywords: ${woven.join(", ")}.`);
  if (gapsAvoided.length) parts.push(`Declined to claim gap terms: ${gapsAvoided.join(", ")}.`);
  const unsupported = skipped.length - gapsAvoided.length;
  if (unsupported > 0) parts.push(`${unsupported} posting keyword${unsupported === 1 ? "" : "s"} skipped for lack of evidence.`);
  if (context.laneTitle) parts.push(`Angle: ${context.laneTitle} lane.`);
  return parts.join(" ");
}
