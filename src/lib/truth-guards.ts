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
/**
 * WHY THIS FUNCTION NO LONGER CUTS ANYTHING
 * -----------------------------------------
 * It used to strip "sensitive" clauses out of the user's sentences. Seven
 * review rounds established that a lexical classifier cannot decide whose
 * situation a sentence describes, and the damage landed on this product's core
 * audience:
 *
 *   "I set up my treatment room before every client arrives."   -> deleted
 *   "I cover the front desk at my surgery on a Saturday."       -> deleted
 *   "I keep my health and safety training up to date."          -> deleted
 *   "I had to look after the whole floor when we were short."   -> deleted
 *   "One of my residents got sick and I called the nurse."      -> deleted
 *
 * A receptionist's surgery is a clinic. A therapist's treatment room is a
 * room. Health and safety is a certificate. Three successive narrowings each
 * traded one amputation for another.
 *
 * Partial stripping was worse than the deletions: the residue was handed an
 * invented lead verb, so "I dropped out of my nursing degree after one
 * semester." exported as the bullet "Supported one semester."
 *
 * THE RULE NOW: the classifier RAISES ITS HAND, it does not swing the axe. It
 * returns the text untouched plus a possible-disclosure flag. Only the user
 * resolves it. See possibleDisclosure() below and the needs_review lifecycle
 * in src/lib/dossier.ts.
 */
export type DisclosureReason = "health" | "separation" | "education" | "financial";

export type DisclosureFlag = { reason: DisclosureReason };

const disclosurePatterns: Array<[DisclosureReason, RegExp]> = [
  ["separation", /\b(?:was|were|got|been)\s+(?:laid\s+off|let\s+go|terminated|fired|dismissed|sacked|made\s+redundant)\b/i],
  ["separation", /\blaid\s+off\b/i],
  ["separation", /\b(?:left|quit|resigned)\s+(?:the\s+)?(?:job|company|role|position|post)\b/i],
  ["separation", /\b(?:left|quit|resigned)\b[^.!?]{0,50}?\bbecause\b/i],
  ["separation", /\b(?:contract|role|position)\s+(?:was\s+)?not\s+renewed\b/i],
  // Organisational-separation phrasings. These were in the original guard and
  // I dropped them when rewriting the classifier; they still need to raise a
  // hand, they just no longer cut. "Managed the reorganization of the
  // stockroom shelving" is deliberately NOT matched — the subject must be the
  // employer or a unit of it, not a thing the user organised.
  ["separation", /\b(?:company|employer|organi[sz]ation|department|team|division|group|unit|store|site|branch)\s+(?:was\s+|were\s+|later\s+|then\s+)*(?:closed|shut\s+down|folded|went\s+under|downsized|reorganiz\w*|reorganis\w*|restructur\w*|dissolved|eliminated)\b/i],
  ["separation", /\b(?:company|employer|organi[sz]ation|department|team|division)\s+(?:underwent|went\s+through|had|announced)\s+(?:a\s+)?(?:round\s+of\s+)?layoffs?\b/i],
  ["separation", /\bleadership\s+(?:decided\s+to\s+)?eliminat\w*\s+(?:the\s+)?(?:role|position|team|department)\b/i],
  ["separation", /\b(?:role|position|job|department|team)\s+(?:was\s+)?eliminated\b/i],
  ["separation", /\breduction\s+in\s+force\b/i],
  // More phrasings dropped when the classifier was rewritten. Each was caught
  // by a test, which is why the suite is adjudicated rather than normalised.
  ["separation", /\blost\s+(?:my|the)\s+(?:job|role|position)\b/i],
  ["separation", /\b(?:asked|forced|pushed)\s+to\s+resign\b/i],
  ["separation", /\b(?:my|our|the)\s+(?:hours|shifts)\s+(?:were|was)\s+cut\b/i],
  // Caught by the rewritten assertions: this phrasing was matched by NOTHING,
  // and flowed verbatim into the summary ("Brings My position was cut because
  // I flagged the billing error with a transition focus toward…").
  ["separation", /\b(?:my|our|the)\s+(?:position|role|job|post)\s+(?:was|were)\s+(?:cut|eliminated|abolished|removed)\b/i],
  ["health", /\bon\s+(?:medical|sick|disability|stress)\s+leave\b/i],
  ["health", /\b(?:my|our)\s+(?:mother|father|mom|dad|parent|son|daughter|child|husband|wife|partner|family)\b[^.!?]{0,40}?\b(?:sick|ill|unwell|injured|diagnosed|surgery|hospital)\b/i],
  ["health", /\bhad\s+to\s+(?:care\s+for|look\s+after)\s+(?:my|our)\s+(?:mother|father|mom|dad|parent|son|daughter|child|husband|wife|partner|family)\b/i],
  ["health", /\b(?:maternity|paternity|parental|bereavement|sick)\s+leave\b/i],
  ["health", /\bmy\s+own\s+(?:health|illness|diagnosis|disability|recovery)\b/i],
  ["education", /\b(?:dropped\s+out|flunked\s+out)\b/i],
  ["education", /\bhad\s+to\s+(?:drop\s+out|withdraw|leave)\b[^.!?]{0,30}\b(?:school|college|university|degree|program|course)\b/i],
  ["financial", /\b(?:could\s*n[o']?t|couldn't)\s+afford\b/i],
  ["financial", /\b(?:financial|money)\s+(?:reasons|hardship|trouble|problems)\b/i]
];

/**
 * Raises a hand. Returns a reason when the sentence MIGHT be a personal
 * disclosure — never a verdict, and never a reason to change the text.
 * Deliberately imprecise in the safe direction: a false flag costs the user
 * one review decision, while a missed flag costs them only what they already
 * chose to type.
 */
export function possibleDisclosure(text: string): DisclosureFlag | null {
  for (const [reason, pattern] of disclosurePatterns) {
    if (pattern.test(text)) return { reason };
  }
  return null;
}

export const DISCLOSURE_REASON_LABEL: Record<DisclosureReason, string> = {
  health: "possible health or personal circumstance",
  separation: "possible separation or departure",
  education: "possible education interruption",
  financial: "possible financial circumstance"
};

/**
 * Export-time safety net for text the PRODUCT wrote — summaries, headlines,
 * LinkedIn prose. This is not user evidence, so removing a sentence here does
 * not delete anything the user authored; it stops the product from asserting a
 * separation in its own voice.
 *
 * WHOLE SENTENCES ONLY. Partial stripping is retired everywhere: it was what
 * turned "I dropped out of my nursing degree after one semester." into the
 * fabricated bullet "Supported one semester." Nothing here ever emits a
 * fragment.
 *
 * User bullets are NOT passed through this. If the user reviewed a flagged
 * sentence and chose to keep it, it is theirs and it stays.
 */
export function withholdSeparationFromGeneratedProse(text: string): string {
  if (!text) return text;
  const sentences = text.split(/(?<!\.\.)(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => {
    const flag = possibleDisclosure(sentence);
    return !flag || flag.reason !== "separation";
  });
  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Kept so existing call sites keep compiling, but it NO LONGER MUTATES.
 * The text comes back exactly as it went in. `withheld` is always false —
 * nothing is withheld by a heuristic any more; the user decides.
 */
export function stripTerminationReasons(text: string): { text: string; withheld: boolean } {
  return { text, withheld: false };
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
