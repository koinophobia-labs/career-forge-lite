// Generator truth regression — RA-P0-01, RA-P0-02, RA-P0-03.
//
// Every check reproduces a defect found in the re-audit of the deployed build
// (af431c1), where the whole repository suite passed 1640/1640 while the
// generator printed statements the user never made.
//
//   RA-P0-01  A candidate's own statement of a gap classified as a usable claim
//             and reached the exported résumé. "As of today do not hold any
//             certifications" was caught on 909a5bb, regressed by #52, and
//             still leaks; "Frankly I have never supervised anybody" and
//             "lack ... background" were never caught by any release.
//   RA-P0-02  composed() gated its clauses but spliced the LEAD VERB in
//             unconditionally, so "Maintained the safety log" emitted
//             "Reported safety concerns." A gated clause attached to an
//             invented verb is still fabrication.
//   RA-P0-03  splitResponsibilityText deleted user sentences containing
//             narration words, so "Reported to my manager and the shift lead."
//             vanished entirely — while the leftover token "manager" authorised
//             "Escalated customer issues to leads or managers."
//
// EXACT-OUTPUT assertions only. A substring check once certified
// "Supported mopped." as preservation of "Mopped.", so `includes` is never a
// pass condition here.
//
// Run directly:  node scripts/generator-truth-regression.mjs

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
const cache = new Map();

function load(fp) {
  const a = path.resolve(fp);
  if (cache.has(a)) return cache.get(a).exports;
  const { outputText } = ts.transpileModule(fs.readFileSync(a, "utf8"), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: a,
  });
  const m = { exports: {} };
  cache.set(a, m);
  const d = path.dirname(a);
  const lr = (r) =>
    r.startsWith("@/") ? load(path.join(root, "src", r.slice(2) + ".ts"))
    : r.startsWith(".") ? load(path.resolve(d, r.endsWith(".ts") ? r : r + ".ts"))
    : require(r);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(lr, m, m.exports, d, a);
  return m.exports;
}

const { classifyEvidenceAdmissibility } = load("src/lib/evidence-admissibility.ts");
const { containsSensitiveDisclosure } = load("src/lib/truth-guards.ts");
const { generateResumePackage } = load("src/lib/generator.ts");
const { initialIntake } = load("src/lib/career-data.ts");

const L = (s = "") => console.log(s);
const H = (t) => { L(); L("=".repeat(78)); L(t); L("=".repeat(78)); };
let fails = 0, passes = 0;
function expect(label, ok, detail = "") {
  if (ok) { passes += 1; console.log(`PASS ${label}`); }
  else { fails += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
const intake = (o) => ({ ...initialIntake, fullName: "Sam Okafor", email: "sam@example.com", education: "High school diploma", ...o });
const bulletsFor = (o) => generateResumePackage(intake(o)).experience.flatMap((r) => r.bullets);

// ═══════════════════════════════════════════════ RA-P0-01
H("RA-P0-01 — a candidate's own statement of a gap must never become a claim");

// The subject is the candidate and the object is an absence of evidence,
// credentials or people managed. Phrase shape must not matter: adverbs,
// multi-word adverbials, prepositional openings, contractions, misspellings and
// missing pronouns are all the same statement.
const SELF_DECLARED_GAPS = [
  "Frankly I have never supervised anybody",
  "As of today do not hold any certifications",
  "Realistically lack any formal project management background",
  "To be honest have no measurable results yet",
  "I have never supervised anybody",
  "Never supervised anybody",
  "Lack any formal project management background",
  "Have no measurable results yet",
  "In my case there is no leadership experience",
  "At this point I havent managed a budget",          // contraction, no apostrophe
  "Honestly I dont have any certifcations",           // misspelling
  "For now I do not have a degree",                   // prepositional opening
  "Up to now never led a team",
  "Currently do not have leadership experience",
  "I do not have leadership experience",
  "Did not manage a team",
  "Lacks formal certifications",
];
for (const phrase of SELF_DECLARED_GAPS) {
  const c = classifyEvidenceAdmissibility(phrase);
  expect(`withheld (not a claim): "${phrase}"  => ${c}`, c !== "claim");
}

// Negation-phrased ACHIEVEMENTS must stay usable — the subject is a third party
// or the object is an outcome, not the candidate's own missing evidence.
const NEGATION_ACHIEVEMENTS = [
  "Confirmed that no shipment left without a signed manifest",
  "Kept the ward so that residents did not experience a single fall",
  "Set up checks so drivers could not depart without a pre-trip inspection",
  "Arranged coverage so the desk was never left unattended",
  "Ensured contractors did not work without a valid permit",
  "Verified that unauthorized visitors did not have building access",
  "We did not have a single security breach in 18 months",
  "Built the runbook so we did not have repeat outages",
];
for (const phrase of NEGATION_ACHIEVEMENTS) {
  const c = classifyEvidenceAdmissibility(phrase);
  expect(`usable claim: "${phrase.slice(0, 52)}…"  => ${c}`, c === "claim");
}

// End to end: a gap statement must reach NO surface, including the export.
const { sanitizeCareerDossier } = load("src/lib/evidence-admissibility.ts");
const { emptyDossier, evidenceRecord } = load("src/lib/dossier.ts");
const { generateResumePack } = load("src/lib/resume-pack.ts");
const { variantPlainText } = load("src/lib/pack-export.ts");
const NOW = "2026-08-04T09:00:00.000Z";
const gapRec = { ...evidenceRecord("responsibility", "As of today do not hold any certifications", "manual", true, NOW), roleId: "r-gap" };
const goodRec = { ...evidenceRecord("responsibility", "Booked carrier appointments each morning", "manual", true, NOW), roleId: "r-gap" };
const gapDossier = sanitizeCareerDossier({
  ...emptyDossier(NOW),
  identity: { ...emptyDossier(NOW).identity, fullName: "Sam Okafor", email: "sam@example.com" },
  roles: [{ id: "r-gap", title: "Dispatch Clerk", employer: "Vance Freight", startDate: "2023", endDate: "", current: true,
    responsibilities: [gapRec.detail, goodRec.detail], tools: [], outcomes: [], evidenceIds: [gapRec.id, goodRec.id] }],
  evidence: [gapRec, goodRec], approvedClaims: [gapRec.detail, goodRec.detail], proofPoints: [],
}).dossier;
const gapLane = [{ id: "L", title: "Operations Coordinator", status: "active", whyFit: "x", resumeAngle: "y", proof: [], gaps: [], keywords: [], source: "library", createdAt: NOW }];
const gapPack = generateResumePack(gapDossier, gapLane, NOW);
const gapVariant = gapPack.variants[0];
const gapSurfaces = {
  "in-memory résumé": JSON.stringify(gapPack.variants.map((v) => v.resume)),
  "evidence references": JSON.stringify(gapVariant.evidenceReferences),
  "pack receipt": JSON.stringify(gapPack.receipt ?? {}),
  "plain-text export": variantPlainText(gapDossier, gapVariant.resume, gapVariant.sectionOrder, gapVariant.kind),
};
for (const [surface, text] of Object.entries(gapSurfaces)) {
  expect(`gap statement absent from: ${surface}`, !text.includes("do not hold any certifications"), text.slice(0, 200));
}
expect("the admissible fact still reaches the export",
  gapSurfaces["plain-text export"].includes("Booked carrier appointments each morning"));

// ═══════════════════════════════════════════════ RA-P0-02
H("RA-P0-02 — every emitted word, including the lead verb, needs its own grounding");

// Each case: the user's text evidences the clause NOUN but never the LEAD verb.
// The emitted bullet must not assert the act named by that verb.
const UNEVIDENCED_LEADS = [
  ["Facilities Assistant", "Maintained the safety log", /\bReported\b/, "Reported safety concerns"],
  ["Custodian", "Reorder supplies when we run low", /\bReported\b/, "Reported supply needs"],
  ["Bartender", "Always checked IDs before serving.", /\bResolved\b/, "Resolved guest concerns"],
  ["Security Officer", "The building has cameras in the lobby.", /\bMonitored\b/, "Monitored camera feeds"],
  ["Home Health Aide", "The facility keeps care notes for each resident.", /\bKept\b/, "Kept care notes"],
  ["Front Desk Receptionist", "The office has a scheduling calendar.", /\bSupported\b/, "Supported scheduling"],
  ["Warehouse Associate", "It was a safe environment to work in.", /\bFollowed\b/, "Followed safety procedures"],
];
for (const [title, typed, verb, claim] of UNEVIDENCED_LEADS) {
  const out = bulletsFor({ currentTitle: title, currentCompany: "Halden Group", currentTime: "2023 - Present", responsibilities: typed });
  const asserted = out.filter((b) => verb.test(b) && !new RegExp(verb.source, "i").test(typed));
  expect(`"${typed.slice(0, 44)}" does not assert "${claim}"`, asserted.length === 0, JSON.stringify(out));
}

// A lead the user DID evidence must still render.
const evidencedLead = bulletsFor({ currentTitle: "Custodian", currentCompany: "Northline Schools", currentTime: "2023 - Present",
  responsibilities: "Reported broken fixtures to the front office" });
expect("an evidenced lead verb still renders", evidencedLead.length > 0, JSON.stringify(evidencedLead));

// ═══════════════════════════════════════════════ RA-P0-03
H("RA-P0-03 — a user's sentence must never be deleted, nor a leftover token reused");

const NARRATION = [
  ["Reported to my manager and the shift lead.", "manager", /Escalated customer issues/],
  ["I was responsible for closing the store.", "closing", null],
  ["They told me to cover the front desk.", "front desk", null],
  ["It was my job to reconcile the drawer.", "reconcile", null],
];
for (const [typed, keyword, forbidden] of NARRATION) {
  const pkg = generateResumePackage(intake({ currentTitle: "Shift Lead", currentCompany: "Corner Market", currentTime: "2023 - Present", responsibilities: typed }));
  const whole = JSON.stringify(pkg);
  expect(`"${typed}" is not erased from the package`, whole.toLowerCase().includes(keyword.toLowerCase()), whole.slice(0, 220));
  if (forbidden) {
    const bullets = pkg.experience.flatMap((r) => r.bullets);
    expect(`  a leftover token does not authorise "${forbidden.source}"`, !bullets.some((b) => forbidden.test(b)), JSON.stringify(bullets));
  }
}

// The exact sentence must survive verbatim as its own bullet.
const exactLine = "Reported to my manager and the shift lead.";
const exactOut = bulletsFor({ currentTitle: "Shift Lead", currentCompany: "Corner Market", currentTime: "2023 - Present", responsibilities: exactLine });
expect(`emitted verbatim: "${exactLine}"`, exactOut.includes(exactLine), JSON.stringify(exactOut));

// A compound object must not be split into a fabricated fragment.
const COMPOUND = [
  ["Logged calls from O'Fallon and DeSoto.", /^Supported DeSoto\.$/],
  ["Delivered packages to Florissant and Ferguson.", /^Supported Ferguson\.$/],
  ["Trained staff on the scanner and the label printer.", /^Supported the label printer\.$/],
];
for (const [typed, fabrication] of COMPOUND) {
  const out = bulletsFor({ currentTitle: "Delivery Driver", currentCompany: "Swift Courier", currentTime: "2023 - Present", responsibilities: typed });
  expect(`compound sentence emitted whole: "${typed}"`, out.includes(typed), JSON.stringify(out));
  expect(`  no fabricated fragment ${fabrication.source}`, !out.some((b) => fabrication.test(b)), JSON.stringify(out));
}

// ═══════════════════════════════════════════════ RA-P0-04
// Fixtures authored by the INDEPENDENT adversarial review of this branch, kept
// verbatim so the defects it found can never come back. Each of these failed
// before the repair that follows it.
H("RA-P0-04 — findings from independent adversarial review");

// (a) Rescuing a narration sentence from deletion must not hand it an invented
// lead verb. The reviewer's exact repro; this was INTRODUCED by the first
// RA-P0-03 fix and is the reason a word count cannot classify a noun label.
for (const [typed, fabricated] of [
  ["It was hectic. Stocked shelves and bagged groceries.", "Supported It was hectic."],
  ["Managed it well. They promoted me twice.", "Supported They promoted me twice."],
  ["I was the closer.", "Supported was the closer."]
]) {
  const out = bulletsFor({ currentTitle: "Stock Clerk", currentCompany: "Value Mart", currentTime: "2022 - Present", responsibilities: typed });
  expect(`no invented lead on rescued narration: "${fabricated}"`, !out.includes(fabricated), JSON.stringify(out));
}

// (b) A described de-escalation must never produce the OPPOSITE claim, and
// merely naming a manager or making a phone call must not ground escalation.
for (const [title, company, typed] of [
  ["Security Guard", "Meridian Plaza", "De-escalated upset callers on the lobby phone."],
  ["Security Guard", "Meridian Plaza", "Called the shuttle company when visitors needed rides."],
  ["Cashier", "Value Mart", "Took customer orders while my manager watched the floor."]
]) {
  const out = bulletsFor({ currentTitle: title, currentCompany: company, currentTime: "2022 - Present", responsibilities: typed });
  expect(`no fabricated escalation claim from: "${typed}"`, !out.some((b) => /^Escalated\b/.test(b)), JSON.stringify(out));
}

// (c) A room is not a team; an adjective about a place is not a procedure.
{
  const pkg = generateResumePackage(intake({ currentTitle: "Line Cook", currentCompany: "Copper Skillet", currentTime: "2022 - Present", responsibilities: "Scrubbed the kitchen floors after close." }));
  const out = pkg.experience.flatMap((r) => r.bullets);
  expect("solo cleaning does not ground a coordination claim", !out.some((b) => /Coordinated with coworkers/.test(b)), JSON.stringify(out));
  expect("solo cleaning does not mint a Team Coordination skill", !pkg.coreSkills.includes("Team Coordination"), JSON.stringify(pkg.coreSkills));
}
{
  const pkg = generateResumePackage(intake({ currentTitle: "Warehouse Associate", currentCompany: "Gulf Distribution", currentTime: "2022 - Present", responsibilities: "The dock always felt safe at night." }));
  expect('"felt safe" does not mint a Safety Procedures skill', !pkg.coreSkills.includes("Safety Procedures"), JSON.stringify(pkg.coreSkills));
}

// (d) A self-declared gap is withheld no matter which verb carries it — the
// verb list used to stop at manage/own/lead/… so "trained" slipped through and
// the negation was printed as an achievement.
for (const gapText of [
  "I have never trained anyone",
  "Never trained anyone",
  "I have never written a report"
]) {
  expect(`self-declared gap withheld: "${gapText}"`, classifyEvidenceAdmissibility(gapText) !== "claim", classifyEvidenceAdmissibility(gapText));
}
// A negation that names no evidence noun ("…closed the register on my own")
// stays a claim. Treating EVERY first-person "never" as a gap was tried and
// reverted: it quarantined true achievements ("I never had to escalate a
// single ticket") and deleted them from the résumé, which is its own truth
// failure. The invariant that actually matters is that the claim is never
// INVERTED — the sentence may be printed as the user wrote it, but its
// affirmative twin must never be manufactured.
// …while negating a BAD OUTCOME stays an accomplishment.
for (const achievement of ["I did not lose any data", "I never missed a deadline", "We did not have a security breach on the platform"]) {
  expect(`achievement stays a claim: "${achievement}"`, classifyEvidenceAdmissibility(achievement) === "claim", classifyEvidenceAdmissibility(achievement));
}

// ═══════════════════════════════════════════════ RA-P0-05
// Fixtures from the SECOND independent adversarial review (of PR #58 on the
// integrated branch). It returned FAIL on three of four lenses and found two
// P0s that #58 had INTRODUCED. Kept verbatim so they cannot come back.
H("RA-P0-05 — findings from the second independent review");

// (a) INTRODUCED BY #58: a comma-separated verb list got an invented lead.
// isVerbLed read the first token WITH its comma ("Mopped,") and its -ed/-ing
// test is $-anchored, so the line was judged a bare noun label.
for (const typed of [
  "Mopped, swept, wiped.",
  "Vacuumed, dusted, polished.",
  "Bussed, wiped, reset.",
  "Folded, hung, tagged.",
  "Bathed, dressed, fed."
]) {
  const out = bulletsFor({ currentTitle: "Sales Associate", currentCompany: "Northgate Market", currentTime: "2022 - 2025", responsibilities: typed });
  expect(`comma-separated verb list keeps its own lead: "${typed}"`, out.includes(typed), JSON.stringify(out));
  expect(`  no invented "Supported" lead on "${typed}"`, !out.some((b) => b.startsWith("Supported ")), JSON.stringify(out));
}

// (b) INTRODUCED BY #58: an ellipsis was read as a sentence boundary, so one
// sentence became two claims rejoined with an invented "and".
{
  const typed = "Closed, counted, locked up... every single night.";
  const out = bulletsFor({ currentTitle: "Sales Associate", currentCompany: "Northgate Market", currentTime: "2022 - 2025", responsibilities: typed });
  expect("an ellipsis does not split one sentence into two claims", out.length === 1, JSON.stringify(out));
  expect("  the halves are not rejoined with an invented \"and\"", !out.some((b) => /locked up and every single night/i.test(b)), JSON.stringify(out));
  expect("  no invented \"Supported\" lead", !out.some((b) => b.startsWith("Supported ")), JSON.stringify(out));
}

// (c) A DENIAL must never ground its own affirmative. Grounding had no notion
// of polarity: "I never handled cash" produced the skill Cash Handling, "I am
// not forklift certified" produced Equipment Operation, and "I never had to
// escalate a single ticket" produced the canned bullet "Escalated customer
// issues to leads or managers."
for (const [typed, forbiddenSkill, forbiddenBullet] of [
  ["I never used a register or handled cash.", "Cash Handling", /^Processed payments/],
  ["I am not forklift certified and never drove one.", "Equipment Operation", null],
  ["I never had to escalate a single ticket.", "Issue Escalation", /^Escalated /]
]) {
  const pkg = generateResumePackage(intake({ currentTitle: "Associate", currentCompany: "Northgate", currentTime: "2022 - 2025", responsibilities: typed }));
  const out = pkg.experience.flatMap((r) => r.bullets);
  expect(`denial does not mint "${forbiddenSkill}": "${typed}"`, !pkg.coreSkills.includes(forbiddenSkill), JSON.stringify(pkg.coreSkills));
  expect(`  denial is not listed as a skill verbatim`, !pkg.coreSkills.some((s) => /\b(?:not|never)\b/i.test(s)), JSON.stringify(pkg.coreSkills));
  expect(`  denial gets no invented "Supported" lead`, !out.some((b) => b.startsWith("Supported ")), JSON.stringify(out));
  if (forbiddenBullet) {
    expect(`  denial does not emit ${forbiddenBullet.source}`, !out.some((b) => forbiddenBullet.test(b)), JSON.stringify(out));
  }
}
// …and the positive controls must still ground, or the filter is over-broad.
// The occupation-template layer is RETIRED (src/lib/occupation-templates.ts),
// so a positive statement no longer MINTS a taxonomy label — that was the
// mechanism which also minted Cash Handling from "The cash office was next to
// my register." The control that still matters is that the user's own words
// survive intact, which is what the product now promises.
for (const typed of [
  "Handled cash at the register every shift.",
  "Coordinated with coworkers during the dinner rush."
]) {
  const out = bulletsFor({ currentTitle: "Sales Associate", currentCompany: "Northgate Market", currentTime: "2022 - 2025", responsibilities: typed });
  expect(`the user's own sentence survives: "${typed}"`, out.includes(typed), JSON.stringify(out));
}

// (d) A true achievement phrased with "never" must NOT be quarantined. The
// first attempt at (c)'s sibling rule treated every first-person "never" as a
// gap and deleted real accomplishments from the résumé.
for (const achievement of [
  "I never had to escalate a single ticket",
  "I never missed a shift in two years"
]) {
  expect(`achievement phrased with "never" is not quarantined: "${achievement}"`, classifyEvidenceAdmissibility(achievement) === "claim", classifyEvidenceAdmissibility(achievement));
}

// ═══════════════════════════════════════════════ RA-P0-06
// A termination reason in the MAIN clause governs the clause attached to it —
// but subordinators do NOT behave alike, and an earlier version of this fix
// treated them as if they did. That traded fabrication for silent amputation:
// "I was laid off AFTER I completed the certification." lost the completion.
// Extraction has to be RELATION-AWARE.
H("RA-P0-06 — relation-aware extraction around a termination reason");

const TERMINATION_WORDS = /\b(laid off|let go|terminated|fired|dismissed|sacked|downsized|redundant|not renewed|lost my job|asked to resign)\b/i;

// NON-ASSERTING: the termination pre-empted the event, so promoting the clause
// asserts the opposite of what the user wrote.
for (const [typed, inverted] of [
  ["I was laid off before I completed the certification.", /completed the certification/i],
  ["I was laid off before I trained the new hires.", /trained the new hires/i],
  ["I was terminated until I ran the weekly close.", /ran the weekly close/i]
]) {
  const pkg = generateResumePackage(intake({ currentTitle: "Sales Associate", currentCompany: "Northgate", currentTime: "2022 - 2025", responsibilities: typed }));
  expect(`pre-empted event is NOT asserted: "${typed}"`, !inverted.test(JSON.stringify(pkg)), JSON.stringify(pkg).slice(0, 240));
}

// ASSERTING: the event definitely happened. Deleting it amputates a true
// accomplishment — as much a truth failure as inventing one.
for (const [typed, mustSurvive] of [
  ["I was laid off after I completed the certification.", /completed the certification/i],
  ["I was fired because I reported the accounting discrepancy.", /reported the accounting discrepancy/i],
  ["I was dismissed when I refused to falsify the records.", /refused to falsify the records/i],
  ["I was laid off while I ran the night audit.", /ran the night audit/i],
  ["My contract was not renewed after I delivered the migration.", /delivered the migration/i],
  ["My position was cut because I flagged the billing error.", /flagged the billing error/i],
  ["Although I was laid off, I completed the safety certification.", /completed the safety certification/i]
]) {
  const pkg = generateResumePackage(intake({ currentTitle: "Sales Associate", currentCompany: "Northgate", currentTime: "2022 - 2025", responsibilities: typed }));
  const whole = JSON.stringify(pkg);
  expect(`asserted event SURVIVES: "${typed}"`, mustSurvive.test(whole), whole.slice(0, 240));
  // …and the termination reason itself never rides along with it. This is the
  // assertion that caught "Was dismissed when I refused to falsify the
  // records." being exported whole, because "dismissed" was missing from the
  // termination patterns entirely.
  expect(`  the termination reason itself is not exported`, !TERMINATION_WORDS.test(whole), whole.slice(0, 240));
}

// The clause BEFORE the conjunction states something that happened; the
// conjunction only bounds when it stopped.
{
  const kept = bulletsFor({ currentTitle: "Sales Associate", currentCompany: "Northgate", currentTime: "2022 - 2025", responsibilities: "Managed vendor contracts worth $2M annually until I was laid off in June 2026." });
  expect("an accomplishment bounded by a termination is KEPT", kept.includes("Managed vendor contracts worth $2M annually."), JSON.stringify(kept));
  expect("  the termination reason itself is not exported", !TERMINATION_WORDS.test(JSON.stringify(kept)), JSON.stringify(kept));
}

// Termination phrasings the original pattern list missed entirely, so the
// sentence was never recognised and printed verbatim.
for (const phrasing of [
  "I was dismissed in March.",
  "I was sacked in March.",
  "My contract was not renewed.",
  "My position was cut.",
  "I lost my job in March.",
  "I was asked to resign."
]) {
  const pkg = generateResumePackage(intake({ currentTitle: "Sales Associate", currentCompany: "Northgate", currentTime: "2022 - 2025", responsibilities: `Ran the weekly inventory count. ${phrasing}` }));
  const whole = JSON.stringify(pkg);
  expect(`termination phrasing is recognised: "${phrasing}"`, !TERMINATION_WORDS.test(whole), whole.slice(0, 200));
  expect(`  the surrounding true work survives`, /weekly inventory count/i.test(whole), whole.slice(0, 200));
}

// …without over-deleting: an honourable discharge is a credential, and a
// reassignment is not a termination.
for (const [typed, mustSurvive] of [
  ["Honorably discharged after four years of service.", /Honorably discharged/i],
  ["I was released to the day shift crew.", /day shift crew/i]
]) {
  const pkg = generateResumePackage(intake({ currentTitle: "Sales Associate", currentCompany: "Northgate", currentTime: "2022 - 2025", responsibilities: typed }));
  expect(`not treated as a termination: "${typed}"`, mustSurvive.test(JSON.stringify(pkg)), JSON.stringify(pkg).slice(0, 240));
}

// ═══════════════════════════════════════════════ RA-P0-07
// Fixtures from the THIRD independent adversarial review (of PR #59). It
// returned FAIL and found two more defects introduced by my own repairs, plus
// proved the composed() cross-concept problem is STRUCTURAL — 111 clauses in
// 10 occupation pools, ~30 asserting an activity their trigger never
// evidenced — rather than the finite list two earlier patches assumed.
H("RA-P0-07 — findings from the third independent review");

// (a) INTRODUCED: the "ellipsis-safe" split was an UNSATISFIABLE regex —
// (?<![.!?])(?<=[.!?]) asserts the preceding character both is and is not
// terminal punctuation. splitResponsibilityText therefore stopped splitting
// sentences at all, so every per-item filter below it only ever saw sentence
// #1 and the rest of the paragraph rode into the résumé unfiltered.
for (const [typed, mustKeep, mustDrop] of [
  ["Answered the phones at the front desk. I do not know how many calls I took.", /answered the phones/i, /do not know how many calls/i],
  ["Cleaned the pumps. Worked at a gas station for two years.", /cleaned the pumps/i, /worked at a gas station/i]
]) {
  const pkg = generateResumePackage(intake({ currentTitle: "Receptionist", currentCompany: "Halbrook", currentTime: "2022 - 2025", responsibilities: typed }));
  const whole = JSON.stringify(pkg);
  expect(`sentences are still split: "${typed.slice(0, 40)}…"`, mustKeep.test(whole), whole.slice(0, 220));
  expect(`  the unusable sentence does not ride along`, !mustDrop.test(whole), whole.slice(0, 220));
}
// …and the ellipsis the change was written for is still one claim.
{
  const out = bulletsFor({ currentTitle: "Sales Associate", currentCompany: "Northgate", currentTime: "2022 - 2025", responsibilities: "Closed, counted, locked up... every single night." });
  expect("an ellipsis is still not a sentence boundary", out.length === 1, JSON.stringify(out));
}

// (b) INTRODUCED: leadIsEvidenced early-returned true for any stem under three
// characters. "Used" stems to "us", so every "Used …" bullet skipped the gate.
for (const [title, typed, fabricated] of [
  ["General Laborer", "The tools were locked in the gang box overnight.", /Used hand and power tools/i],
  ["Warehouse Associate", "Walked past forklifts on my way to the break room.", /Used powered equipment/i],
  ["Custodian", "The tools belonged to the building engineer.", /Used basic tools/i]
]) {
  const pkg = generateResumePackage(intake({ currentTitle: title, currentCompany: "Vantage", currentTime: "2022 - 2025", responsibilities: typed }));
  expect(`short-stem lead is still gated: "${typed.slice(0, 40)}…"`, !fabricated.test(JSON.stringify(pkg)), JSON.stringify(pkg).slice(0, 220));
}

// (c) STRUCTURAL: a clause's trigger regex says a related word appeared. It
// does not say the PHRASE is true. The phrase must be grounded in its own
// right, or a cross-concept licence fabricates a specific activity — including
// clinical claims a care worker never made.
for (const [title, typed, fabricated] of [
  ["Caregiver", "Supported the housekeeping team. I cleaned the toilets on my hall.", /personal care/i],
  ["Caregiver", "Supported the activities director. I walked the halls checking doors.", /with mobility/i],
  ["Cashier", "Assisted at the service desk. I logged exchanges in the binder.", /with returns/i],
  ["Cashier", "I swept the sales floor before open.", /with purchases/i],
  ["Cashier", "My manager asked me to stay late.", /with questions/i],
  ["Cashier", "I scanned merchandise into the system.", /locating products/i],
  ["Cashier", "I hung gift cards on the rack.", /Processed payments/i],
  ["Cashier", "Kept the backroom door locked.", /organizing inventory areas/i],
  ["Custodian", "Maintained my cart and my keys. I called maintenance when something broke.", /routine upkeep/i]
]) {
  const pkg = generateResumePackage(intake({ currentTitle: title, currentCompany: "Northgate", currentTime: "2022 - 2025", responsibilities: typed }));
  expect(`cross-concept licence refused: "${typed.slice(0, 44)}…"`, !fabricated.test(JSON.stringify(pkg)), JSON.stringify(pkg).slice(0, 240));
}
// …without amputating the real thing when the user DID describe it.
for (const [title, typed, mustSurvive] of [
  ["Cashier", "Processed customer returns at the service desk every shift.", /returns/i],
  ["Caregiver", "Provided personal care and bathing help to residents each morning.", /personal care/i],
  ["Cashier", "Processed cash and card payments at the register all day.", /payments/i]
]) {
  const pkg = generateResumePackage(intake({ currentTitle: title, currentCompany: "Northgate", currentTime: "2022 - 2025", responsibilities: typed }));
  expect(`genuine work still reaches the résumé: "${typed.slice(0, 44)}…"`, mustSurvive.test(JSON.stringify(pkg)), JSON.stringify(pkg).slice(0, 240));
}

// (d) The negation marker must be a CLOSED auxiliary list. Writing it as
// [A-Za-z]+n['’]?t made every English word ending in "nt" a negation —
// management, equipment, front, different, important, consistent, department,
// assistant, restaurant, client, account — which silently stripped ordinary
// true sentences out of the grounding corpus and emptied CORE SKILLS.
{
  const ordinary = "Handled cash and card payments at the front register. Managed the equipment consistently.";
  const pkg = generateResumePackage(intake({ currentTitle: "Sales Associate", currentCompany: "Northgate", currentTime: "2022 - 2025", responsibilities: ordinary }));
  expect("words ending in \"nt\" do not read as negations", pkg.coreSkills.length > 0, JSON.stringify(pkg.coreSkills));
  expect("  the user's own sentence still reaches the résumé", /front register/i.test(JSON.stringify(pkg)), JSON.stringify(pkg).slice(0, 200));
}
for (const [typed, forbiddenSkill] of [
  ["I never handled cash at the front register.", "Cash Handling"],
  ["I havent managed anyone on the team.", null],
  ["I dont have a forklift certification.", "Equipment Operation"]
]) {
  const pkg = generateResumePackage(intake({ currentTitle: "Sales Associate", currentCompany: "Northgate", currentTime: "2022 - 2025", responsibilities: typed }));
  if (forbiddenSkill) {
    expect(`real negation still strips grounding: "${typed}"`, !pkg.coreSkills.includes(forbiddenSkill), JSON.stringify(pkg.coreSkills));
  }
  expect(`  denial is not listed as a skill: "${typed}"`, !pkg.coreSkills.some((skill) => /\b(?:not|never)\b|n['’]?t\b/i.test(skill)), JSON.stringify(pkg.coreSkills));
}

// ═══════════════════════════════════════════════ RA-P0-08
// Sensitive personal disclosures must never reach an exported document, and
// "no <noun>" must be read RELATION-first. Both were found by decoding the
// actual DOCX/PDF, not by reading generator return values.
H("RA-P0-08 — sensitive disclosures and relation-aware 'no'");

const SENSITIVE = /(mother got sick|care for her|dropped out|could ?n'?t afford|could not afford|medical leave|left in august)/i;

for (const typed of [
  "Left in August 2023 because my mother got sick and I had to care for her.",
  "I dropped out of community college after one semester because I could not afford it.",
  "I quit because I couldn't afford childcare.",
  "I was on medical leave for three months."
]) {
  const pkg = generateResumePackage(intake({ currentTitle: "Clerk", currentCompany: "Grocery Co", currentTime: "2021 - 2023", responsibilities: `Ran the front end register during Sunday peak. ${typed}` }));
  const whole = JSON.stringify(pkg);
  expect(`personal disclosure never reaches the document: "${typed.slice(0, 46)}…"`, !SENSITIVE.test(whole), whole.slice(0, 240));
  expect(`  the surrounding true work survives`, /front end register/i.test(whole), whole.slice(0, 200));
}

// …and ordinary care work, unfinished-but-neutral study, and "left" used as a
// normal verb are NOT disclosures. Over-deletion is its own truth failure.
for (const [typed, mustSurvive] of [
  ["Cared for 40 patients per shift on the memory-care wing.", /40 patients/i],
  ["Provided personal care and bathing help to residents each morning.", /bathing help/i],
  ["Completed some coursework in accounting.", /coursework in accounting/i],
  ["Left the building secure at close every night.", /building secure/i]
]) {
  const pkg = generateResumePackage(intake({ currentTitle: "Caregiver", currentCompany: "Bright Meadows", currentTime: "2021 - 2024", responsibilities: typed }));
  expect(`ordinary work is not treated as a disclosure: "${typed.slice(0, 46)}…"`, mustSurvive.test(JSON.stringify(pkg)), JSON.stringify(pkg).slice(0, 240));
}

// "with no X" describes HOW the work was done — evidence of independence.
// "I have no X" is an absence of evidence. A blanket no+noun rule deleted
// three of four approved accomplishments from every exported document.
for (const achievement of [
  "Completed closing procedures with no supervision.",
  "Trained six new hires with no formal training budget.",
  "Rebuilt the schedule with no history to work from.",
  "Ran the night shift with no manager on site."
]) {
  expect(`adverbial "no" stays a claim: "${achievement}"`, classifyEvidenceAdmissibility(achievement) === "claim", classifyEvidenceAdmissibility(achievement));
}
for (const gap of [
  "I have no supervisory experience.",
  "No formal training or certifications yet.",
  "I have no leadership experience.",
  "No measurable results yet."
]) {
  expect(`declared absence stays a gap: "${gap}"`, classifyEvidenceAdmissibility(gap) !== "claim", classifyEvidenceAdmissibility(gap));
}

// ═══════════════════════════════════════════════ RA-P0-09
// THE OCCUPATION-TEMPLATE LAYER IS RETIRED FROM THE LAUNCH PATH.
// Five review rounds established that lexical gating cannot decide WHO
// performed an action. These assertions pin the retirement itself: no
// occupation-derived phrase may reach a document unless it is already
// user-owned evidence.
H("RA-P0-09 — the occupation-template layer is retired");

{
  const flags = fs.readFileSync(path.join(root, "src/lib/occupation-templates.ts"), "utf8");
  expect("the layer is off unless explicitly set to research", /=== "research"/.test(flags), flags.slice(0, 200));
  const source = fs.readFileSync(path.join(root, "src/lib/generator.ts"), "utf8");
  expect("the generator gates on the retirement flag", (source.match(/OCCUPATION_TEMPLATES_ENABLED/g) || []).length >= 8, "too few gates");
}

// (a) THIRD-PARTY ATTRIBUTION — the class the gates could never decide.
// 13 of 15 fabricated before retirement.
for (const [title, typed] of [
  ["Caregiver", "The night crew kept the care notes for me."],
  ["Cashier", "A senior cashier processed the payments while I bagged."],
  ["Security Officer", "A contracted team monitored the camera feeds from off site."],
  ["Line Cook", "My shift lead handled the customer questions and the order issues."],
  ["Janitor", "The day porter reported the broken fixtures and the safety concerns."],
  ["Receptionist", "The office manager kept the appointments and the messages."],
  ["Warehouse Associate", "A quality inspector checked the labels and the counts after us."],
  ["Delivery Driver", "The dispatcher used the delivery apps and the navigation tools for us."]
]) {
  const out = bulletsFor({ currentTitle: title, currentCompany: "Northgate", currentTime: "2020 - 2023", responsibilities: typed });
  const own = typed.replace(/[.\s]/g, "").toLowerCase();
  const extra = out.filter((bullet) => bullet.replace(/[.\s]/g, "").toLowerCase() !== own);
  expect(`no act is borrowed from a third party: "${typed.slice(0, 48)}…"`, extra.length === 0, JSON.stringify(out));
}

// (b) THE USER'S OWN WORK MUST SURVIVE — retirement must not become amputation.
for (const [title, typed, mustSurvive] of [
  ["Security Officer", "I patrolled the building every hour and checked that the doors were locked.", /patrolled the building/i],
  ["Caregiver", "I bathed and dressed two clients every morning.", /bathed and dressed two clients/i],
  ["Caregiver", "I gave medication reminders and wrote care notes.", /medication reminders/i],
  ["Attendant", "I cleaned the pumps.", /cleaned the pumps/i],
  ["Order Picker", "I packed 200 orders a night without a single mistake.", /packed 200 orders/i]
]) {
  const pkg = generateResumePackage(intake({ currentTitle: title, currentCompany: "Northgate", currentTime: "2020 - 2023", responsibilities: typed }));
  expect(`the user's own work survives: "${typed.slice(0, 44)}…"`, mustSurvive.test(JSON.stringify(pkg)), JSON.stringify(pkg).slice(0, 220));
}

// (c) NO TAXONOMY PHRASE IN ANY DOCUMENT SURFACE — bullets, skills, summary.
// Each fixture names something WITHOUT describing the activity.
for (const [title, typed, forbidden] of [
  ["Cashier", "The cash office was next to my register.", /cash handling/i],
  ["Warehouse Associate", "A safety poster hung over the dock door.", /safety procedures/i],
  ["Caregiver", "Patients waited in the lobby I cleaned.", /patient support|personal care|mobility/i],
  ["Security Officer", "The camera monitors sat in the guard station.", /monitored|camera feeds/i],
  ["Line Cook", "The food prep table was cleaned nightly.", /preparing food/i]
]) {
  const pkg = generateResumePackage(intake({ currentTitle: title, currentCompany: "Northgate", currentTime: "2020 - 2023", responsibilities: typed }));
  const whole = JSON.stringify(pkg);
  expect(`no taxonomy claim from a bare noun: "${typed.slice(0, 44)}…"`, !forbidden.test(whole), whole.slice(0, 240));
  expect(`  no attribution sentence either`, !/strengths the candidate reports include/i.test(whole), whole.slice(0, 200));
}

// ═══════════════════════════════════════════════ RA-P0-10
// Round 5. The retirement missed the LinkedIn headline entirely, and my own
// sensitive-disclosure guard turned into the amputation machine it was written
// to avoid — it deleted a home health aide's core duties.
H("RA-P0-10 — findings from the fifth independent review");

// (a) The headline rewrote the user's real job title into a taxonomy label and
// appended a competency, for a user who typed a title and an employer only.
for (const title of ["Cashier", "Security Officer", "Caregiver", "Janitor", "Warehouse Associate", "Barista", "Receptionist"]) {
  const pkg = generateResumePackage(intake({ currentTitle: title, currentCompany: "Bellview", currentTime: "2022 - 2024" }));
  expect(`headline keeps the user's own title: "${title}"`, pkg.linkedinHeadline.startsWith(title), pkg.linkedinHeadline);
  expect(`  no taxonomy competency is appended`, !/\|\s*(Customer Service|Patient Support|Safety & Compliance|Operations|Documentation)\s*$/.test(pkg.linkedinHeadline) || pkg.linkedinHeadline.endsWith(intake({}).targetJobTitle || ""), pkg.linkedinHeadline);
}
// …and it must not commit the attribution error the retirement exists to close.
{
  const pkg = generateResumePackage(intake({ currentTitle: "Caregiver", currentCompany: "BM", currentTime: "2022 - 2024", responsibilities: "The night crew kept the care notes for me." }));
  expect("headline credits nothing to the candidate from a third-party sentence", !/Documentation/i.test(pkg.linkedinHeadline), pkg.linkedinHeadline);
  expect("  linkedinSummary asserts no taxonomy environment", !/hands-on experience in \w+ .*environment/i.test(pkg.linkedinSummary), pkg.linkedinSummary);
}

// (b) CARE WORK IS A JOB. The disclosure guard had an OPTIONAL "had to"
// prefix, contradicting its own comment, and deleted these from every surface.
for (const typed of [
  "I care for her three days a week in her own home.",
  "I take care of them on the day shift.",
  "Cared for 40 patients per shift on the memory-care wing.",
  "Looked after the stockroom keys for the whole team.",
  "I had to leave the dock clear for the next truck.",
  "Left detailed handoff notes because the night shift needed them.",
  "I stepped down the ladder carefully because the rungs were wet.",
  "I ran our recovery process for damaged pallets every Monday."
]) {
  expect(`ordinary work is not a personal disclosure: "${typed.slice(0, 46)}…"`, !containsSensitiveDisclosure(typed), typed);
}
// …while genuine disclosures are still withheld.
for (const typed of [
  "I had to care for my father after his surgery.",
  "I take care of my mother full time.",
  "I dropped out of community college after one semester because I could not afford it.",
  "I had to leave school when the money ran out.",
  "I was on medical leave for three months.",
  "My health got worse that winter."
]) {
  expect(`genuine disclosure is withheld: "${typed.slice(0, 46)}…"`, containsSensitiveDisclosure(typed), typed);
}

L();
L("=".repeat(78));
L(`Generator truth regression: ${passes} passed, ${fails} failed`);
L("=".repeat(78));
if (fails > 0) process.exit(1);
