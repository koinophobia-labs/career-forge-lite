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
    .slice(0, 4);
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
  const scopeValues = [
    data.customersServed,
    data.ticketsHandled,
    data.projectsSupported,
    data.teamSizeSupported,
    data.callsHandled,
    data.revenueInfluenced,
    data.reportsCreated
  ];
  return scopeValues.some((value) => value.trim()) || /\d|\$|%/.test(JSON.stringify(resume.experience));
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
    /stuff|things|various|candidate targeting|customers customers|tickets tickets/i.test(JSON.stringify(resume)) ? 0 : 4
  ];
  const score = Math.min(100, scoreParts.reduce((sum, item) => sum + item, 0));

  const strongestSections = [
    resume.summary.trim().length > 80 ? "Professional summary" : "",
    resume.coreSkills.length >= 8 ? "Core skills" : "",
    bullets.length >= 3 ? "Experience bullets" : "",
    hasMetrics(data, resume) ? "Measurable scope" : "",
    resume.linkedinHeadline.length <= 115 && resume.linkedinHeadline.includes("|") ? "LinkedIn headline" : ""
  ].filter(Boolean);

  const suggestedImprovements = [
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
    strongestSections: strongestSections.length ? strongestSections : ["ATS-safe structure"],
    suggestedImprovements: suggestedImprovements.length ? suggestedImprovements : ["Tailor the top bullets and skills to each job before applying."]
  };
}
