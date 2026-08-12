import type {
  StoryFact,
  StoryFactCategory,
  StoryFactCertainty,
  StoryFactDisposition,
  StoryFactPrecision
} from "@/types/dossier";

export type StoryRoleCandidate = { id: string; employer: string; title: string; responsibilities: string[]; dateFactIds: string[]; informal: boolean };
export type StoryProjectCandidate = { id: string; name: string; description: string; organization: string; volunteer: boolean; responsibilityFactIds: string[]; dateFactIds: string[] };
export type StoryFactContract = {
  rawStory: string;
  facts: StoryFact[];
  roles: StoryRoleCandidate[];
  projects: StoryProjectCandidate[];
  explicitNoMetrics: boolean;
  silentlyLostCount: number;
  readiness: "review-incomplete" | "foundation" | "sparse";
};

const uncertainty = /\b(?:about|approximately|around|roughly|maybe|perhaps|I think|I do not remember|I don't remember|I am not sure|I'm not sure|sometime|on and off|a few|two or three)\b/i;
const noMetric = /\b(?:do not know|don't know|did not track|didn't track|cannot quantify|can't quantify|no|without)\b[^.!?]{0,45}\b(?:numbers?|metrics?|measurements?|quantif(?:y|ied)|counts?|percentages?)\b|\b(?:there were|we had) no metrics\b/i;
const gapPattern = /\b(?:career gap|took (?:a year|time|some time) (?:away|off)|unemployed|between jobs|job searching|looking for work|store closed|time away)\b/i;
const transitionPattern = /\b(?:career transition|changing industries|new direction|transition(?:ing)?|moving toward|moving into|return(?:ed|ing) to work|returned to job searching)\b/i;
const aspirationPattern = /\b(?:want(?:ed)? to|would like to|hope to|aiming for|targeting|moving toward|moving into|transitioning into|looking to|trying to)\b/i;
const projectPattern = /\b(?:project|portfolio|spreadsheet|automation|website|app|event coordination|community initiative)\b/i;
const volunteerPattern = /\b(?:volunteer|community|unpaid|pro bono)\b/i;
const informalPattern = /\b(?:informal|freelance|gig|cash work|family business|family-business|side work|odd jobs|caregiv(?:er|ing)|self-directed|independent)\b/i;

function clean(value: string): string {
  return value.replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "").replace(/\s+/g, " ").trim();
}

function entity(value: string): string {
  const trimmed = clean(value).replace(/^(?:a|an)\s+/i, "");
  if (!trimmed || /[A-Z].*[A-Z]/.test(trimmed)) return trimmed;
  return trimmed.split(" ").map((part) => /^(?:and|of|the|for)$/i.test(part) ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function sentences(story: string): Array<{ text: string; start: number; end: number }> {
  const result: Array<{ text: string; start: number; end: number }> = [];
  const matcher = /[^.!?\n]+(?:[.!?]+|$)/g;
  for (const match of story.matchAll(matcher)) {
    const raw = match[0];
    const leading = raw.search(/\S/);
    if (leading < 0) continue;
    const text = raw.trim();
    if (text.length < 2) continue;
    const start = (match.index ?? 0) + leading;
    result.push({ text, start, end: start + text.length });
  }
  return result;
}

function firstGroup(sentence: string, pattern: RegExp): { value: string; index: number } | null {
  const match = pattern.exec(sentence);
  if (!match?.[1]) return null;
  const value = clean(match[1]);
  return value ? { value, index: match.index + match[0].indexOf(match[1]) } : null;
}

function fact(
  rawStory: string,
  category: StoryFactCategory,
  sourceText: string,
  sourceStart: number,
  candidateValue: string,
  certainty: StoryFactCertainty,
  precision: StoryFactPrecision,
  associationId?: string,
  disposition?: StoryFactDisposition
): StoryFact {
  const reviewRequired = certainty !== "exact" && certainty !== "not-applicable";
  const finalDisposition = disposition ?? (reviewRequired ? "needs-review" : "represented");
  return {
    id: stableId("story-fact", `${category}|${sourceStart}|${candidateValue.toLowerCase()}`),
    category,
    sourceExcerpt: sourceText,
    sourceStart,
    sourceEnd: Math.min(rawStory.length, sourceStart + sourceText.length),
    candidateValue: clean(candidateValue),
    userWording: sourceText,
    certainty,
    precision,
    reviewRequired,
    disposition: finalDisposition,
    associationId,
    origin: sourceText.trim().toLowerCase() === candidateValue.trim().toLowerCase() ? "user-supplied" : "parser-separated",
    downstreamClaims: [],
    updatedAt: new Date(0).toISOString()
  };
}

function dateFacts(rawStory: string, sentence: { text: string; start: number }, associationId?: string): StoryFact[] {
  const found: StoryFact[] = [];
  const patterns: Array<[RegExp, StoryFactCertainty, StoryFactPrecision]> = [
    [/\b(from\s+(?:early |mid |late )?(?:19|20)\d{2}\s+(?:to|through|until|-)\s+(?:present|now|current|(?:early |mid |late )?(?:19|20)\d{2}))/i, "exact", "range"],
    [/\b(sometime between\s+(?:19|20)\d{2}\s+and\s+(?:19|20)\d{2})\b/i, "bounded-range", "range"],
    [/\b(two or three years|\d+\s+or\s+\d+\s+years?)\b/i, "bounded-range", "duration"],
    [/\b(for (?:about |around |roughly |approximately )?(?:a few|several|\d+) years?)\b/i, "approximate", "duration"],
    [/\b((?:around|about|roughly|approximately|sometime in|maybe|may have been|I think it (?:started|ended) in)\s+(?:19|20)\d{2})\b/i, "approximate", "year"],
    [/\b((?:early|mid|late)\s+(?:19|20)\d{2})\b/i, "approximate", "year"],
    [/\b((?:19|20)\d{2})\b/i, "exact", "year"],
    [/\b(currently|still doing it|present|now)\b/i, "exact", "current"],
    [/\b(on and off)\b/i, "user-estimated", "duration"],
    [/\b((?:before|during|after) (?:the )?pandemic|after (?:college|graduation))\b/i, "approximate", "unknown"],
    [/\b((?:I\s+)?(?:do not|don't) remember (?:the )?(?:exact )?(?:start |end )?(?:months?|dates?)|I am not sure (?:of|about) (?:the )?(?:exact )?(?:start |end )?(?:months?|dates?))\b/i, "unknown", "unknown"]
  ];
  const occupied: Array<[number, number]> = [];
  for (const [pattern, certainty, precision] of patterns) {
    for (const match of sentence.text.matchAll(new RegExp(pattern.source, `${pattern.flags.includes("i") ? "i" : ""}g`))) {
      const value = clean(match[1] ?? match[0]);
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (occupied.some(([a, b]) => start >= a && end <= b)) continue;
      occupied.push([start, end]);
      found.push(fact(rawStory, "role-date", match[0], sentence.start + start, value, certainty, precision, associationId));
    }
  }
  return found;
}

const actionPattern = /\b(assisted|answered|built|cared for|checked|cleaned|coached|coordinated|created|delivered|documented|fixed|handled|helped|led|maintained|managed|organized|planned|prepared|processed|repaired|resolved|scheduled|shipped|stocked|supported|tested|tracked|trained|updated|wrote)\s+([^,.;]+?)(?=\s+and\s+(?:assisted|answered|built|cared for|checked|cleaned|coached|coordinated|created|delivered|documented|fixed|handled|helped|led|maintained|managed|organized|planned|prepared|processed|repaired|resolved|scheduled|shipped|stocked|supported|tested|tracked|trained|updated|wrote)\b|[,.;]|$)/gi;

/** Achievement-number detector used by both intake and the ATS receipt. */
export function hasAchievementMetric(text: string): boolean {
  const scrubbed = text
    .replace(/\b(?:19|20)\d{2}\b/g, "")
    .replace(/\b(?:v(?:ersion)?\s*)?\d+(?:\.\d+){1,3}\b/gi, "")
    .replace(/\b\d{5}(?:-\d{4})?\b/g, "")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "");
  return /(?:\$\s*\d|\d\s*%|\b\d+(?:\.\d+)?\+?\s+(?:customers?|clients?|users?|tickets?|calls?|reports?|projects?|transactions?|orders?|accounts?|people|team members?|cases?|requests?|deliveries|hours?|minutes?|days?|weeks?|months?|per\s+(?:day|week|month|shift))\b)/i.test(scrubbed);
}

export function parseStoryFacts(rawStory: string): StoryFactContract {
  const raw = rawStory.trim();
  const facts: StoryFact[] = [];
  const roles: StoryRoleCandidate[] = [];
  const projects: StoryProjectCandidate[] = [];
  let currentRoleId: string | undefined;
  let explicitNoMetrics = false;

  for (const sentence of sentences(raw)) {
    const before = facts.length;
    let sentenceProjectId: string | undefined;
    const name = firstGroup(sentence.text, /\bmy name is\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]{1,60}?)(?=,|\s+and\b|[.!?]|$)/i);
    if (name) facts.push(fact(raw, "identity", name.value, sentence.start + name.index, name.value, "exact", "qualitative"));
    for (const email of sentence.text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)) {
      facts.push(fact(raw, "identity", email[0], sentence.start + (email.index ?? 0), email[0], "exact", "qualitative"));
    }

    let employer = firstGroup(sentence.text, /\b(?:worked|work|served|volunteered|helped)\s+(?:at|for|with)\s+(.+?)(?=\s+(?:as\b|from\b|since\b|around\b|for\s+(?:a|about|around|roughly|approximately|few|several|two|three|\d)|but\b|where\b|and\s+(?:I|we)\b)|[,.;]|$)/i);
    let title = firstGroup(sentence.text, /\b(?:worked|served|was|am)\s+(?:at\s+.+?\s+)?as\s+(?:an?\s+)?(.+?)(?=\s+(?:at\b|for\b|from\b|since\b|around\b|but\b|where\b)|[,.;]|$)/i);
    const founded = firstGroup(sentence.text, /\bfounded\s+(?:an?\s+|the\s+)?(.+?)(?=\s+(?:in|around|during)\s+(?:19|20)\d{2}\b|[,.;]|$)/i);
    if (founded) {
      employer = founded;
      title = { value: "Founder", index: founded.index };
    }
    const wasRole = /\b(?:I\s+)?(?:was|am)\s+(?:an?\s+)?(.+?)\s+at\s+(.+?)(?=\s+(?:from|since|around|for|but|where)\b|[,.;]|$)/i.exec(sentence.text);
    if (wasRole) {
      const titleIndex = (wasRole.index ?? 0) + wasRole[0].indexOf(wasRole[1]);
      const employerIndex = (wasRole.index ?? 0) + wasRole[0].lastIndexOf(wasRole[2]);
      title = { value: clean(wasRole[1]), index: titleIndex };
      employer = { value: clean(wasRole[2]), index: employerIndex };
    }
    if (employer || title || /\b(?:worked|served|volunteered|founded)\b/i.test(sentence.text)) {
      const employerValue = employer ? entity(employer.value) : "";
      const titleValue = title ? entity(title.value) : "";
      const roleSeed = `${employerValue}|${titleValue}|${roles.length}`;
      currentRoleId = stableId("story-role", roleSeed.toLowerCase());
      const role: StoryRoleCandidate = { id: currentRoleId, employer: employerValue, title: titleValue, responsibilities: [], dateFactIds: [], informal: informalPattern.test(sentence.text) || /\bvolunteered\b/i.test(sentence.text) };
      if (employer) facts.push(fact(raw, "employer", employer.value, sentence.start + employer.index, employerValue, uncertainty.test(employer.value) ? "unknown" : "exact", "qualitative", currentRoleId));
      if (title) facts.push(fact(raw, "title", title.value, sentence.start + title.index, titleValue, uncertainty.test(title.value) ? "unknown" : "exact", "qualitative", currentRoleId));
      if (/\b(?:title (?:was )?unknown|no formal title|not sure (?:whether|if) (?:my |the )?title|title was (?:lead|supervisor).*(?:not sure|uncertain))\b/i.test(sentence.text)) {
        facts.push(fact(raw, "title", sentence.text, sentence.start, "", "unknown", "unknown", currentRoleId));
      }
      const dates = dateFacts(raw, sentence, currentRoleId);
      facts.push(...dates);
      role.dateFactIds.push(...dates.map((item) => item.id));
      roles.push(role);
    } else if (currentRoleId && !projectPattern.test(sentence.text)) {
      const dates = dateFacts(raw, sentence, currentRoleId);
      facts.push(...dates);
      const role = roles.find((item) => item.id === currentRoleId);
      role?.dateFactIds.push(...dates.map((item) => item.id));
    }
    if (currentRoleId && /\b(?:no formal title|not sure (?:whether|if) (?:my |the )?title|title (?:was|is) unknown)\b/i.test(sentence.text) && !facts.some((item) => item.category === "title" && item.sourceStart === sentence.start)) {
      facts.push(fact(raw, "title", sentence.text, sentence.start, "", "unknown", "unknown", currentRoleId));
    }

    if (noMetric.test(sentence.text)) {
      explicitNoMetrics = true;
      facts.push(fact(raw, "metric", sentence.text, sentence.start, "No metric supplied", "not-applicable", "not-applicable", currentRoleId, "non-resume-context"));
    } else if (hasAchievementMetric(sentence.text)) {
      facts.push(fact(raw, "metric", sentence.text, sentence.start, sentence.text, "exact", "qualitative", currentRoleId));
    }

    if (gapPattern.test(sentence.text)) facts.push(fact(raw, "career-gap", sentence.text, sentence.start, sentence.text, uncertainty.test(sentence.text) ? "approximate" : "exact", "qualitative", undefined, "non-resume-context"));
    if (transitionPattern.test(sentence.text)) facts.push(fact(raw, "career-transition", sentence.text, sentence.start, sentence.text, uncertainty.test(sentence.text) ? "approximate" : "exact", "qualitative", undefined, "non-resume-context"));
    if (aspirationPattern.test(sentence.text)) {
      const target = firstGroup(sentence.text, /\b(?:want(?:ed)? to|would like to|hope to|aiming for|targeting|moving toward|moving into|transitioning into|looking to|trying to)\s+(?:move into\s+|become\s+|work (?:in|as)\s+)?(.+?)(?=[,.;]|$)/i);
      facts.push(fact(raw, "aspiration", sentence.text, sentence.start, target?.value ?? sentence.text, "exact", "qualitative", undefined, "non-resume-context"));
    }

    if (projectPattern.test(sentence.text) && /\b(?:built|building|created|creating|organized|developed|developing|made|launched|project|portfolio)\b/i.test(sentence.text)) {
      const named = firstGroup(sentence.text, /\b(?:built|building|created|creating|developed|developing|made|launched|organized)\s+(?:an?\s+|the\s+)?(.+?\b(?:project|spreadsheet|automation|website|app|initiative))(?=\s+(?:to|for|that|which|using|during)\b|[,.;]|$)/i);
      const fallback = firstGroup(sentence.text, /\b((?:volunteer|community|school|portfolio|personal|side|family-business|spreadsheet|automation|technical|creative)[^,.;]{0,50}\b(?:project|spreadsheet|automation|website|app|initiative))\b/i);
      const nameValue = clean(named?.value ?? fallback?.value ?? "Project");
      const projectId = stableId("story-project", `${nameValue.toLowerCase()}|${sentence.start}`);
      sentenceProjectId = projectId;
      const volunteer = volunteerPattern.test(sentence.text);
      facts.push(fact(raw, "project", sentence.text, sentence.start, nameValue, "exact", "qualitative", projectId));
      if (volunteer) facts.push(fact(raw, "volunteer-role", sentence.text, sentence.start, "Volunteer", "exact", "qualitative", projectId));
      const projectDates = dateFacts(raw, sentence, projectId).map((item) => ({ ...item, category: "project-date" as const }));
      facts.push(...projectDates.filter((item) => !facts.some((existing) => existing.id === item.id)));
      projects.push({ id: projectId, name: nameValue, description: sentence.text, organization: "", volunteer, responsibilityFactIds: [], dateFactIds: projectDates.map((item) => item.id) });
    }

    if (!/\b(?:want|hope|plan|trying) to (?:learn|use|gain)\b/i.test(sentence.text)) {
      const skillClause = firstGroup(sentence.text, /\b(?:used|using|worked with|skills? (?:include|included|are))\s+([^.;]+)/i);
      if (skillClause) {
        skillClause.value.split(/,|\band\b/i).map(clean).filter((value) => value.length > 1).forEach((value) => {
          facts.push(fact(raw, "skill", value, sentence.start + skillClause.index, value, "exact", "qualitative", sentenceProjectId ?? currentRoleId));
        });
      }
    }

    if (informalPattern.test(sentence.text)) {
      if (!sentenceProjectId && !currentRoleId) {
        const explicitKind = sentence.text.match(/\b(family[- ]business|freelance|gig work|caregiving|side work|independent work)\b/i)?.[1] ?? "Informal work";
        sentenceProjectId = stableId("story-project", `${explicitKind.toLowerCase()}|${sentence.start}`);
        projects.push({ id: sentenceProjectId, name: entity(explicitKind), description: sentence.text, organization: "", volunteer: volunteerPattern.test(sentence.text), responsibilityFactIds: [], dateFactIds: [] });
      }
      facts.push(fact(raw, "informal-work", sentence.text, sentence.start, sentence.text, uncertainty.test(sentence.text) ? "approximate" : "exact", "qualitative", sentenceProjectId ?? currentRoleId));
    }
    if (/\b(?:degree|certificate|certification|college|university|school|coursework|training program)\b/i.test(sentence.text) && !/\bwant to (?:learn|study)\b/i.test(sentence.text)) {
      facts.push(fact(raw, "education", sentence.text, sentence.start, sentence.text, uncertainty.test(sentence.text) ? "approximate" : "exact", "qualitative"));
    }

    for (const match of sentence.text.matchAll(new RegExp(actionPattern.source, "gi"))) {
      const objects = match[2].split(/\band\b/i).map(clean).filter(Boolean);
      const values = objects.length === 2 && objects.every((item) => item.split(/\s+/).length <= 6)
        ? objects.map((object) => clean(`${match[1]} ${object}`))
        : [clean(`${match[1]} ${match[2]}`)];
      for (const value of values) {
        if (!value || projectPattern.test(value) && /\b(?:built|created|organized|developed|made|launched)\b/i.test(value)) continue;
        const standaloneProject = /\b(?:project|volunteer|personal|portfolio|school|community|unpaid|side project)\b/i.test(sentence.text);
        const associationId = sentenceProjectId && (!currentRoleId || standaloneProject) ? sentenceProjectId : currentRoleId ?? sentenceProjectId;
        const item = fact(raw, "responsibility", match[0], sentence.start + (match.index ?? 0), value, "exact", "qualitative", associationId);
        facts.push(item);
        roles.find((role) => role.id === associationId)?.responsibilities.push(value);
        projects.find((project) => project.id === associationId)?.responsibilityFactIds.push(item.id);
      }
    }

    if (facts.length === before && sentence.text.replace(/[^A-Za-z0-9]/g, "").length > 8) {
      facts.push(fact(raw, "unresolved", sentence.text, sentence.start, sentence.text, "unsupported", "unknown", undefined, "unresolved"));
    }
  }

  const roleDates = facts.filter((item) => item.category === "role-date" && /\b(?:19|20)\d{2}\b/.test(item.candidateValue));
  const byAssociation = new Map<string, StoryFact[]>();
  roleDates.forEach((item) => {
    const key = item.associationId ?? "unassigned";
    byAssociation.set(key, [...(byAssociation.get(key) ?? []), item]);
  });
  for (const [associationId, dates] of byAssociation) {
    const years = new Set(dates.flatMap((item) => item.candidateValue.match(/(?:19|20)\d{2}/g) ?? []));
    const conflictLanguage = /\b(?:first said|later (?:said|remembered)|instead|conflict|may have been|or perhaps)\b/i.test(raw);
    if (conflictLanguage && years.size > 1 && dates.every((item) => !/\b(?:to|through|until|between)\b/i.test(item.candidateValue))) {
      const conflictGroup = stableId("story-conflict", `${associationId}|dates`);
      dates.forEach((date) => Object.assign(date, { certainty: "conflicting", disposition: "conflicting", reviewRequired: true, conflictGroup }));
    }
  }

  const distinct = facts.filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
  const supported = distinct.filter((item) => ["employer", "title", "responsibility", "project", "education"].includes(item.category));
  const unresolved = distinct.some((item) => item.reviewRequired || ["unresolved", "conflicting"].includes(item.disposition));
  return {
    rawStory: raw,
    facts: distinct,
    roles,
    projects,
    explicitNoMetrics,
    silentlyLostCount: 0,
    readiness: unresolved ? "review-incomplete" : supported.length >= 4 ? "foundation" : "sparse"
  };
}

export function updateStoryFact(facts: StoryFact[], id: string, patch: Partial<StoryFact>, nowIso = new Date().toISOString()): StoryFact[] {
  return facts.map((item) => item.id === id ? { ...item, ...patch, updatedAt: nowIso } : item);
}
