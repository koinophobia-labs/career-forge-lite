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
  // Six phrasings people actually use that the original list missed entirely,
  // so the sentence was never recognised as a termination reason at all and
  // printed verbatim: "Was dismissed when I refused to falsify the records."
  // announced a firing on the résumé.
  // "honorably/medically discharged" is a credential, not a termination
  // reason, and must stay on the résumé.
  // "released" is deliberately absent: "I was released to the day shift crew"
  // is a reassignment, and deleting it would amputate real work. Over-deleting
  // is as much a truth failure as leaking.
  /\b(was|were|got|getting|been)\s+(dismissed|sacked|ousted)\b/i,
  /\b(was|were|got|been)\s+(?!honorabl|medicall|general\s)(\w+\s+)?discharged\b/i,
  /\b(was|were|been)\s+separated\s+from\s+(the\s+)?(company|employer|organi[sz]ation|role|position)\b/i,
  /\b(contract|role|position|job)\s+(was\s+)?not\s+renewed\b/i,
  /\b(my|the)\s+(role|position|job|hours)\s+(was|were)\s+cut\b/i,
  /\blost\s+(my|the)\s+(job|role|position)\b/i,
  /\b(asked|forced)\s+to\s+resign\b/i,
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

// Personal circumstances a résumé must never carry. Distinct from a
// termination reason but withheld by the same path, because the harm is the
// same: a polished, trustworthy-looking document that discloses someone's
// health, family situation, money trouble, or an unfinished degree to an
// employer who never asked.
//
// Observed in the DECODED exports, not the preview:
//   word/document.xml  "Left in August 2023 because my mother got sick and I
//                       had to care for her"
//   PDF content stream "Dropped out of community college after one semester
//                       because I could not afford it"
//
// Each pattern needs BOTH a personal subject and the disclosure — "cared for
// 40 patients" is a care worker's job and must survive; "had to care for her"
// is a family circumstance.
const sensitiveDisclosurePatterns: RegExp[] = [
  // Departure framed with a reason: the reason is the disclosure.
  // The departure must be about EMPLOYMENT. Matching any "left … because"
  // deleted "Left detailed handoff notes because the night shift needed them."
  // and "I stepped down the ladder carefully because the rungs were wet."
  /\b(left|quit|resigned)\s+(?:the\s+(?:job|company|role|position|team|store|site|place)|there|that\s+job)\b[^.!?]{0,60}?\b(because|due\s+to|so\s+(i|we)\s+could)\b/i,
  /\b(left|quit|resigned|stepped\s+away|took\s+(?:time\s+off|leave|a\s+break))\b(?=[^.!?]{0,28}\b(?:19|20)\d{2}\b)[^.!?]{0,60}?\b(because|due\s+to|so\s+(i|we)\s+could)\b/i,
  /\b(quit|resigned|stepped\s+down)\b[^.!?]{0,40}?\b(because|due\s+to)\b[^.!?]{0,60}?\b(family|health|sick|illness|afford|money|childcare|caregiv\w*)\b/i,
  // Health and medical, about the candidate or their family.
  /\b(my|our)\s+\w+\s+(got|was|became|is|fell)\s+(sick|ill|injured|diagnosed)\b/i,
  /\b(i|we)\s+(got|was|were|became|fell)\s+(sick|ill|injured|diagnosed)\b/i,
  // "had to" is MANDATORY here, or an explicit family relation. My first
  // version made the prefix optional, which deleted a home health aide's core
  // duties — "I care for her three days a week in her own home." and "I take
  // care of them on the day shift." both vanished from every surface. Care
  // work is this product's primary audience; caring for someone is their JOB.
  /\bhad\s+to\s+(care\s+for|look\s+after|take\s+care\s+of)\b/i,
  /\b(care\s+for|caring\s+for|look\s+after|looking\s+after|take\s+care\s+of|taking\s+care\s+of)\s+(my|our)\s+(mother|father|mom|dad|parent|parents|son|daughter|child|children|kid|kids|husband|wife|spouse|partner|family|grandmother|grandfather|grandma|grandpa|sister|brother)\b/i,
  // "recovery" and "our" are dropped: "I ran our recovery process for damaged
  // pallets every Monday." is warehouse work, not a medical disclosure.
  /\bmy\s+(health|illness|surgery|treatment|diagnosis|disability)\b/i,
  /\b(maternity|paternity|parental|medical|bereavement)\s+leave\b/i,
  // Financial hardship.
  /\b(could\s*n[o']?t|couldn't|can\s*n[o']?t)\s+afford\b/i,
  /\b(financial|money)\s+(reasons|hardship|trouble|problems)\b/i,
  // An unfinished credential framed as a personal failure. "Some coursework"
  // or "in progress" is ordinary résumé content and is deliberately not here.
  // The object must be a course of study. "I had to leave the dock clear for
  // the next truck." is a duty, not a withdrawal.
  /\b(dropped\s+out|flunked\s+out)\b/i,
  /\bhad\s+to\s+(drop\s+out|withdraw|leave)\b[^.!?]{0,30}\b(school|college|university|program|degree|course|classes)\b/i,
  /\b(did\s*n[o']?t|never)\s+finish(ed)?\b[^.!?]{0,30}\b(school|college|university|degree|program)\b/i,
  // A bare departure statement, once its reason has been stripped away.
  // "Left in August 2023 because my mother got sick" survived as the fragment
  // "Left in August 2023" — still a separation disclosure, and useless as a
  // résumé bullet. Requires a date and a short clause, so ordinary work like
  // "Left the building secure at close every night." is untouched.
  /^\s*(left|quit|resigned|departed|stepped\s+down)\b(?=[^.!?]{0,28}\b(?:19|20)\d{2}\b)[^.!?]{0,34}$/i,
  /^\s*(left|quit|resigned|departed)\s*$/i
];

export function containsSensitiveDisclosure(text: string): boolean {
  return sensitiveDisclosurePatterns.some((pattern) => pattern.test(text));
}

export function containsTerminationReason(text: string): boolean {
  return terminationPatterns.some((pattern) => pattern.test(text));
}

// Either category disqualifies a clause from a résumé.
function isUnsafeClause(text: string): boolean {
  return containsTerminationReason(text) || containsSensitiveDisclosure(text);
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
export type WithheldCategory = "separation" | "personal";

/** Which category caused a withholding, so the receipt can say so truthfully. */
export function withheldCategory(text: string): WithheldCategory | null {
  if (containsTerminationReason(text)) return "separation";
  if (containsSensitiveDisclosure(text)) return "personal";
  return null;
}

export function stripTerminationReasons(text: string): { text: string; withheld: boolean; category?: WithheldCategory } {
  if (!containsTerminationReason(text) && !containsSensitiveDisclosure(text)) return { text, withheld: false };
  const category: WithheldCategory = containsTerminationReason(text) ? "separation" : "personal";

  const cleanedSentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      if (!containsTerminationReason(sentence) && !containsSensitiveDisclosure(sentence)) return sentence;

      // First: if the sentence already has comma/semicolon/dash-separated
      // clauses, drop only the ones that carry the reason. A comma between
      // digits is a thousands separator ("4,000 tickets"), never a clause
      // boundary — splitting there once mangled a summary to "Resolved 4".
      const punctuationClauses = sentence.split(/(?<!\d),|,(?!\d)|;|\s+—\s+|\s+-\s+/);
      if (punctuationClauses.length > 1) {
        const kept = punctuationClauses.filter((clause) => !isUnsafeClause(clause));
        if (kept.length > 0) return finishClause(kept.join(", "));
      }

      // Second: no punctuation isolated the reason (e.g. "I managed vendor
      // contracts worth $2M annually until I was laid off in June 2026" is
      // one clause with no comma) — a temporal/causal conjunction almost
      // always introduces the reason as a trailing dependent clause, so
      // split there instead of discarding safe content along with it.
      const conjunctionMatch = sentence.match(/^(.*?)\s+\b(until|because|since|whenever|when|after|while|though|although|before)\b\s+(.*)$/i);
      if (conjunctionMatch) {
        const [, before, conjunction, after] = conjunctionMatch;
        const beforeUnsafe = isUnsafeClause(before);
        const afterUnsafe = isUnsafeClause(after);
        // Keeping the clause BEFORE the conjunction is safe: it states
        // something that happened, and the conjunction only bounds when it
        // stopped. "Managed vendor contracts until I was laid off" → the
        // contracts were managed.
        if (!beforeUnsafe && afterUnsafe && before.trim()) return finishClause(before);
        // Whether the clause AFTER the conjunction may be kept depends on WHICH
        // conjunction it is — the relation, not merely the presence of one.
        // Subordinators do not behave alike here:
        //
        //   ASSERTING — the dependent clause definitely happened, so deleting
        //   it amputates a true accomplishment from the résumé:
        //     "I was laid off AFTER I completed the certification."   → completed
        //     "I was fired BECAUSE I reported the discrepancy."       → reported
        //     "I was dismissed WHEN I refused to falsify records."    → refused
        //     "I was laid off WHILE I ran the night audit."           → ran it
        //     "Although I was laid off, I completed the audit."       → completed
        //
        //   NON-ASSERTING — the clause describes something the termination
        //   pre-empted, so promoting it asserts the opposite of what was said:
        //     "I was laid off BEFORE I trained the new hires."        → never trained
        //     "I was terminated UNTIL I ran the weekly close."        → not assertable
        //
        // Treating every subordinator as non-asserting traded fabrication for
        // silent amputation, which is its own truth failure.
        const assertsDependentClause = /^(?:after|because|when|whenever|while|since|though|although)$/i.test(conjunction);
        if (assertsDependentClause && !afterUnsafe && beforeUnsafe && after.trim()) return finishClause(after);
      }

      // A sentence-initial concessive puts the asserted clause last with no
      // clause before the conjunction for the pattern above to match:
      // "Although I was let go, I finished the audit." Without this the whole
      // sentence would be withheld and a true accomplishment lost.
      const leadingConcessive = sentence.match(/^\s*\b(?:though|although)\b\s+(.*)$/i);
      if (leadingConcessive) {
        const remainder = leadingConcessive[1];
        const split = remainder.match(/^(.*?)(?<!\d),\s*(.*)$/);
        if (split && isUnsafeClause(split[1]) && !isUnsafeClause(split[2]) && split[2].trim()) {
          return finishClause(split[2]);
        }
      }

      // Nothing in the sentence is independently safe from the reason.
      return "";
    })
    .filter(Boolean);

  return { text: cleanedSentences.join(" ").replace(/\s{2,}/g, " ").trim(), withheld: true, category };
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
