import { isUncertaintyStatement } from "@/lib/truth-guards";
import type { ExperienceRole, IntakeData, ResumePackage } from "@/types/career";

export type ResumeQualityRating = "Needs Work" | "Good" | "Strong" | "Excellent";

export type ResumeQualityAnalysis = {
  rating: ResumeQualityRating;
  score: number;
  strongestSections: string[];
  suggestedImprovements: string[];
};

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
  // No `it` -> `IT` rule. "it" is an ordinary English pronoun far more often
  // than an acronym, so the rule rewrote the user's sentence: "Checked every
  // shipment before it left the dock" rendered as "…before IT left the dock".
  // A casing table cannot disambiguate this; the cost of being wrong is a
  // corrupted sentence in a document the user sends to an employer.
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

// Punctuation and spacing only — it must not change the user's words.
// Three rules were removed because they did:
//   /\b(\w+)\s+\1\b/  deleted ANY repeated word, so "Walla Walla distribution
//                     center" became "walla distribution center" — a falsified
//                     place name — and "had had" lost a verb. Repetition is now
//                     collapsed only for a closed list of stopwords, where a
//                     genuine double is always a typo.
//   /\ba ([aeiou])/   rewrote correct English: "a user group" -> "an user
//                     group", "a unique path" -> "an unique path". Correct
//                     article choice follows the vowel SOUND, which a regex
//                     cannot determine, so the user's own article stands.
//   /\s+(and|or|with)$/ silently truncated the last word of a bullet.
function normalizePunctuation(value: string) {
  let cleaned = cleanWhitespace(value)
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,.!?;:]){2,}/g, "$1")
    .replace(/\b(the|and|of|to|a|an|in|on|for|that|is|was)\s+\1\b/gi, "$1");

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

// Voice normalisation ONLY. This function may remove filler and drop a leading
// first-person pronoun; it may not add an activity, and it may not swap the
// user's verb for a stronger one.
//
// It previously expanded a thin phrase into a multi-claim sentence — "answered
// phones" became "Managed inbound calls while assisting customers and routing
// requests appropriately", asserting two activities the user never mentioned —
// and mapped "handled"/"responsible for" onto "Managed", which escalates the
// claim. Both reached the résumé a user prints from /resume-builder.
//
// A phrase too thin for a résumé is a coaching problem, not a rewriting
// problem: analyzeResumeQuality already surfaces weak openers as a suggestion,
// which leaves the sentence — and the claim — the user's own.
function replaceWeakLanguage(value: string) {
  let next = value.replace(/^(i|we)\s+/i, "");
  weakTerms.forEach((pattern) => {
    next = next.replace(pattern, "");
  });
  return cleanWhitespace(next);
}

export function polishResumeSentence(value: string) {
  return normalizePunctuation(sentenceCase(replaceWeakLanguage(applySpellingAndCapitalization(value))));
}

// Opening-verb diversification is gone. It replaced the first word of any bullet
// whose opener had already been used with the next unused entry of a global
// action-verb list — so three lines the user opened with "Maintained" came back
// as "Maintained …", "Built …", "Developed …", turning a maintenance claim into
// a creation claim. Variety is not worth a false verb, and repeated openers are
// already reported to the user as a suggestion by analyzeResumeQuality.
export function polishBullets(bullets: string[]) {
  return unique(bullets.map(polishResumeSentence))
    .filter((bullet) => bullet.length > 24)
    .slice(0, 5);
}

// Verbatim-fidelity polish: spelling, acronym casing, sentence case and
// punctuation only. No weak-language expansion and no opening-verb
// diversification, because both replace words the user did not write. Use this
// anywhere the surface promises the user their own approved wording back.
export function polishResumeSentenceVerbatim(value: string) {
  return normalizePunctuation(sentenceCase(applySpellingAndCapitalization(value)));
}

export function polishBulletsVerbatim(bullets: string[]) {
  return unique(bullets.map(polishResumeSentenceVerbatim))
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
