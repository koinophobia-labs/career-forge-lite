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
    .replace(/\bDoordash\b/g, "DoorDash")
    .replace(/\bUber Eats\b/g, "Uber Eats")
    .replace(/\bIt\b/g, "IT")
    .replace(/\bQa\b/g, "QA")
    .replace(/\bUi\b/g, "UI")
    .replace(/\bUx\b/g, "UX");
}

function normalizeDates(value: string) {
  const cleaned = clean(value)
    .replace(/\s+\b(?:where|while|when)\b.*$/i, "")
    .replace(/\b(now|present|current|currently)\b/i, "Present");
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

  const workAsForFrom = value.match(/\b(?:i\s+)?(?:worked|work|served)\s+as\s+(?:an?|the)?\s*(.+?)\s+for\s+(.+?)\s+from\s+(.+?)\s+to\s+(.+?)$/i);
  if (workAsForFrom) {
    return build({
      title: titleCase(workAsForFrom[1]),
      company: titleCase(workAsForFrom[2]),
      dates: normalizeDates(`${workAsForFrom[3]} to ${workAsForFrom[4]}`)
    });
  }

  const workAsAtFrom = value.match(/\b(?:i\s+)?(?:worked|work|served)\s+as\s+(?:an?|the)?\s*(.+?)\s+at\s+(.+?)\s+from\s+(.+?)\s+to\s+(.+?)$/i);
  if (workAsAtFrom) {
    return build({
      title: titleCase(workAsAtFrom[1]),
      company: titleCase(workAsAtFrom[2]),
      dates: normalizeDates(`${workAsAtFrom[3]} to ${workAsAtFrom[4]}`)
    });
  }

  const workAsFrom = value.match(/\b(?:i\s+)?(?:worked|work|served)\s+as\s+(?:an?|the)?\s*(.+?)\s+from\s+(.+?)\s+to\s+(.+?)(?:\s+at\s+(.+?))?$/i);
  if (workAsFrom) {
    return build({
      title: titleCase(workAsFrom[1]),
      company: workAsFrom[4] ? titleCase(workAsFrom[4]) : "",
      dates: normalizeDates(`${workAsFrom[2]} to ${workAsFrom[3]}`)
    });
  }

  const founded = value.match(
    /\b(?:i\s+)?founded\s+(.+?)(?:\s+in\s+((?:19|20)\d{2}|present|now)|\s+(?:and|to|that|where|which)\b|[.;,]|$)/i
  );
  if (founded) {
    const year = founded[2] ? normalizeDates(`${founded[2]} to Present`) : "";
    const company = clean(founded[1]).replace(/^(?:a|an|the)\s+/i, "");
    return build({
      title: "Founder",
      company: titleCase(company),
      dates: year
    });
  }

  const workedAtAs = value.match(/\b(?:i\s+)?worked\s+at\s+(.+?)\s+as\s+(?:an?|the)?\s*(.+?)(?:\s+from\s+(.+?)(?:\s+to\s+(.+))?)?$/i);
  if (workedAtAs) {
    return build({
      company: titleCase(workedAtAs[1]),
      title: titleCase(workedAtAs[2]),
      dates: workedAtAs[3] ? normalizeDates(`${workedAtAs[3]}${workedAtAs[4] ? ` to ${workedAtAs[4]}` : ""}`) : ""
    });
  }

  const wasAtFor = value.match(/\b(?:i\s+)?was\s+(?:an?|the)?\s*(.+?)\s+at\s+(.+?)\s+for\s+(.+?)$/i);
  if (wasAtFor) {
    return build({
      title: titleCase(wasAtFor[1]),
      company: titleCase(wasAtFor[2]),
      dates: yearsPhrase(wasAtFor[3]) || clean(wasAtFor[3])
    });
  }

  const titleAtCompany = value.match(/\b(?:i\s+)?(?:am|was|worked\s+as)\s+(?:an?|the)?\s*(.+?)\s+at\s+(.+?)(?:\s+(?:from|since|in|for)\s+(.+))?$/i);
  if (titleAtCompany) {
    return build({
      title: titleCase(titleAtCompany[1]),
      company: titleCase(titleAtCompany[2]),
      dates: titleAtCompany[3] ? normalizeDates(titleAtCompany[3]) : ""
    });
  }

  const appDriver = value.match(/\b(?:i\s+)?(?:drive|deliver|delivered|drove)\s+for\s+(doordash|uber eats|instacart|grubhub)\b/i);
  if (appDriver) {
    return build({
      title: appDriver[1].toLowerCase() === "instacart" ? "Instacart Shopper" : "Delivery Driver",
      company: titleCase(appDriver[1]),
      dates: ""
    });
  }

  const informalWork = value.match(/\b(?:i\s+)?(?:work|worked|am|was)\s+(?:as\s+)?(?:an?|the)?\s*(.+?)(?:\s+and\s+|\s+where\s+|\s+who\s+|,|$)/i);
  if (informalWork && clean(informalWork[1]).split(/\s+/).length <= 5) {
    return build({
      title: titleCase(informalWork[1]),
      company: "",
      dates: ""
    });
  }

  const companyOnly = lower.includes(" at ") ? value.split(/\s+at\s+/i).at(-1) ?? "" : "";
  if (!companyOnly && value) {
    return build({
      title: titleCase(value),
      company: "",
      dates: ""
    });
  }

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
