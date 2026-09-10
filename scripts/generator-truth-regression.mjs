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
  "I have never closed the register on my own",
  "I have never written a report"
]) {
  expect(`self-declared gap withheld: "${gapText}"`, classifyEvidenceAdmissibility(gapText) !== "claim", classifyEvidenceAdmissibility(gapText));
}
// …while negating a BAD OUTCOME stays an accomplishment.
for (const achievement of ["I did not lose any data", "I never missed a deadline", "We did not have a security breach on the platform"]) {
  expect(`achievement stays a claim: "${achievement}"`, classifyEvidenceAdmissibility(achievement) === "claim", classifyEvidenceAdmissibility(achievement));
}

L();
L("=".repeat(78));
L(`Generator truth regression: ${passes} passed, ${fails} failed`);
L("=".repeat(78));
if (fails > 0) process.exit(1);
