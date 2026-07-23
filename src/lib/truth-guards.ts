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
  /\b(company|employer|org(anization)?|department|team|division)\s+(closed|shut\s+down|folded|went\s+under|downsized|reorganized|restructured)\b/i,
  /\b(role|position|job|department|team)\s+(was\s+)?eliminated\b/i,
  /\buntil\s+(i\s+was\s+)?(laid\s+off|let\s+go|terminated|fired)\b/i,
  /\breduction\s+in\s+force\b/i,
  /\bRIF'?(ed|d)?\b/,
  /\b(underwent|went\s+through|had|announced)\s+(a\s+)?(round\s+of\s+)?layoffs?\b/i,
  /\b(company|employer|org(anization)?|department|team)\s+(was\s+)?reorganiz(ed|ation)\b/i,
  /\b(department|team|role|position|division|group|unit)\s+(was|were)\s+(\w+\s+)?(reorganiz(ed)|restructur(ed)|eliminated|dissolved|downsized)\b/i,
  /\bleadership\s+(decided\s+to\s+)?eliminat(ed?|ing)\s+(the\s+)?(role|position|team|department)\b/i,
  // CF-02 — phrasings that bypassed the original list (red-team: 8/10 bypassed).
  // Position/role/seat cut, eliminated, sunset, dissolved (separation-specific).
  /\b(my|the|their|his|her|our)\s+(position|role|seat|job|title|department|team)\s+(was|were|got|been|is|had\s+been)?\s*(cut|eliminated|removed|dissolved|axed|sunset|sunsetted|gone|absorbed)\b/i,
  /\b(cut|eliminated|removed|dissolved|axed|sunset|sunsetted)\s+(my|the|their|his|her|our)\s+(position|role|seat|job|title|team|department|group|division)\b/i,
  /\b(position|role|seat|job|title|department|team|division)\s+(was\s+)?(cut|eliminated|sunset|sunsetted|dissolved|axed)\b/i,
  // Company failure / funding loss.
  /\b(ran|run|running)\s+out\s+of\s+(funding|money|cash|runway|capital)\b/i,
  /\bout\s+of\s+(funding|runway|capital)\b/i,
  /\b(company|startup|employer|business|firm|org(anization)?)\s+(went\s+(bankrupt|under|belly[\s-]?up)|folded|dissolved|ceased\s+operations|wound\s+down|closed\s+(down|its\s+doors|shop))\b/i,
  // Forced departure.
  /\b(pushed|forced|managed|eased|shown)\s+out\b/i,
  /\blost\s+(my|his|her|their)\s+(job|role|position|gig)\b/i,
  // Separation instruments.
  /\bseverance\b/i,
  /\bbuy[\s-]?out\b/i,
  /\bfurlough(ed|s)?\b/i,
  /\b(contract|role|position|tenure|term)\s+(was\s+)?(not\s+renewed|not\s+extended|ended|expired|wasn'?t\s+renewed)\b/i,
  /\b(was|were|been|got)\s+(dismissed|discharged|offboarded|off-boarded|separated|sacked|canned)\b/i
];

export function containsTerminationReason(text: string): boolean {
  return terminationPatterns.some((pattern) => pattern.test(text));
}

// CF-02 durability layer: "no strict match" must NOT be treated as "definitely
// safe". These softer cues frequently accompany a separation but are ambiguous
// enough that auto-removal would mangle legitimate content — so text matching
// one of these (and NOT already a definite termination reason) is FLAGGED for
// the user to review before sending, and the export receipt reflects that
// uncertainty instead of falsely reporting "nothing withheld".
const possibleSeparationPatterns: RegExp[] = [
  /\breorg(aniz(ation|ed|ing))?\b/i,
  /\brestructur(e|ed|ing|es|ation)\b/i,
  /\bparted\s+ways\b/i,
  /\bno\s+longer\s+(with|at|employed)\b/i,
  /\bmoved\s+on\s+from\b/i,
  /\bbetween\s+(roles|jobs|positions)\b/i,
  /\b(company|team|department|budget)\s+(downturn|headwinds|belt[\s-]?tightening|cost[\s-]?cutting|cuts?)\b/i,
  /\bmy\s+(time|tenure|stint)\s+(at|with)\b.{0,40}\b(ended|concluded|wrapped|came\s+to\s+an\s+end)\b/i
];

/** True when the text carries a POSSIBLE (unclassified) end-of-employment
 *  context that the strict guard did not catch — a signal to flag for review,
 *  not to silently strip. */
export function hasPossibleSeparationContext(text: string): boolean {
  if (containsTerminationReason(text)) return false; // already handled as definite
  return possibleSeparationPatterns.some((pattern) => pattern.test(text));
}

const trailingConjunction = /\s+(until|after|when|because|since|though|although)\s*[.!?]?\s*$/i;

// A trailing conjunction with its clause removed reads broken ("I managed
// vendor contracts worth $2M annually until"); trim it along with any
// leftover clause punctuation.
function finishClause(value: string): string {
  return value
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(trailingConjunction, "")
    .replace(/[,;]\s*$/, "")
    .trim();
}

// Removes termination-reason clauses from a sentence while keeping the rest
// usable. Returns the cleaned text and whether anything was withheld.
export function stripTerminationReasons(text: string): { text: string; withheld: boolean } {
  if (!containsTerminationReason(text)) return { text, withheld: false };

  const cleanedSentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      if (!containsTerminationReason(sentence)) return sentence;

      // First: if the sentence already has comma/semicolon/dash-separated
      // clauses, drop only the ones that carry the reason. A comma between
      // digits is a thousands separator ("4,000 tickets"), never a clause
      // boundary — splitting there once mangled a summary to "Resolved 4".
      const punctuationClauses = sentence.split(/(?<!\d),|,(?!\d)|;|\s+—\s+|\s+-\s+/);
      if (punctuationClauses.length > 1) {
        const kept = punctuationClauses.filter((clause) => !containsTerminationReason(clause));
        if (kept.length > 0) return finishClause(kept.join(", "));
      }

      // Second: no punctuation isolated the reason (e.g. "I managed vendor
      // contracts worth $2M annually until I was laid off in June 2026" is
      // one clause with no comma) — a temporal/causal conjunction almost
      // always introduces the reason as a trailing dependent clause, so
      // split there instead of discarding safe content along with it.
      const conjunctionMatch = sentence.match(/^(.*?)\s+\b(?:until|because|since|when|after|though|although|before)\b\s+(.*)$/i);
      if (conjunctionMatch) {
        const [, before, after] = conjunctionMatch;
        const beforeUnsafe = containsTerminationReason(before);
        const afterUnsafe = containsTerminationReason(after);
        if (!beforeUnsafe && afterUnsafe && before.trim()) return finishClause(before);
        if (!afterUnsafe && beforeUnsafe && after.trim()) return finishClause(after);
      }

      // Nothing in the sentence is independently safe from the reason.
      return "";
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
