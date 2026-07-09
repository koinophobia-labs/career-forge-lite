import type { JobPostAnalysis } from "@/lib/job-post-analyzer";
import { recommendResume, type ResumeRecommendation } from "@/lib/resume-pack";
import type { CareerProfile, TargetLane } from "@/types/command-center";

// The Match Brief is the deliverable the tailoring flow was missing: one
// copyable artifact per job post that answers "why do I fit, what do I say,
// and what do I send" — assembled strictly from the analysis, the profile,
// and the lane the user already claimed. Nothing here is synthesized beyond
// rearranging the user's own words, so nothing can be invented.

export type MatchStrength = "strong" | "moderate" | "stretch" | "unclear";

export type MatchBrief = {
  company: string;
  roleTitle: string;
  laneTitle: string | null;
  strength: MatchStrength;
  strengthDetail: string;
  fitSummary: string[];
  proofPoints: string[];
  weakSpots: string[];
  keywordsPresent: string[];
  keywordsMissing: string[];
  talkingPoints: string[];
  outreachMessage: string;
  // Keyword-backed suggestion of which finalized pack resume to send; null
  // when the brief was built without the job post text.
  resumeRecommendation: ResumeRecommendation | null;
  checklist: string[];
  honestyNote: string;
};

export const PRE_APPLY_CHECKLIST = [
  "Right resume attached — the recommended lane, or a conscious override",
  "Missing keywords mirrored into your materials only where they're actually true",
  "You can answer every weak spot above out loud without bluffing",
  "Outreach message personalized ([Name] replaced, claim double-checked) and ready to send",
  "Application tracked so the follow-up date gets set automatically"
];

export const MATCH_BRIEF_HONESTY_NOTE =
  "Everything above is assembled from your own profile, lane, and this job post — verify each claim is true as written before you send or say it. Replace anything in [brackets] yourself. Never invent credentials, employers, or metrics.";

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function splitProofPoints(proofPoints: string): string[] {
  return proofPoints
    .split(/\r?\n|;|(?<=[.!?])\s+/)
    .map((item) => item.trim().replace(/^[-*•]\s*/, "").replace(/[.;]\s*$/, ""))
    .filter((item) => item.length >= 15);
}

// Re-derives which claimed skill/keyword a covered requirement rests on, the
// same containment check the analyzer uses, so talking points can name the
// user's own words instead of parsing coaching prose.
function coverageSource(requirement: string, profile: CareerProfile, lane: TargetLane | null): string | null {
  const reqNorm = normalize(requirement);
  const skill = profile.transferableSkills.find((item) => item.trim() && reqNorm.includes(normalize(item)));
  if (skill) return skill;
  const keyword = (lane?.keywords ?? []).find((item) => item.trim() && reqNorm.includes(normalize(item)));
  return keyword ?? null;
}

function assessStrength(covered: number, partial: number, total: number): { strength: MatchStrength; detail: string } {
  if (total === 0) {
    return {
      strength: "unclear",
      detail: "The post didn't yield extractable requirements — judge fit from the keyword overlap instead."
    };
  }
  if (covered / total >= 0.5) {
    return {
      strength: "strong",
      detail: `You directly cover ${covered} of ${total} stated requirements. Apply with confidence — this is a real match, not a reach.`
    };
  }
  if ((covered + partial) / total >= 0.5) {
    return {
      strength: "moderate",
      detail: `You cover ${covered} of ${total} stated requirements outright and ${partial} partially. Worth applying — close the partials with better wording before you do.`
    };
  }
  return {
    strength: "stretch",
    detail: `You cover ${covered} of ${total} stated requirements${partial ? ` (${partial} partial)` : ""}. Apply if the company matters to you, but pair it with stronger-match applications this week.`
  };
}

function buildFitSummary(
  analysis: JobPostAnalysis,
  lane: TargetLane | null,
  covered: { requirement: string }[],
  total: number,
  partial: number
): string[] {
  const items: string[] = [];

  if (lane?.whyFit.trim()) items.push(lane.whyFit.trim());

  if (total > 0) {
    items.push(
      `You directly cover ${covered.length} of ${total} stated requirements${
        partial ? `, with ${partial} more partially covered` : ""
      }.`
    );
  }

  const sharedKeywords = analysis.keywords.filter((hit) => hit.inProfile).slice(0, 5);
  if (sharedKeywords.length) {
    items.push(
      `Shared vocabulary — the post uses these and your profile already claims them: ${sharedKeywords
        .map((hit) => hit.term)
        .join(", ")}. Mirror these exact words.`
    );
  }

  if (covered.length) {
    items.push(`Strongest claim: "${truncate(covered[0].requirement, 120)}" — you can state this outright.`);
  }

  if (!items.length) {
    items.push(
      "Nothing in your profile overlaps this post yet. Either the fit is genuinely thin, or your profile is missing experience you actually have — fix the profile before deciding."
    );
  }

  return items;
}

function rankProofPoints(profile: CareerProfile, analysis: JobPostAnalysis): string[] {
  const points = splitProofPoints(profile.proofPoints);
  const postTerms = analysis.keywords.map((hit) => normalize(hit.term));

  return points
    .map((point, index) => {
      const pointNorm = normalize(point);
      const score = postTerms.filter((term) => pointNorm.includes(term)).length;
      return { point, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 4)
    .map((entry) => entry.point);
}

function buildWeakSpots(analysis: JobPostAnalysis): string[] {
  const gaps = analysis.requirements.filter((req) => req.status === "gap").slice(0, 3);
  const items = gaps.map(
    (req) =>
      `The post asks for "${truncate(req.requirement, 120)}" and your profile doesn't support it yet — prepare an acknowledge-and-bridge answer.`
  );
  for (const spot of analysis.weakSpots) {
    if (!items.includes(spot)) items.push(spot);
  }
  return items.slice(0, 6);
}

function buildTalkingPoints(
  analysis: JobPostAnalysis,
  profile: CareerProfile,
  lane: TargetLane | null,
  roleTitle: string,
  proofPoints: string[]
): string[] {
  const items: string[] = [];
  const target = lane?.title || roleTitle.trim() || "this role";
  const situation = profile.currentSituation.trim();

  items.push(
    `Your opener — "why ${target}?": bridge from ${
      situation ? truncate(situation, 90) : "your current background"
    } to this work in under 60 seconds. Run toward the role, not away from your past.`
  );

  const covered = analysis.requirements.filter((req) => req.status === "covered").slice(0, 3);
  for (const req of covered) {
    const source = coverageSource(req.requirement, profile, lane);
    items.push(
      `They need "${truncate(req.requirement, 100)}" — claim it through ${
        source ? `your "${source}"` : "your closest real example"
      }, with one concrete story and a number if you have one.`
    );
  }

  if (proofPoints.length) {
    items.push(`Story to have cold: "${truncate(proofPoints[0], 140)}" — situation, your actions, the result.`);
  }

  const gapCount = analysis.requirements.filter((req) => req.status === "gap").length;
  if (gapCount > 0) {
    items.push(
      `Expect a probe on the ${gapCount} unsupported requirement${
        gapCount === 1 ? "" : "s"
      }: acknowledge plainly, bridge to your closest real experience, name your plan. Rehearse it on the Interview page.`
    );
  }

  return items;
}

function buildOutreachMessage(
  analysis: JobPostAnalysis,
  profile: CareerProfile,
  lane: TargetLane | null,
  company: string,
  roleTitle: string
): string {
  const covered = analysis.requirements.find((req) => req.status === "covered");
  const source = covered ? coverageSource(covered.requirement, profile, lane) : null;
  const topKeyword = analysis.keywords.find((hit) => hit.inProfile);

  let strongestMatch: string;
  if (covered && source) {
    strongestMatch = `my ${source} experience maps directly to your "${truncate(covered.requirement, 80)}" requirement`;
  } else if (topKeyword) {
    strongestMatch = `I bring real ${topKeyword.term} experience — the thing the post asks about most`;
  } else {
    strongestMatch = "[one specific, true match between your experience and the post — with a number if you have one]";
  }

  return `Hi [Name] — I just applied for the ${roleTitle.trim() || "[Role title]"} opening at ${
    company.trim() || "[Company]"
  }.

Quick reason to pull my application out of the pile: ${strongestMatch}.

I know you're busy; even a "we saw it" would be appreciated. Thanks either way.`;
}

export function buildMatchBrief(options: {
  analysis: JobPostAnalysis;
  profile: CareerProfile;
  lane: TargetLane | null;
  company: string;
  roleTitle: string;
  // Raw job post text; when provided, the brief includes a pack-resume
  // recommendation scored against it.
  jobPost?: string;
}): MatchBrief {
  const { analysis, profile, lane, company, roleTitle, jobPost } = options;

  const covered = analysis.requirements.filter((req) => req.status === "covered");
  const partial = analysis.requirements.filter((req) => req.status === "partial").length;
  const total = analysis.requirements.length;
  const { strength, detail } = assessStrength(covered.length, partial, total);
  const proofPoints = rankProofPoints(profile, analysis);

  return {
    company: company.trim(),
    roleTitle: roleTitle.trim(),
    laneTitle: lane?.title ?? null,
    strength,
    strengthDetail: detail,
    fitSummary: buildFitSummary(analysis, lane, covered, total, partial),
    proofPoints,
    weakSpots: buildWeakSpots(analysis),
    keywordsPresent: analysis.keywords.filter((hit) => hit.inProfile).map((hit) => hit.term),
    keywordsMissing: analysis.keywords.filter((hit) => !hit.inProfile).map((hit) => hit.term),
    talkingPoints: buildTalkingPoints(analysis, profile, lane, roleTitle, proofPoints),
    outreachMessage: buildOutreachMessage(analysis, profile, lane, company, roleTitle),
    resumeRecommendation: jobPost?.trim() ? recommendResume(jobPost) : null,
    checklist: [...PRE_APPLY_CHECKLIST],
    honestyNote: MATCH_BRIEF_HONESTY_NOTE
  };
}

function renderResumeRecommendation(recommendation: ResumeRecommendation): string {
  if (!recommendation.best) {
    return "RECOMMENDED RESUME\nNo lane matched this post's vocabulary — it's likely outside your four resume lanes. If you still want it, pick the closest resume manually.";
  }
  const lines = [
    "RECOMMENDED RESUME",
    `${recommendation.best.resume.fileName} (${recommendation.best.resume.laneTitle})`,
    `Why: the post uses ${recommendation.best.matchedTerms.slice(0, 8).join(", ")}.`,
    `Usage: ${recommendation.best.resume.usageNote}`
  ];
  if (recommendation.runnerUp && recommendation.runnerUp.resume.id !== recommendation.best.resume.id) {
    lines.push(
      `Runner-up: ${recommendation.runnerUp.resume.fileName} (matched ${recommendation.runnerUp.matchedTerms.slice(0, 5).join(", ")})`
    );
  }
  if (recommendation.weakFit) {
    lines.push(
      "Weak fit: even the best lane barely matches this post. Probably not worth a deep tailor — apply fast with the closest resume or skip it."
    );
  }
  lines.push(`Note: ${recommendation.note}`);
  return lines.join("\n");
}

function section(title: string, lines: string[]): string {
  return `${title}\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

export function renderMatchBrief(brief: MatchBrief): string {
  const target = [brief.roleTitle || "Role", brief.company ? `at ${brief.company}` : ""].filter(Boolean).join(" ");
  const parts: string[] = [
    `MATCH BRIEF — ${target}${brief.laneTitle ? ` (${brief.laneTitle} lane)` : ""}`,
    `Match strength: ${brief.strength.toUpperCase()} — ${brief.strengthDetail}`,
    ...(brief.resumeRecommendation ? [renderResumeRecommendation(brief.resumeRecommendation)] : []),
    section("WHY YOU FIT", brief.fitSummary),
    brief.proofPoints.length
      ? section("PROOF POINTS TO LEAD WITH", brief.proofPoints)
      : "PROOF POINTS TO LEAD WITH\n- None on file. Add proof points (projects, metrics, artifacts) to your profile — specifics are what get replies.",
    section("WEAK SPOTS TO PREPARE FOR", brief.weakSpots),
    [
      "RESUME KEYWORDS",
      `Already yours (mirror the post's wording): ${brief.keywordsPresent.join(", ") || "none detected"}`,
      `Add only if true: ${brief.keywordsMissing.join(", ") || "none — your profile already speaks this post's language"}`
    ].join("\n"),
    section("INTERVIEW TALKING POINTS", brief.talkingPoints),
    `OUTREACH MESSAGE DRAFT (LinkedIn DM or application follow-up)\n${brief.outreachMessage}`,
    `PRE-APPLY CHECKLIST\n${brief.checklist.map((item) => `[ ] ${item}`).join("\n")}`,
    `Honesty note: ${brief.honestyNote}`
  ];

  return parts.join("\n\n");
}
