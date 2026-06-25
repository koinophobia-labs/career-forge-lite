export type ParsedRoleAnswer = {
  company: string;
  confidence: "low" | "medium" | "high";
  dates: string;
  missingField?: "title" | "company" | "dates";
  title: string;
};

const numberWords = new Map([
  ["one", "1"],
  ["two", "2"],
  ["three", "3"],
  ["four", "4"],
  ["five", "5"],
  ["six", "6"],
  ["seven", "7"],
  ["eight", "8"],
  ["nine", "9"],
  ["ten", "10"]
]);

function clean(value = "") {
  return value
    .replace(/[.!,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bApi\b/g, "API")
    .replace(/\bDraftkings\b/g, "DraftKings")
    .replace(/\bIt\b/g, "IT")
    .replace(/\bQa\b/g, "QA")
    .replace(/\bUi\b/g, "UI")
    .replace(/\bUx\b/g, "UX");
}

function normalizeDates(value: string) {
  const cleaned = clean(value).replace(/\b(now|present|current|currently)\b/i, "Present");
  const yearMatch = cleaned.match(/\b(19|20)\d{2}\b/);
  if (yearMatch && /present/i.test(cleaned)) return `${yearMatch[0]}-Present`;
  return cleaned;
}

function yearsPhrase(value: string) {
  const normalized = value.toLowerCase();
  const word = normalized.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/)?.[1];
  const digit = normalized.match(/\b\d+\b/)?.[0];
  const count = word ? numberWords.get(word) : digit;
  return count ? `${count} year${count === "1" ? "" : "s"}` : "";
}

function missingField(parsed: Omit<ParsedRoleAnswer, "confidence" | "missingField">) {
  if (!parsed.title) return "title";
  if (!parsed.company) return "company";
  if (!parsed.dates) return "dates";
  return undefined;
}

function confidenceFor(parsed: Omit<ParsedRoleAnswer, "confidence" | "missingField">): ParsedRoleAnswer["confidence"] {
  const count = [parsed.title, parsed.company, parsed.dates].filter(Boolean).length;
  if (count === 3) return "high";
  if (count === 2) return "medium";
  return "low";
}

function build(parsed: Omit<ParsedRoleAnswer, "confidence" | "missingField">): ParsedRoleAnswer {
  const missing = missingField(parsed);
  return {
    ...parsed,
    confidence: confidenceFor(parsed),
    ...(missing ? { missingField: missing } : {})
  };
}

export function parseRoleAnswer(answer: string): ParsedRoleAnswer {
  const value = clean(answer);
  const lower = value.toLowerCase();

  const founded = value.match(/\b(?:i\s+)?founded\s+(.+?)(?:\s+in\s+((?:19|20)\d{2}|present|now))?$/i);
  if (founded) {
    const year = founded[2] ? normalizeDates(`${founded[2]} to Present`) : "";
    return build({
      title: "Founder",
      company: titleCase(founded[1]),
      dates: year
    });
  }

  const workedAtAs = value.match(/\b(?:i\s+)?worked\s+at\s+(.+?)\s+as\s+(?:a|an)?\s*(.+?)(?:\s+from\s+(.+?)(?:\s+to\s+(.+))?)?$/i);
  if (workedAtAs) {
    return build({
      company: titleCase(workedAtAs[1]),
      title: titleCase(workedAtAs[2]),
      dates: workedAtAs[3] ? normalizeDates(`${workedAtAs[3]}${workedAtAs[4] ? ` to ${workedAtAs[4]}` : ""}`) : ""
    });
  }

  const wasAtFor = value.match(/\b(?:i\s+)?was\s+(?:a|an)?\s*(.+?)\s+at\s+(.+?)\s+for\s+(.+?)$/i);
  if (wasAtFor) {
    return build({
      title: titleCase(wasAtFor[1]),
      company: titleCase(wasAtFor[2]),
      dates: yearsPhrase(wasAtFor[3]) || clean(wasAtFor[3])
    });
  }

  const titleAtCompany = value.match(/\b(?:i\s+)?(?:am|was|worked\s+as)\s+(?:a|an)?\s*(.+?)\s+at\s+(.+?)(?:\s+(?:from|since|in|for)\s+(.+))?$/i);
  if (titleAtCompany) {
    return build({
      title: titleCase(titleAtCompany[1]),
      company: titleCase(titleAtCompany[2]),
      dates: titleAtCompany[3] ? normalizeDates(titleAtCompany[3]) : ""
    });
  }

  const companyOnly = lower.includes(" at ") ? value.split(/\s+at\s+/i).at(-1) ?? "" : "";
  return build({
    title: "",
    company: titleCase(companyOnly),
    dates: ""
  });
}

export function formatParsedRoleConfirmation(parsed: ParsedRoleAnswer) {
  const parts = [
    parsed.title,
    parsed.company ? `at ${parsed.company}` : "",
    parsed.dates
  ].filter(Boolean);
  return parts.join(", ").replace(", at", " at") || "I need one more detail.";
}
