import { isUncertaintyStatement } from "@/lib/truth-guards";
import type { ExperienceRole, IntakeData, ResumePackage } from "@/types/career";

export type ResumeQualityRating = "Needs Work" | "Good" | "Strong" | "Excellent";

export type ResumeQualityAnalysis = {
  rating: ResumeQualityRating;
  score: number;
  strongestSections: string[];
  suggestedImprovements: string[];
};

const actionVerbs = [
  "Built",
  "Developed",
  "Created",
  "Implemented",
  "Led",
  "Supported",
  "Coordinated",
  "Designed",
  "Resolved",
  "Maintained",
  "Executed",
  "Improved",
  "Analyzed",
  "Automated",
  "Optimized",
  "Configured",
  "Collaborated",
  "Produced",
  "Delivered",
  "Generated",
  "Assisted",
  "Documented",
  "Tracked",
  "Communicated"
];

const weakOpeners: Array<[RegExp, string]> = [
  [/^helped customers\b/i, "Assisted customers"],
  [/^helped users\b/i, "Assisted users"],
  [/^helped\b/i, "Supported"],
  [/^did\b/i, "Completed"],
  [/^worked on\b/i, "Supported"],
  [/^responsible for\b/i, "Managed"],
  [/^handled\b/i, "Managed"],
  [/^made\b/i, "Created"],
  [/^built\b/i, "Built"]
];

const weakTerms = [
  /\bstuff\b/gi,
  /\bthings\b/gi,
  /\bvarious\b/gi,
  /\bcandidate targeting\b/gi,
  /\bcustomers customers\b/gi,
  /\btickets tickets\b/gi,
  /\bdocumented documentation\b/gi
];

const spellingFixes: Array<[RegExp, string]> = [
  [/\bcustomer sucess\b/gi, "customer success"],
  [/\badminstrative\b/gi, "administrative"],
  [/\bmanagment\b/gi, "management"],
  [/\bcomunication\b/gi, "communication"],
  [/\bdoucmentation\b/gi, "documentation"],
  [/\brecieved\b/gi, "received"]
];

const acronymFixes: Array<[RegExp, string]> = [
  [/\bai\b/gi, "AI"],
  [/\bcrm\b/gi, "CRM"],
  [/\bats\b/gi, "ATS"],
  [/\bsql\b/gi, "SQL"],
  [/\bit\b/gi, "IT"],
  [/\bapi\b/gi, "API"],
  [/\bkpi\b/gi, "KPI"],
  [/\brf\b/gi, "RF"],
  [/\bpos\b/gi, "POS"],
  [/\bqa\b/gi, "QA"],
  [/\bwms\b/gi, "WMS"],
  [/\bui\b/gi, "UI"],
  [/\bux\b/gi, "UX"]
];

function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function unique(items: string[]) {
  const seen = new Set<string>();
  return items
    .map(cleanWhitespace)
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function sentenceCase(value: string) {
  const clean = cleanWhitespace(value);
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "";
}

function normalizePunctuation(value: string) {
  let cleaned = cleanWhitespace(value)
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,.!?;:]){2,}/g, "$1")
    .replace(/\b(\w+)\s+\1\b/gi, "$1")
    .replace(/\ba ([aeiou])/gi, "an $1")
    .replace(/\s+(and|or|with)$/i, "")
    .replace(/\s+(and|or|with)\.$/i, ".");

  if (cleaned && !/[.!?]$/.test(cleaned)) cleaned += ".";
  return cleaned;
}

function applySpellingAndCapitalization(value: string) {
  let next = value;
  spellingFixes.forEach(([pattern, replacement]) => {
    next = next.replace(pattern, replacement);
  });
  acronymFixes.forEach(([pattern, replacement]) => {
    next = next.replace(pattern, replacement);
  });
  return next;
}

function replaceWeakLanguage(value: string) {
  let next = value
    .replace(/^(i|we)\s+/i, "")
    .replace(/\banswered phones\.?$/i, "Managed inbound calls while assisting customers and routing requests appropriately.")
    .replace(/\bdid cash register\.?$/i, "Processed customer transactions accurately using point-of-sale systems.")
    .replace(/\bstocked shelves\.?$/i, "Maintained organized inventory and restocked merchandise to support daily operations.");
  weakOpeners.forEach(([pattern, replacement]) => {
    next = next.replace(pattern, replacement);
  });
  weakTerms.forEach((pattern) => {
    next = next.replace(pattern, "");
  });

  next = next
    .replace(/\bAssisted customers\.?$/i, "Assisted customers by resolving questions and providing accurate support.")
    .replace(/\bAnswered phones\.?$/i, "Managed inbound calls while assisting customers and routing requests appropriately.")
    .replace(/\bDid cash register\.?$/i, "Processed customer transactions accurately using point-of-sale systems.")
    .replace(/\bMaintained shelves\.?$/i, "Maintained organized inventory and restocked merchandise to support daily operations.")
    .replace(/\bstocked shelves\.?$/i, "Maintained organized inventory and restocked merchandise to support daily operations.");

  return cleanWhitespace(next);
}

export function polishResumeSentence(value: string) {
  return normalizePunctuation(sentenceCase(replaceWeakLanguage(applySpellingAndCapitalization(value))));
}

function diversifyOpeningVerbs(bullets: string[]) {
  const used = new Set<string>();

  return bullets.map((bullet) => {
    const opener = bullet.split(" ")[0] ?? "";
    const openerKey = opener.toLowerCase();
    if (!used.has(openerKey)) {
      used.add(openerKey);
      return bullet;
    }

    const replacement = actionVerbs.find((verb) => !used.has(verb.toLowerCase()));
    if (!replacement) return bullet;
    used.add(replacement.toLowerCase());
    return bullet.replace(/^\w+/, replacement);
  });
}

export function polishBullets(bullets: string[]) {
  return unique(diversifyOpeningVerbs(bullets.map(polishResumeSentence)))
    .filter((bullet) => bullet.length > 24)
    .slice(0, 5);
}

function polishRole(role: ExperienceRole): ExperienceRole {
  return {
    ...role,
    title: cleanWhitespace(role.title),
    company: cleanWhitespace(role.company),
    time: cleanWhitespace(role.time),
    bullets: polishBullets(role.bullets)
  };
}

function polishSkills(skills: string[]) {
  return unique(
    skills.map((skill) => {
      let next = applySpellingAndCapitalization(skill);
      weakTerms.forEach((pattern) => {
        next = next.replace(pattern, "");
      });
      return cleanWhitespace(next);
    })
  )
    .map((skill) => skill.replace(/[.!?]+$/g, ""))
    .filter((skill) => skill.length > 1)
    // Skill labels stay labels: no first-person fragments ("I Own Onboarding")
    // and no sentence-length entries.
    .filter((skill) => !/^(i|we|my|our)\b/i.test(skill) && skill.split(/\s+/).length <= 5)
    .slice(0, 14);
}

function polishHeadline(value: string) {
  const cleaned = applySpellingAndCapitalization(value)
    .split("|")
    .map(cleanWhitespace)
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");
  return cleaned.length > 115 ? `${cleaned.slice(0, 112).replace(/\s+\S*$/, "")}...` : cleaned;
}

export function polishResumePackage(resume: ResumePackage): ResumePackage {
  return {
    ...resume,
    summary: polishResumeSentence(resume.summary).replace(/\s+(with|and|or)\.$/i, "."),
    coreSkills: polishSkills(resume.coreSkills),
    experience: resume.experience.map(polishRole),
    education: cleanWhitespace(resume.education),
    linkedinHeadline: polishHeadline(resume.linkedinHeadline),
    linkedinSummary: polishResumeSentence(resume.linkedinSummary)
  };
}

function hasMetrics(data: IntakeData, resume: ResumePackage) {
  // "Quantified" requires an actual number: uncertainty statements saved in a
  // scope field ("I don't know my numbers") and date strings do not count.
  const scopeValues = [
    data.customersServed,
    data.ticketsHandled,
    data.projectsSupported,
    data.teamSizeSupported,
    data.callsHandled,
    data.revenueInfluenced,
    data.reportsCreated
  ];
  const scopeHasNumber = scopeValues.some((value) => /\d/.test(value) && !isUncertaintyStatement(value));
  const narrative = [resume.summary, ...resume.experience.flatMap((role) => role.bullets)].join(" ");
  return scopeHasNumber || /\d/.test(narrative);
}

// Placeholder tokens make a draft unsendable; each one caps the grade and is
// called out by name.
function findPlaceholderProblems(data: IntakeData, resume: ResumePackage) {
  const problems: string[] = [];
  if (!data.fullName.trim()) problems.push('add your real name (documents currently say "Candidate Name")');
  resume.experience.forEach((role) => {
    if (/^(current|previous|additional) company$/i.test(role.company.trim())) problems.push(`add the real company for "${role.title}"`);
    if (/^dates$/i.test(role.time.trim())) problems.push(`add real dates for "${role.title}"`);
  });
  return problems;
}

// Word-salad titles ("Csm Managing 45 Mid-market Accounts Worth About $3")
// fail readability instead of passing silently.
function messyTitleProblems(resume: ResumePackage) {
  return resume.experience
    .filter((role) => role.title.split(/\s+/).length > 6 || /\$|\d/.test(role.title) || /\b(i|we|my)\b/i.test(role.title))
    .map((role) => `Shorten the job title "${role.title}" to a real title (2-4 words, no numbers).`);
}

function repeatedOpeners(resume: ResumePackage) {
  return resume.experience.some((role) => {
    const openers = role.bullets.map((bullet) => bullet.split(" ")[0]?.toLowerCase()).filter(Boolean);
    return openers.length !== new Set(openers).size;
  });
}

function hasLeadership(data: IntakeData, resume: ResumePackage) {
  const text = JSON.stringify([data.selectedActions, data.responsibilities, resume.experience]).toLowerCase();
  return /\b(led|trained|supervised|coordinated|owned|managed|mentor|leadership)\b/.test(text);
}

function hasProjects(data: IntakeData) {
  return [data.projectsSupported, data.additionalTitle, data.customRoleNotes, data.responsibilities].some((value) => /project|portfolio|built|created|launched/i.test(String(value)));
}

function ratingForScore(score: number): ResumeQualityRating {
  if (score >= 90) return "Excellent";
  if (score >= 78) return "Strong";
  if (score >= 62) return "Good";
  return "Needs Work";
}

export function analyzeResumeQuality(data: IntakeData, resume: ResumePackage): ResumeQualityAnalysis {
  const bullets = resume.experience.flatMap((role) => role.bullets.filter(Boolean));
  const placeholderProblems = findPlaceholderProblems(data, resume);
  const titleProblems = messyTitleProblems(resume);
  const overlongBullets = bullets.filter((bullet) => bullet.split(/\s+/).length > 30);
  const firstPersonSkills = resume.coreSkills.filter((skill) => /^(i|we|my)\b/i.test(skill));
  const scoreParts = [
    resume.summary.trim().length > 80 ? 12 : 6,
    resume.coreSkills.length >= 8 ? 12 : resume.coreSkills.length >= 4 ? 8 : 3,
    bullets.length >= Math.max(resume.experience.length * 2, 2) ? 14 : 6,
    repeatedOpeners(resume) ? 4 : 10,
    hasMetrics(data, resume) ? 12 : 4,
    bullets.some((bullet) => /improved|supported|maintained|resolved|coordinated|documented|tracked/i.test(bullet)) ? 12 : 5,
    hasLeadership(data, resume) ? 8 : 4,
    hasProjects(data) ? 6 : 3,
    resume.experience.every((role) => role.title && role.company && role.time) ? 10 : 4,
    /stuff|things|various|candidate targeting|customers customers|tickets tickets/i.test(JSON.stringify(resume)) ? 0 : 4,
    titleProblems.length || overlongBullets.length || firstPersonSkills.length ? 0 : 4
  ];
  const rawScore = Math.min(100, scoreParts.reduce((sum, item) => sum + item, 0));
  // Placeholder text is disqualifying: the meter must never praise a draft
  // that still says "Candidate Name", "Current Company", or "Dates".
  const score = placeholderProblems.length
    ? Math.min(rawScore, 45)
    : titleProblems.length || firstPersonSkills.length
      ? Math.min(rawScore, 74)
      : hasMetrics(data, resume)
        ? rawScore
        : Math.min(rawScore, 88); // no numbers at all: never "Excellent"

  const strongestSections = [
    resume.summary.trim().length > 80 && !titleProblems.length ? "Professional summary" : "",
    resume.coreSkills.length >= 8 && !firstPersonSkills.length ? "Core skills" : "",
    bullets.length >= 3 && !overlongBullets.length ? "Experience bullets" : "",
    hasMetrics(data, resume) ? "Measurable scope" : "",
    resume.linkedinHeadline.length <= 115 && resume.linkedinHeadline.includes("|") ? "LinkedIn headline" : ""
  ].filter(Boolean);

  const suggestedImprovements = [
    ...placeholderProblems.map((problem) => `Not ready to send: ${problem}.`),
    ...titleProblems,
    overlongBullets.length ? "Split bullets longer than 30 words into shorter, single-claim lines." : "",
    firstPersonSkills.length ? `Rewrite first-person skill entries (${firstPersonSkills.slice(0, 2).join(", ")}) as short skill labels.` : "",
    hasMetrics(data, resume) ? "" : "Add approximate numbers for customers, tickets, projects, reports, calls, money handled, or team size.",
    hasLeadership(data, resume) ? "" : "Add leadership, training, ownership, or collaboration examples if they are true.",
    hasProjects(data) ? "" : "Add a project, portfolio item, coursework example, or workflow improvement if relevant.",
    repeatedOpeners(resume) ? "Vary repeated opening verbs in the same role." : "",
    resume.experience.some((role) => !role.company || role.company.includes("Company") || !role.time || role.time === "Dates")
      ? "Add company names and date ranges for every role you want to include."
      : ""
  ].filter(Boolean);

  return {
    rating: ratingForScore(score),
    score,
    strongestSections: placeholderProblems.length ? [] : strongestSections.length ? strongestSections : ["ATS-safe structure"],
    suggestedImprovements: suggestedImprovements.length ? suggestedImprovements : ["Tailor the top bullets and skills to each job before applying."]
  };
}
