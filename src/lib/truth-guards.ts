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
  /\bleadership\s+(decided\s+to\s+)?eliminat(ed?|ing)\s+(the\s+)?(role|position|team|department)\b/i
];

export function containsTerminationReason(text: string): boolean {
  return terminationPatterns.some((pattern) => pattern.test(text));
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
      const conjunctionMatch = sentence.match(/^(.*?)\s+\b(until|because|since|when|after|though|although|before)\b\s+(.*)$/i);
      if (conjunctionMatch) {
        const [, before, conjunction, after] = conjunctionMatch;
        const beforeUnsafe = containsTerminationReason(before);
        const afterUnsafe = containsTerminationReason(after);
        // Keeping the clause BEFORE the conjunction is safe: it states
        // something that happened, and the conjunction only bounds when it
        // stopped. "Managed vendor contracts until I was laid off" → the
        // contracts were managed.
        if (!beforeUnsafe && afterUnsafe && before.trim()) return finishClause(before);
        // Keeping the clause AFTER it is NOT safe in general, because a
        // subordinating conjunction makes that clause's factual status depend
        // on the main clause. "I was laid off BEFORE I trained the new hires"
        // says the training never happened — promoting the dependent clause
        // exported "Trained the new hires." as an accomplishment, asserting the
        // opposite of what the user wrote. Only a CONCESSIVE conjunction
        // ("although I was laid off, I completed X") actually asserts it.
        const concessive = /^(?:though|although)$/i.test(conjunction);
        if (concessive && !afterUnsafe && beforeUnsafe && after.trim()) return finishClause(after);
      }

      // A sentence-initial concessive puts the asserted clause last with no
      // clause before the conjunction for the pattern above to match:
      // "Although I was let go, I finished the audit." Without this the whole
      // sentence would be withheld and a true accomplishment lost.
      const leadingConcessive = sentence.match(/^\s*\b(?:though|although)\b\s+(.*)$/i);
      if (leadingConcessive) {
        const remainder = leadingConcessive[1];
        const split = remainder.match(/^(.*?)(?<!\d),\s*(.*)$/);
        if (split && containsTerminationReason(split[1]) && !containsTerminationReason(split[2]) && split[2].trim()) {
          return finishClause(split[2]);
        }
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
    // "My" only drops where it opens the line ("My duties included…" →
    // "Duties included…"). A global strip deleted every interior "my" and
    // produced broken English in every export: "It was my job to reconcile
    // the drawer." became "It was job to reconcile the drawer." Mid-sentence
    // possessives are part of the user's own wording and stay.
    .replace(/^\s*my\s+/i, "")
    .replace(/^\s*([a-z])/, (match) => match.toUpperCase())
    .replace(/\s{2,}/g, " ");
}
