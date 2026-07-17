// Shared honesty guards used at every point where user text becomes a claim.
//
// Two failure modes these prevent (both observed in adversarial playtests):
// 1. Uncertainty laundering — "I don't know my numbers" saved as an approved
//    Metric and exported in a proof bank.
// 2. Termination-reason leakage — "until I was laid off in June 2026" pasted
//    into an intake box and reprinted verbatim in a résumé summary.

// Matches statements that EXPRESS not-knowing rather than state a fact.
// Deliberately conservative: prefixes and standalone forms, not any sentence
// containing "know" (a real metric like "known-error rate" must survive).
const uncertaintyPatterns: RegExp[] = [
  /^\s*(i\s*)?(really\s*)?(do\s*n[o']t|don't|dont)\s+(really\s+)?(know|remember|recall|have)\b/i,
  /^\s*(i'?m|i\s+am)\s+not\s+(really\s+)?sure\b/i,
  /^\s*not\s+sure\b/i,
  /^\s*no\s+idea\b/i,
  /^\s*(n\/?a|none|nothing|unknown|unsure|idk|tbd|\?+)\s*[.!]?\s*$/i,
  /^\s*i\s+(never|didn'?t)\s+(tracked?|measured?|counted?)\b/i,
  /\bdon'?t\s+(really\s+)?have\s+(any\s+)?(numbers?|metrics?|figures?|data)\b/i
];

// True when the text is an expression of uncertainty, not usable evidence.
export function isUncertaintyStatement(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return uncertaintyPatterns.some((pattern) => pattern.test(trimmed));
}

// Phrases that explain why employment ended. Never résumé content — they are
// filtered from generated documents and surfaced as a withheld-fact note so
// the user knows the omission was deliberate, not lossy.
const terminationPatterns: RegExp[] = [
  /\b(was|were|got|getting|been)\s+(laid\s+off|let\s+go|terminated|fired|downsized|made\s+redundant)\b/i,
  /\blaid\s+off\b/i,
  /\b(company|employer|org(anization)?)\s+(closed|shut\s+down|folded|went\s+under|downsized)\b/i,
  /\bposition\s+(was\s+)?eliminated\b/i,
  /\buntil\s+(i\s+was\s+)?(laid\s+off|let\s+go|terminated|fired)\b/i,
  /\breduction\s+in\s+force\b/i,
  /\bRIF'?(ed|d)?\b/
];

export function containsTerminationReason(text: string): boolean {
  return terminationPatterns.some((pattern) => pattern.test(text));
}

// Removes termination-reason clauses from a sentence while keeping the rest
// usable. Returns the cleaned text and whether anything was withheld.
export function stripTerminationReasons(text: string): { text: string; withheld: boolean } {
  if (!containsTerminationReason(text)) return { text, withheld: false };

  const cleanedSentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      if (!containsTerminationReason(sentence)) return sentence;
      // Try dropping just the offending clause (comma- or "until"-separated).
      const clauses = sentence.split(/,|;|\s+—\s+|\s+-\s+/);
      const kept = clauses.filter((clause) => !containsTerminationReason(clause));
      if (kept.length === 0) return "";
      const rejoined = kept.join(", ").replace(/\s{2,}/g, " ").trim();
      // A trailing "until" with its clause removed reads broken; trim it.
      return rejoined.replace(/\s+(until|after|when|because)\s*[.!?]?\s*$/i, "").trim();
    })
    .filter(Boolean);

  return { text: cleanedSentences.join(" ").replace(/\s{2,}/g, " ").trim(), withheld: true };
}

// First-person framing that reads fine in an intake box but wrong in a
// résumé summary ("I managed..." → "Managed..."). Light-touch: only leading
// pronouns and obvious self-references, never rewriting meaning.
export function toResumeVoice(text: string): string {
  return text
    .trim()
    .replace(/^\s*i\s+(was|am|have\s+been|had\s+been)\s+/i, "")
    .replace(/^\s*i\s+/i, "")
    .replace(/\bmy\s+/gi, "")
    .replace(/^\s*([a-z])/, (match) => match.toUpperCase())
    .replace(/\s{2,}/g, " ");
}
