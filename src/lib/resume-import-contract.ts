import type {
  EvidenceKind,
  ImportEducationCandidate,
  ImportProjectCandidate,
  ImportProposalDisposition,
  ImportProposalField,
  ImportProposalGroup,
  ImportProposalRecord,
  ImportProposalValidation,
  ImportRoleCandidate,
  ImportSourceSection
} from "@/types/dossier";

type SourceLine = {
  text: string;
  filename: string;
  position: number;
  section: ImportSourceSection;
};

type Candidate = Omit<ImportProposalRecord, "id">;

const sectionHeadings = new Map<string, ImportSourceSection>([
  ["SUMMARY", "summary"], ["PROFILE", "summary"], ["PROFESSIONAL SUMMARY", "summary"],
  ["EXPERIENCE", "experience"], ["PROFESSIONAL EXPERIENCE", "experience"], ["WORK EXPERIENCE", "experience"], ["EMPLOYMENT", "experience"],
  ["EDUCATION", "education"], ["PROJECTS", "projects"], ["SELECTED PROJECTS", "projects"],
  ["SKILLS", "skills"], ["TECHNICAL SKILLS", "skills"], ["CORE SKILLS", "skills"],
  ["CERTIFICATIONS", "certifications"], ["VOLUNTEER EXPERIENCE", "volunteer"], ["VOLUNTEERING", "volunteer"],
  ["LEADERSHIP", "leadership"], ["AWARDS", "awards"], ["CONTACT", "contact"]
]);

const titleWords = /\b(associate|assistant|administrator|advisor|analyst|architect|cashier|chef|consultant|coordinator|cook|developer|director|driver|engineer|founder|intern|lead|manager|officer|operator|owner|representative|specialist|supervisor|support|teacher|technician|writer)\b/i;
const institutionWords = /\b(university|college|school|institute|academy|polytechnic)\b/i;
const credentialWords = /\b(bachelor|master|associate(?:'s)?|doctorate|degree|certificate|certification|diploma|ph\.?d|m\.?s|m\.?a|b\.?s|b\.?a)\b/i;
const monthToken = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const yearToken = "(?:19|20)\\d{2}";
const dateToken = `${monthToken}\\.?\\s+(?:(?:[0-3]?\\d),?\\s+)?${yearToken}|${yearToken}`;
const dateRangePattern = new RegExp(`(?:${dateToken})\\s*(?:-|\\u2013|\\u2014|to)\\s*(?:Present|Current|Now|${dateToken})`, "i");
const singleDatePattern = new RegExp(`(?:${dateToken})`, "i");

function compact(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[\u2013\u2014]/g, "-").replace(/[^\p{L}\p{N}+#.]+/gu, " ").replace(/\s+/g, " ").trim();
}

function normalizedUrl(value: string): string {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = url.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${pathname}${url.search}`;
  } catch {
    return normalized(value);
  }
}

function headingKey(value: string): string {
  const withoutDecoration = value.trim().replace(/:+$/, "").replace(/^[\s_=*.-]+|[\s_=*.-]+$/g, "").trim();
  const letters = withoutDecoration.split(/\s+/);
  const collapsed = letters.length >= 4 && letters.every((part) => /^\p{L}$/u.test(part)) ? letters.join("") : withoutDecoration;
  return collapsed.replace(/\s+/g, " ").toUpperCase();
}

function headingSection(value: string): ImportSourceSection | null {
  return sectionHeadings.get(headingKey(value)) ?? null;
}

function isFormattingNoise(value: string): boolean {
  return /^[\s_=*~.-]{3,}$/.test(value) ||
    /^page\s+\d+(?:\s+of\s+\d+)?$/i.test(value) ||
    /^\d+\s*\/\s*\d+$/.test(value) ||
    /^(?:.{1,60}\s+[\u2013\u2014|-]\s+)?r[eé]sum[eé](?:\s+.{1,30})?$/i.test(value);
}

function dateInfo(value: string): { raw: string; startDate: string; endDate: string; current: boolean; precision: ImportRoleCandidate["datePrecision"] } | null {
  const raw = value.match(dateRangePattern)?.[0] ?? value.match(singleDatePattern)?.[0] ?? "";
  if (!raw) return null;
  const hasMonth = new RegExp(`\\b${monthToken}`, "i").test(raw);
  const precision = hasMonth
    ? new RegExp(`${monthToken}\\.?\\s+(?:[0-3]?\\d),?\\s+${yearToken}`, "i").test(raw) ? "day" : "month"
    : "year";
  const range = raw.match(new RegExp(`^(${dateToken})\\s*(?:-|\\u2013|\\u2014|to)\\s*(Present|Current|Now|${dateToken})$`, "i"));
  const current = /present|current|now/i.test(raw);
  return {
    raw: raw.trim(),
    startDate: (range?.[1] ?? raw).trim(),
    endDate: current ? "" : (range?.[2] ?? "").trim(),
    current,
    precision
  };
}

function isDateOnly(value: string): boolean {
  const info = dateInfo(value);
  return Boolean(info && value.replace(info.raw, "").replace(/[|,;:()\s]/g, "") === "");
}

function emailCandidate(value: string): string | null {
  const cleaned = value.trim().replace(/^e-?mail\s*:\s*/i, "").replace(/^[<(\[]|[>)\].,;:]$/g, "");
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleaned) ? cleaned : null;
}

function phoneCandidate(value: string): string | null {
  const cleaned = value.trim().replace(/^(?:phone|mobile|tel)\s*:\s*/i, "");
  if (dateRangePattern.test(cleaned) || /[%$]|\b(?:hours?|team|people|version|employee|id)\b/i.test(cleaned)) return null;
  if (!/^\+?[\d ().-]+(?:\s*(?:x|ext\.?|extension)\s*\d{1,6})?$/i.test(cleaned)) return null;
  const digits = cleaned.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? cleaned : null;
}

function linkCandidate(value: string): string | null {
  const cleaned = value.trim().replace(/^(?:linkedin|portfolio|github|website|web)\s*:\s*/i, "");
  return /^(?:https?:\/\/)(?:[^\s.]+\.)+[^\s]+$/i.test(cleaned) ? cleaned : null;
}

function locationCandidate(value: string): string | null {
  const cleaned = value.trim().replace(/^location\s*:\s*/i, "");
  if (dateRangePattern.test(cleaned) || /\b(?:remote work|worked remotely|available remotely)\b/i.test(cleaned) || cleaned.length > 80) return null;
  if (/^Greater\s+[\p{L} .'-]+\s+Area$/iu.test(cleaned)) return cleaned;
  if (/^[\p{L} .'-]+,\s*(?:[A-Z]{2}|[\p{L} .'-]{3,})(?:\s+\d{4,10})?$/u.test(cleaned)) return cleaned;
  return null;
}

function nameCandidate(value: string): string | null {
  const cleaned = value.trim();
  if (cleaned.length > 70 || /[@\d|/:]|https?:/i.test(cleaned) || titleWords.test(cleaned) || headingSection(cleaned)) return null;
  const pieces = cleaned.split(/\s+/);
  if (pieces.length < 2 || pieces.length > 6) return null;
  return pieces.every((piece) => /^(?:\p{Lu}[\p{L}'\u2019.-]*|\p{Lu}\.)$/u.test(piece)) ? cleaned : null;
}

function baseCandidate(
  line: SourceLine,
  proposedField: ImportProposalField,
  group: ImportProposalGroup,
  kind: EvidenceKind,
  label: string,
  candidateValue: string,
  validation: ImportProposalValidation,
  disposition: ImportProposalDisposition,
  reasons: string[],
  reviewRequired: boolean
): Candidate {
  return {
    group, kind, label, detail: candidateValue,
    sourceFilenames: [line.filename], sourceExcerpts: [line.text], confidence: validation === "valid" ? "high" : "low",
    status: "proposed", edited: false, likelyDuplicateOf: null,
    proposedField, candidateValue, disposition, validation, classificationReasons: reasons,
    sourceSection: line.section, sourcePositions: [line.position], conflictGroup: null,
    reviewRequired, occurrenceCount: 1
  };
}

function structuralCandidate(line: SourceLine, section: ImportSourceSection): Candidate {
  return baseCandidate(line, "structure", "other", "proof", "Document structure", line.text, "structural", "structural-heading", [`Recognized ${section} section heading.`], false);
}

function noiseCandidate(line: SourceLine): Candidate {
  return baseCandidate(line, "structure", "other", "proof", "Formatting noise", line.text, "noise", "formatting-noise", ["Recognized page furniture or decorative formatting."], false);
}

function roleParts(value: string): { title: string; employer: string; dates: string; ambiguous: boolean } | null {
  const dates = dateInfo(value)?.raw ?? "";
  const withoutDates = dates ? value.replace(dates, "") : value;
  const parts = withoutDates.split(/\s+(?:\u2014|\u2013|at|@)\s+|\s*\|\s*|\s+\/\s+/i)
    .map((part) => part.replace(/^[,;\s-]+|[,;\s-]+$/g, "").trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const firstTitle = titleWords.test(parts[0]);
  const secondTitle = titleWords.test(parts[1]);
  if (firstTitle !== secondTitle) return { title: firstTitle ? parts[0] : parts[1], employer: firstTitle ? parts[1] : parts[0], dates, ambiguous: false };
  return { title: parts[0], employer: parts[1], dates, ambiguous: true };
}

function roleCandidate(line: SourceLine, value = line.text): Candidate | null {
  const parts = roleParts(value);
  if (!parts) return null;
  const info = dateInfo(parts.dates || value);
  const role: ImportRoleCandidate = {
    title: parts.title, employer: parts.employer, dates: parts.dates,
    startDate: info?.startDate ?? "", endDate: info?.endDate ?? "",
    location: "", current: info?.current ?? false, datePrecision: info?.precision ?? "unknown"
  };
  const ambiguous = parts.ambiguous || !role.title || !role.employer;
  const candidate = baseCandidate(
    line, "role", "employment", "role", "Employment record", [role.title, role.employer, role.dates].filter(Boolean).join(" \u00b7 "),
    ambiguous ? "ambiguous" : "valid", ambiguous ? "ambiguous-candidate" : "valid-candidate",
    ambiguous ? ["Employer and title order needs confirmation."] : ["Employer and title shapes are distinct and the source relationship is preserved."],
    ambiguous
  );
  return { ...candidate, roleCandidate: role, confidence: ambiguous ? "medium" : "high" };
}

function projectCandidate(line: SourceLine, value = line.text): Candidate {
  const dates = dateInfo(value)?.raw ?? "";
  const withoutDates = dates ? value.replace(dates, "") : value;
  const parts = withoutDates.split(/\s*(?:\u2014|\u2013|\|)\s*/).map((part) => part.replace(/[,;\s-]+$/g, "").trim()).filter(Boolean);
  const project: ImportProjectCandidate = { name: parts[0] || value, organization: parts[1] ?? "", dates, description: value, links: [] };
  const candidate = baseCandidate(line, "project", "projects", "project", "Project", project.name, "valid", "valid-candidate", ["Project section or explicit project wording establishes context."], false);
  return { ...candidate, projectCandidate: project, confidence: "high" };
}

function splitEducationCredential(value: string): { credential: string; field: string } {
  const cleaned = value.trim();
  const abbreviation = cleaned.match(/^((?:B|M)\.?[AS]\.?)\s+(?:in\s+)?(.+)$/i);
  if (abbreviation) return { credential: abbreviation[1], field: abbreviation[2].trim() };
  const namedDegree = cleaned.match(/^((?:Bachelor|Master|Associate)(?:'s)?(?:\s+degree)?(?:\s+of\s+(?:Science|Arts|Engineering|Business Administration))?)\s+(?:in|of)\s+(.+)$/i);
  if (namedDegree) return { credential: namedDegree[1], field: namedDegree[2].trim() };
  const credential = cleaned.match(/^((?:Certificate|Certification|Diploma))\s+in\s+(.+)$/i);
  if (credential) return { credential: credential[1], field: credential[2].trim() };
  return { credential: cleaned, field: "" };
}

function educationCandidate(line: SourceLine, value = line.text): Candidate {
  const dates = dateInfo(value)?.raw ?? "";
  const withoutDates = dates ? value.replace(dates, "") : value;
  const parts = withoutDates.split(/\s*(?:\u2014|\u2013|\|)\s*/).map((part) => part.replace(/[,;\s-]+$/g, "").trim()).filter(Boolean);
  const firstInstitution = institutionWords.test(parts[0] ?? "");
  const parsedCredential = splitEducationCredential(firstInstitution ? parts.slice(1).join(" \u00b7 ") : parts[0] ?? "");
  const education: ImportEducationCandidate = {
    institution: firstInstitution ? parts[0] : parts[1] ?? "",
    credential: parsedCredential.credential,
    field: parsedCredential.field, dates, location: ""
  };
  const valid = Boolean(education.institution && education.credential);
  const candidate = baseCandidate(line, "education", "education", "education", "Education", [education.credential, education.field ? `in ${education.field}` : "", education.institution, dates].filter(Boolean).join(" \u00b7 "), valid ? "valid" : "ambiguous", valid ? "valid-candidate" : "ambiguous-candidate", valid ? ["Institution, credential, field of study, and supplied chronology are preserved separately where their shapes are explicit."] : ["Education source is meaningful but incomplete."], !valid);
  return { ...candidate, educationCandidate: education, confidence: valid ? "high" : "medium" };
}

function contactCandidate(line: SourceLine, allowName: boolean): Candidate | null {
  const email = emailCandidate(line.text);
  if (email) return baseCandidate(line, "identity.email", "identity", "identity", "Email", email, "valid", "valid-candidate", ["Whole-line email shape validated."], true);
  const phone = phoneCandidate(line.text);
  if (phone) return baseCandidate(line, "identity.phone", "identity", "identity", "Phone", phone, "valid", "valid-candidate", ["Phone punctuation and 10-15 digit shape validated; date and metric shapes excluded."], true);
  const link = linkCandidate(line.text);
  if (link) return baseCandidate(line, "identity.link", "identity", "identity", /linkedin/i.test(link) ? "LinkedIn" : /github/i.test(link) ? "GitHub" : "Professional link", link, "valid", "valid-candidate", ["Whole-line HTTPS professional link validated."], true);
  const location = locationCandidate(line.text);
  if (location) return baseCandidate(line, "identity.location", "identity", "identity", "Location", location, "valid", "valid-candidate", ["City/region location shape validated without assuming a US ZIP code."], true);
  const name = allowName ? nameCandidate(line.text) : null;
  if (name) return baseCandidate(line, "identity.fullName", "identity", "identity", "Name", name, "valid", "valid-candidate", ["Top-of-document human-name shape validated; explicit confirmation remains required."], true);
  return null;
}

function genericCandidate(line: SourceLine): Candidate {
  if (/^(?:tools?|technologies|platforms?|software)\s*:/i.test(line.text)) {
    const value = line.text.replace(/^.*?:/, "").trim();
    return baseCandidate(line, "tool", "tools", "tool", "Tools", value, "valid", "valid-candidate", ["Explicit tool label establishes field context."], false);
  }
  if (line.section === "skills" || /^(?:skills?|competencies|strengths?)\s*:/i.test(line.text)) {
    const value = line.text.replace(/^.*?:/, "").trim();
    return baseCandidate(line, "skill", "skills", "skill", "Skills", value, "valid", "valid-candidate", ["Skills section establishes field context; wording is preserved."], false);
  }
  if (/\d|%|\$|\b(increased|reduced|improved|grew|saved|maintained|delivered|launched|resolved)\b/i.test(line.text)) {
    return baseCandidate(line, "metric", "metrics-outcomes", "metric", "Metric or outcome", line.text, "ambiguous", "ambiguous-candidate", ["Numeric or outcome language preserved for review; not treated as contact identity."], true);
  }
  return baseCandidate(line, "proof", "other", "proof", "Unresolved imported line", line.text, "ambiguous", "unresolved", ["Meaningful source text was preserved, but deterministic field context was insufficient."], true);
}

function sourceLines(filename: string, text: string): SourceLine[] {
  const rawLines = text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).slice(0, 220);
  let section: ImportSourceSection = "unknown";
  return rawLines.map((text, position) => {
    const heading = headingSection(text);
    const current = { text: text.replace(/^[\s\u2022*-]+/, "").trim(), filename, position, section };
    if (heading) section = heading;
    return heading ? { ...current, section: heading } : current;
  });
}

function candidateKey(candidate: Candidate): string {
  if (candidate.proposedField === "identity.link") return `${candidate.proposedField}|${normalizedUrl(candidate.candidateValue ?? candidate.detail)}`;
  if (candidate.roleCandidate) return `role|${normalized(candidate.roleCandidate.title)}|${normalized(candidate.roleCandidate.employer)}|${normalized(candidate.roleCandidate.dates)}`;
  if (candidate.educationCandidate) return `education|${normalized(candidate.educationCandidate.institution)}|${normalized(candidate.educationCandidate.credential)}|${normalized(candidate.educationCandidate.dates)}`;
  if (candidate.projectCandidate) return `project|${normalized(candidate.projectCandidate.name)}|${normalized(candidate.projectCandidate.organization)}|${normalized(candidate.projectCandidate.dates)}`;
  return `${candidate.proposedField}|${normalized(candidate.candidateValue ?? candidate.detail)}`;
}

function mergeDuplicates(candidates: Candidate[]): Candidate[] {
  const byKey = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, candidate);
      continue;
    }
    previous.sourceFilenames = compact([...previous.sourceFilenames, ...candidate.sourceFilenames]);
    previous.sourceExcerpts = compact([...previous.sourceExcerpts, ...candidate.sourceExcerpts]);
    previous.sourcePositions = [...new Set([...(previous.sourcePositions ?? []), ...(candidate.sourcePositions ?? [])])];
    previous.occurrenceCount = (previous.occurrenceCount ?? 1) + (candidate.occurrenceCount ?? 1);
    if (previous.validation === "valid") previous.disposition = "duplicate-candidate";
    previous.classificationReasons = compact([...(previous.classificationReasons ?? []), "Normalized duplicate collapsed without losing sources."]);
  }
  return [...byKey.values()];
}

function markConflicts(candidates: Candidate[]): Candidate[] {
  const conflictFields: ImportProposalField[] = ["identity.fullName", "identity.email", "identity.phone", "identity.location"];
  for (const field of conflictFields) {
    const items = candidates.filter((candidate) => candidate.proposedField === field && candidate.validation !== "structural");
    if (items.length <= 1) continue;
    const group = `conflict-${field}`;
    items.forEach((candidate) => {
      candidate.validation = "conflicting";
      candidate.disposition = "conflicting-candidate";
      candidate.conflictGroup = group;
      candidate.reviewRequired = true;
      candidate.status = "proposed";
      candidate.classificationReasons = compact([...(candidate.classificationReasons ?? []), `Multiple different ${field.replace("identity.", "")} values require an explicit choice.`]);
    });
  }
  const roles = new Map<string, Candidate[]>();
  candidates.filter((candidate) => candidate.roleCandidate).forEach((candidate) => {
    const role = candidate.roleCandidate!;
    const key = `${normalized(role.title)}|${normalized(role.employer)}`;
    roles.set(key, [...(roles.get(key) ?? []), candidate]);
  });
  for (const [key, items] of roles) {
    if (items.length <= 1 || new Set(items.map((item) => normalized(item.roleCandidate?.dates ?? ""))).size <= 1) continue;
    const group = `conflict-role-${stableId("key", key)}`;
    items.forEach((candidate) => {
      candidate.validation = "conflicting";
      candidate.disposition = "conflicting-candidate";
      candidate.conflictGroup = group;
      candidate.reviewRequired = true;
      candidate.status = "proposed";
      candidate.classificationReasons = compact([...(candidate.classificationReasons ?? []), "The same employer/title appears with different chronology."]);
    });
  }
  return candidates;
}

function parseFile(filename: string, text: string): Candidate[] {
  const lines = sourceLines(filename, text);
  const candidates: Candidate[] = [];
  const consumed = new Set<number>();
  let firstMeaningful = true;

  for (let index = 0; index < lines.length; index += 1) {
    if (consumed.has(index)) continue;
    const line = lines[index];
    const heading = headingSection(line.text);
    if (heading) {
      candidates.push(structuralCandidate(line, heading));
      firstMeaningful = false;
      continue;
    }
    if (isFormattingNoise(line.text)) {
      candidates.push(noiseCandidate(line));
      continue;
    }

    const contact = contactCandidate(line, firstMeaningful && line.section === "unknown");
    if (contact && (
      line.section === "unknown" ||
      line.section === "contact" ||
      contact.proposedField === "identity.email" ||
      contact.proposedField === "identity.phone" ||
      contact.proposedField === "identity.link"
    )) {
      candidates.push(contact);
      firstMeaningful = false;
      continue;
    }
    firstMeaningful = false;

    // Education commonly appears as one explicit institution/credential line
    // even when the source omitted an EDUCATION heading. Recognize that shape
    // before the generic two-part role parser so a degree can never become an
    // employer/title pair merely because both sides use an em dash.
    if (institutionWords.test(line.text) && credentialWords.test(line.text)) {
      candidates.push(educationCandidate(line));
      continue;
    }

    if (line.section === "experience" || line.section === "volunteer" || line.section === "leadership" || line.section === "unknown") {
      const directRole = roleCandidate(line);
      if (directRole) {
        if (/\b(founder|independent|project|freelance|volunteer)\b/i.test(directRole.roleCandidate?.title ?? "")) candidates.push(projectCandidate(line));
        else candidates.push(directRole);
        continue;
      }
      const second = lines[index + 1];
      const third = lines[index + 2];
      if (second && third && !headingSection(second.text) && !headingSection(third.text) && isDateOnly(third.text) && !isDateOnly(line.text) && !isDateOnly(second.text)) {
        const firstTitle = titleWords.test(line.text);
        const secondTitle = titleWords.test(second.text);
        const combined = firstTitle !== secondTitle
          ? `${firstTitle ? line.text : second.text} \u2014 ${firstTitle ? second.text : line.text} | ${third.text}`
          : `${line.text} \u2014 ${second.text} | ${third.text}`;
        const parsed = roleCandidate({ ...line, text: combined }, combined);
        if (parsed) {
          parsed.sourceExcerpts = [line.text, second.text, third.text];
          parsed.sourcePositions = [line.position, second.position, third.position];
          if (line.section === "volunteer" || /\bvolunteer\b/i.test(combined)) candidates.push(projectCandidate({ ...line, text: combined }, combined));
          else candidates.push(parsed);
          consumed.add(index + 1);
          consumed.add(index + 2);
          continue;
        }
      }
      if (isDateOnly(line.text)) {
        candidates.push(baseCandidate(line, "unresolved", "other", "proof", "Unattached chronology", line.text, "ambiguous", "unresolved", ["Date was preserved but could not be deterministically attached to an entity."], true));
        continue;
      }
    }

    if (line.section === "education" || institutionWords.test(line.text) || credentialWords.test(line.text)) {
      const next = lines[index + 1];
      if (institutionWords.test(line.text) && next && next.section === "education" && !headingSection(next.text)) {
        const combined = `${line.text} \u2014 ${next.text}`;
        const parsed = educationCandidate({ ...line, text: combined }, combined);
        parsed.sourceExcerpts = [line.text, next.text];
        parsed.sourcePositions = [line.position, next.position];
        candidates.push(parsed);
        consumed.add(index + 1);
      } else candidates.push(educationCandidate(line));
      continue;
    }

    if (line.section === "projects" || /\b(project|portfolio|open.source)\b/i.test(line.text)) {
      const priorProjectInSection = candidates.some((candidate) =>
        candidate.sourceSection === "projects" && candidate.proposedField === "project"
      );
      const explicitProjectShape = Boolean(dateInfo(line.text)) || /[|\u2013\u2014]/.test(line.text) || /\b(project|portfolio|open.source)\b/i.test(line.text);
      // A PROJECTS heading supplies context for the first project name. Prose
      // after that heading is supporting detail unless it independently has a
      // project/date/organization shape; proximity alone cannot manufacture a
      // second first-class project.
      candidates.push(!priorProjectInSection || explicitProjectShape ? projectCandidate(line) : genericCandidate(line));
      continue;
    }

    candidates.push(genericCandidate(line));
  }
  return candidates;
}

/** Deterministic import contract. It records structural/noise dispositions for
 * diagnostics; createPendingImportReview removes those non-facts from review. */
export function parseResumeFilesToImportProposals(files: Array<{ filename: string; text: string }>): ImportProposalRecord[] {
  const candidates = markConflicts(mergeDuplicates(files.flatMap((file) => parseFile(file.filename, file.text))));
  return candidates.map((candidate) => ({ id: stableId("proposal", candidateKey(candidate)), ...candidate }));
}
