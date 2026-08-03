// Truth-integrity regression.
//
// Every check here reproduces a defect that shipped, driving the REAL modules
// rather than re-implementing them. Each one failed before the truth-integrity
// recovery and must never fail again:
//
//   CF-P0-01  ordinary compliance/security phrasing was classified as a
//             self-declared gap, and the sanitizer — which runs on every state
//             READ — deleted the approved record, dropped its owning role, and
//             emptied the résumé Experience section built from it.
//   CF-P0-02  every role received the same evidence-id array, so the pack
//             generator printed the current job's duties and metrics under a
//             previous, unrelated employer, and the Defensibility Receipt
//             certified those bullets as "direct".
//   CF-P1-01  the early-win preview emitted a bullet the user never wrote,
//             under copy reading "Nothing here was invented".
//   CF-P1-04  a malformed regex meant a user's own edit was never recognised as
//             user-authored, so editing a bullet disabled export for the pack.
//
// Run directly:  node scripts/truth-integrity-regression.mjs

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

const { classifyEvidenceAdmissibility, sanitizeCareerDossier, sanitizeResumeForProfessionalUse } = load("src/lib/evidence-admissibility.ts");
const { emptyDossier, mergeIntakeIntoDossier, evidenceRecord, intakeFromDossier } = load("src/lib/dossier.ts");
const { generateResumePack, updatePackVariant } = load("src/lib/resume-pack.ts");
const { initialIntake } = load("src/lib/career-data.ts");
const { earlyWinBullets } = load("src/lib/early-win.ts");
const { deriveDefensibilityReceipt } = load("src/lib/defensibility.ts");
const { variantPlainText } = load("src/lib/pack-export.ts");

const NOW = "2026-08-03T12:00:00.000Z";
const L = (s = "") => console.log(s);
const H = (t) => { L(); L("=".repeat(78)); L(t); L("=".repeat(78)); };

let fails = 0;
let passes = 0;
function expect(label, ok, detail = "") {
  if (ok) { passes += 1; console.log(`PASS ${label}`); }
  else { fails += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

// ───────────────────────────────────────────────────────── CF-P0-01
H("CF-P0-01 — compliance phrasing must not destroy approved evidence");

const COMPLIANCE = [
  "Ensured contractors did not work without a valid permit",
  "Verified that unauthorized visitors did not have building access",
  "Documented incidents so auditors did not have to reconstruct the timeline",
];
for (const phrase of COMPLIANCE) {
  const c = classifyEvidenceAdmissibility(phrase);
  expect(`classified as claim, not gap: "${phrase.slice(0, 52)}…"  => ${c}`, c === "claim");
}
// A genuine self-reported gap must STILL be caught.
// A genuine self-report must still be withheld (gap or uncertainty — either way, not a claim).
const REAL_GAPS = ["I do not have leadership experience", "Did not manage a team", "Lacks formal certifications", "I have not managed a budget"];
for (const phrase of REAL_GAPS) {
  const c = classifyEvidenceAdmissibility(phrase);
  expect(`still withheld (not a claim): "${phrase}"  => ${c}`, c !== "claim");
}

const secId = "ev-sec-1";
const sec2Id = "ev-sec-2";
const secDossier = {
  ...emptyDossier(NOW),
  roles: [{
    id: "role-sec", title: "Security Supervisor", employer: "Meridian Facilities",
    start: "2019", end: "Present", responsibilities: COMPLIANCE.slice(0, 2), tools: ["Incident logs"],
    outcomes: [], evidenceIds: [secId, sec2Id], createdAt: NOW, updatedAt: NOW,
  }],
  evidence: [
    evidenceRecord("responsibility", COMPLIANCE[0], "manual", true, NOW),
    evidenceRecord("responsibility", COMPLIANCE[1], "manual", true, NOW),
  ].map((r, i) => ({ ...r, id: i === 0 ? secId : sec2Id })),
};
const sanitized = sanitizeCareerDossier(secDossier);
expect(`approved evidence survives sanitize (${sanitized.dossier.evidence.filter((e) => e.approved && !e.rejected).length} approved)`,
  sanitized.dossier.evidence.filter((e) => e.approved && !e.rejected).length === 2);
expect(`owning role survives sanitize (${sanitized.dossier.roles.length} roles)`, sanitized.dossier.roles.length === 1);
expect(`role keeps its responsibilities (${sanitized.dossier.roles[0]?.responsibilities.length ?? 0})`,
  (sanitized.dossier.roles[0]?.responsibilities.length ?? 0) === 2);
expect(`nothing quarantined (${sanitized.quarantinedEvidenceIds.length})`, sanitized.quarantinedEvidenceIds.length === 0);

const secResume = {
  summary: "Security Supervisor with permit-compliance and access-control responsibility.",
  coreSkills: ["Access control", "Incident reporting"],
  experience: [{ title: "Security Supervisor", company: "Meridian Facilities", time: "2019 - Present", bullets: COMPLIANCE.slice(0, 2), kind: "role" }],
  education: "", linkedinHeadline: "Security Supervisor", linkedinSummary: "",
};
const safeResume = sanitizeResumeForProfessionalUse(secResume);
expect(`Experience section survives export sanitize (${safeResume.experience.length} roles)`, safeResume.experience.length === 1);
expect(`bullets survive (${safeResume.experience[0]?.bullets.length ?? 0} of 2)`, (safeResume.experience[0]?.bullets.length ?? 0) === 2);

// ───────────────────────────────────────────────────────── CF-P0-02
H("CF-P0-02 — one employer's duties must never appear under another");

const twoJob = {
  ...initialIntake,
  fullName: "Jordan Reyes", email: "jordan@example.com", targetJobTitle: "IT Support Specialist",
  currentTitle: "Help Desk Technician", currentCompany: "Northwind IT", currentTime: "2024 - Present",
  previousTitle: "Security Guard", previousCompany: "Sentinel Group", previousTime: "2020 - 2024",
  tools: "Jira, Okta",
  responsibilities: "Troubleshot laptops\nReset passwords\nDocumented tickets",
  outcomes: "Cut average ticket resolution time in half",
  customersServed: "40 tickets a week",
  education: "Associate degree",
};
const twoJobDossier = mergeIntakeIntoDossier(emptyDossier(NOW), twoJob, "guided", true, "guided", NOW);
const roleById = Object.fromEntries(twoJobDossier.roles.map((r) => [r.title, r]));
const current = roleById["Help Desk Technician"];
const previous = roleById["Security Guard"];
L(`  roles: ${twoJobDossier.roles.map((r) => `${r.title}(${r.evidenceIds.length} ev)`).join(", ")}`);
const prevOwnEvidence = twoJobDossier.evidence.filter((e) => (previous?.evidenceIds ?? []).includes(e.id));
expect("previous role carries only its own heading record",
  prevOwnEvidence.length === 1 && prevOwnEvidence[0].kind === "role" && prevOwnEvidence[0].detail.includes("Sentinel Group"),
  `holds ${prevOwnEvidence.map((e) => `${e.kind}:${e.detail}`).join(", ")}`);
expect("current role carries the intake evidence", (current?.evidenceIds.length ?? 0) > 0);
expect("the two roles share no evidence id",
  !(previous?.evidenceIds ?? []).some((id) => (current?.evidenceIds ?? []).includes(id)));

const lanes = [{ id: "lane-0", title: "IT Support Specialist", status: "active", whyFit: "x", resumeAngle: "y", proof: [], gaps: [], keywords: ["Jira"], source: "library", createdAt: NOW }];
const twoJobPack = generateResumePack(twoJobDossier, lanes, NOW);
const atsVariant = twoJobPack.variants[0];
const printed = variantPlainText(twoJobDossier, atsVariant.resume, atsVariant.sectionOrder, atsVariant.kind);
const prevBlock = atsVariant.resume.experience.find((r) => r.company === "Sentinel Group");
L(`  exported experience rows: ${atsVariant.resume.experience.map((r) => `${r.title}@${r.company}[${r.bullets.length}]`).join(", ")}`);
if (prevBlock) prevBlock.bullets.forEach((b) => L(`    Sentinel Group bullet: ${b}`));
const LEAKED = ["Troubleshot laptops", "Reset passwords", "Documented tickets", "40 tickets a week", "Cut average ticket resolution"];
const leaks = LEAKED.filter((t) => (prevBlock?.bullets ?? []).some((b) => b.toLowerCase().includes(t.toLowerCase().slice(0, 18))));
expect(`no help-desk duty printed under Sentinel Group (leaks: ${leaks.length})`, leaks.length === 0, leaks.join(" | "));
const sentinelIdx = printed.indexOf("Sentinel Group");
const tailAfterSentinel = sentinelIdx >= 0 ? printed.slice(sentinelIdx, sentinelIdx + 400) : "";
expect("plain-text export shows no leaked duty after the Sentinel heading",
  !/Troubleshot|Reset passwords|Documented tickets/i.test(tailAfterSentinel));
// The honest outcome: an employer with no evidence of its own is OMITTED from
// the résumé rather than filled with another job's duties.
expect("unsupported employer is omitted, not fabricated", !prevBlock,
  prevBlock ? `Sentinel Group still rendered with ${prevBlock.bullets.length} bullets` : "");
expect("the supported employer keeps its own duties",
  (atsVariant.resume.experience.find((r) => r.company === "Northwind IT")?.bullets.length ?? 0) > 0);

// ───────────────────────────────────────────────────────── CF-P1-01
H("CF-P1-01 — early-win preview must invent nothing");

function roleDossierFrom(lines) {
  // Replicates src/app/profile/page.tsx addRole(): responsibilities are stored
  // BOTH on the role record and as approved responsibility evidence.
  const ev = lines.map((line, i) => ({ ...evidenceRecord("responsibility", line, "manual", true, NOW), id: `ev-${i}` }));
  return {
    ...emptyDossier(NOW),
    roles: [{
      id: "role-1", title: "Support Lead", employer: "Brightline", start: "2022", end: "Present",
      responsibilities: lines, tools: [], outcomes: [], evidenceIds: ev.map((e) => e.id), createdAt: NOW, updatedAt: NOW,
    }],
    evidence: ev,
  };
}

const CASES = [
  ["Trained six new support agents during onboarding"],
  ["Resolved customer issues for a regional territory", "Explained products to customers in plain language"],
  ["Resolved escalated billing disputes within one business day", "Resolved account access problems for enterprise clients"],
];
for (const lines of CASES) {
  const preview = earlyWinBullets(roleDossierFrom(lines));
  const bullets = preview?.bullets ?? [];
  L(`  typed(${lines.length}): ${JSON.stringify(lines)}`);
  L(`  shown(${bullets.length}): ${JSON.stringify(bullets)}`);
  const norm = (s) => s.toLowerCase().replace(/[.,;:]/g, "").trim();
  const approved = lines.map(norm);
  const unsupported = bullets.filter((b) => !approved.some((a) => a.includes(norm(b)) || norm(b).includes(a)));
  expect(`every shown bullet traces to typed input (${unsupported.length} unsupported)`, unsupported.length === 0, unsupported.join(" | "));
  expect(`no more bullets than the user typed (${bullets.length} <= ${lines.length})`, bullets.length <= lines.length);
  const firstWords = bullets.map((b) => b.split(" ")[0].toLowerCase());
  const typedFirst = lines.map((l) => l.split(" ")[0].toLowerCase());
  expect(`no opening verb was rewritten`, firstWords.every((w) => typedFirst.includes(w)),
    `shown openers ${JSON.stringify(firstWords)} vs typed ${JSON.stringify(typedFirst)}`);
}

// ───────────────────────────────────────────────────────── CF-P1-04
H("CF-P1-04 — a user's own edit must not disable export");

const editDossier = mergeIntakeIntoDossier(emptyDossier(NOW), {
  ...initialIntake, fullName: "Sam Ito", email: "sam@example.com", targetJobTitle: "Operations Coordinator",
  currentTitle: "Operations Associate", currentCompany: "Harbor Logistics", currentTime: "2021 - Present",
  tools: "Excel", responsibilities: "Coordinated inbound shipments\nMaintained carrier records",
  outcomes: "Reduced misrouted freight", education: "BA",
}, "guided", true, "guided", NOW);
const editLanes = [{ id: "lane-e", title: "Operations Coordinator", status: "active", whyFit: "x", resumeAngle: "y", proof: [], gaps: [], keywords: ["Excel"], source: "library", createdAt: NOW }];
const editPack = generateResumePack(editDossier, editLanes, NOW);
const before = deriveDefensibilityReceipt(editPack.variants[0], editDossier);
L(`  before edit: missingProvenance=${before.missingProvenance} status="${before.status}"`);
expect("clean pack has no missing provenance", before.missingProvenance === 0);

for (const editedPath of ["experience.0.bullets", "experience.0.title", "experience.0.company", "experience.0.time"]) {
  const v0 = editPack.variants[0];
  const edited = { ...v0.resume };
  if (editedPath.endsWith("bullets")) {
    edited.experience = edited.experience.map((r, i) => (i === 0 ? { ...r, bullets: [...r.bullets.slice(0, -1), "Coordinated inbound shipments across three carriers."] } : r));
  }
  const nextPack = updatePackVariant(editPack, v0.id, edited, NOW, [editedPath]);
  const after = deriveDefensibilityReceipt(nextPack.variants.find((v) => v.id === v0.id), editDossier);
  L(`  edited "${editedPath}": missingProvenance=${after.missingProvenance} status="${after.status}"`);
  expect(`export not blocked after editing ${editedPath}`, after.missingProvenance === 0,
    `missingProvenance became ${after.missingProvenance}`);
  expect(`receipt shows a human-recheck status for ${editedPath}`, /user-edited|recheck/i.test(after.status), after.status);
}

// ─────────────────────────────────────────── extra: duration token regex
H("EXTRA — duration verification regex (discovered while implementing)");
const durVariant = editPack.variants[0];
const durReceipt = deriveDefensibilityReceipt(durVariant, editDossier);
const hasYear = durVariant.resume.experience.some((r) => /(?:19|20)\d{2}/.test(r.time ?? ""));
L(`  a role time contains a 4-digit year: ${hasYear}`);
L(`  verifiedDurations=${durReceipt.verifiedDurations} unverifiedDurations=${durReceipt.unverifiedDurations}`);
expect("a dated role is counted as a duration claim", hasYear ? (durReceipt.verifiedDurations + durReceipt.unverifiedDurations) > 0 : true);

// ───────────────────────────────── legacy data already saved in localStorage
H("CF-P0-02 (legacy) — a dossier already saved with a shared evidence array");

// Dossiers written before the fix gave every role the SAME evidence ids. The
// structural ownership guard in resume-pack must repair those at generation
// time, without a migration and without guessing an attribution.
const sharedIds = twoJobDossier.evidence.filter((e) => e.kind !== "goal" && e.kind !== "role").map((e) => e.id);
const legacyDossier = {
  ...twoJobDossier,
  roles: twoJobDossier.roles.map((r) => ({ ...r, evidenceIds: [...sharedIds] })),
};
const legacyPack = generateResumePack(legacyDossier, lanes, NOW);
const legacyExp = legacyPack.variants[0].resume.experience;
L(`  legacy experience rows: ${legacyExp.map((r) => `${r.title}@${r.company}[${r.bullets.length}]`).join(", ") || "(none)"}`);
const legacySentinel = legacyExp.find((r) => r.company === "Sentinel Group");
expect("legacy shared-evidence dossier does not print duties under the wrong employer", !legacySentinel,
  legacySentinel ? `Sentinel Group rendered ${legacySentinel.bullets.length} bullets` : "");
const legacyCurrent = legacyExp.find((r) => r.company === "Northwind IT");
expect("legacy dossier still renders the employer that genuinely recorded the work",
  (legacyCurrent?.bullets.length ?? 0) > 0,
  "the role whose own responsibilities/outcomes corroborate the evidence must survive");

// ═════════════════ REVIEW ROUND 2 — defects found reviewing the first fix ═══
// Every check below failed against the first truth-integrity attempt. They stay
// here because that attempt passed its own tests: the fixtures had been written
// by the author of the fix and happened to match the shapes the fix handled.

H("T-1 — self-declared gaps must never become claims, whatever precedes them");
// The first fix anchored gap detection to sentence position, so any adverb in
// front turned a gap into an exportable claim — strictly worse than the bug it
// replaced, because the résumé then PRINTED the user's stated gap.
const MUST_WITHHOLD = [
  "Currently do not have leadership experience",
  "Honestly do not have any metrics for this",
  "Unfortunately did not manage anyone directly",
  "Right now do not have a degree",
  "So far have not led a team",
  "Truthfully do not own any certifications",
  "In that role did not manage people",
  "Generally do not track metrics",
  "Sadly did not measure results",
  "I have not managed a budget",
  "Did not manage a team",
  "Lacks formal certifications",
];
for (const phrase of MUST_WITHHOLD) {
  const category = classifyEvidenceAdmissibility(phrase);
  expect(`withheld: "${phrase}" => ${category}`, category !== "claim");
}
// …while ordinary achievements phrased with a negation stay usable. A third
// party doing something is not the candidate lacking something, and negating a
// BAD OUTCOME ("did not have a breach") is an accomplishment.
const MUST_REMAIN_USABLE = [
  "Ensured contractors did not work without a valid permit",
  "Verified that unauthorized visitors did not have building access",
  "Documented incidents so auditors did not have to reconstruct the timeline",
  "We did not have a single security breach in 18 months",
  "We did not have a late shipment during peak season",
  "We do not have turnover on the admin team since I rewrote onboarding",
  "We do not use paper logs anymore since I moved intake to the digital form",
  "Ran the fall-risk protocol. Did not have a patient fall on my unit in 14 months.",
  "Built the runbook so we did not have repeat outages",
  "Maintained a clean security record for 18 months",
];
for (const phrase of MUST_REMAIN_USABLE) {
  const category = classifyEvidenceAdmissibility(phrase);
  expect(`usable: "${phrase.slice(0, 58)}…" => ${category}`, category === "claim");
}

H("T-3 — sanitize must be idempotent and reversible, never a persisted mutation");
const gapRecord = evidenceRecord("responsibility", "Currently do not have leadership experience", "manual", true, NOW);
const pass1 = sanitizeCareerDossier({ ...emptyDossier(NOW), evidence: [gapRecord] });
const pass2 = sanitizeCareerDossier(pass1.dossier);
expect("the user's record is returned byte-identical", JSON.stringify(pass1.dossier.evidence[0]) === JSON.stringify(gapRecord));
expect("sanitize is a fixed point (no second persisted state)", JSON.stringify(pass2.dossier) === JSON.stringify(pass1.dossier));
expect("the quarantine names a reason for the UI", Boolean(pass1.quarantined[0]?.reason));
expect("quarantined evidence is excluded from approvedClaims", !pass1.dossier.approvedClaims.includes(gapRecord.detail));
// Reversibility: correcting the wording must bring the record back.
const corrected = { ...pass1.dossier.evidence[0], detail: "Led the weekly dispatch stand-up for six drivers" };
const repaired = sanitizeCareerDossier({ ...pass1.dossier, evidence: [corrected] });
expect("correcting the wording restores the record as usable evidence",
  repaired.quarantinedEvidenceIds.length === 0 && repaired.dossier.approvedClaims.includes(corrected.detail));

H("T-2 — the polluted job-change flow must not cross-attribute");
// intakeFromDossier prefills the intake form from the GLOBAL dossier pool, so
// re-running guided setup after a job change records the OLD duties against the
// NEW role. Text similarity therefore cannot be an ownership signal.
const session1 = mergeIntakeIntoDossier(emptyDossier(NOW), {
  ...initialIntake, fullName: "Jordan Reyes", email: "j@e.com", targetJobTitle: "IT Support Specialist",
  currentTitle: "Help Desk Technician", currentCompany: "Northwind IT", currentTime: "2024 - Present",
  tools: "Okta", responsibilities: "Troubleshot laptops for the Northwind service desk\nReset passwords in Okta",
  outcomes: "Cut average ticket resolution time in half", education: "AA",
}, "guided", true, "g", NOW);
// The user changes jobs and reopens /resume-builder: the form is prefilled from
// the dossier, and they type the new employer over the old one.
const prefilled = intakeFromDossier(session1, "Operations Coordinator");
const session2 = mergeIntakeIntoDossier(session1, {
  ...prefilled, currentTitle: "Operations Coordinator", currentCompany: "Harbor Logistics", currentTime: "2026 - Present",
  previousTitle: "Help Desk Technician", previousCompany: "Northwind IT", previousTime: "2024 - 2026",
}, "guided", true, "g", NOW);
const jobChangeLanes = [{ id: "lane-jc", title: "Operations Coordinator", status: "active", whyFit: "x", resumeAngle: "y", proof: [], gaps: [], keywords: [], source: "library", createdAt: NOW }];
const jobChangePack = generateResumePack(session2, jobChangeLanes, NOW);
const harbor = jobChangePack.variants[0].resume.experience.find((r) => r.company === "Harbor Logistics");
const northwind = jobChangePack.variants[0].resume.experience.find((r) => r.company === "Northwind IT");
L(`  rendered: ${jobChangePack.variants[0].resume.experience.map((r) => `${r.title}@${r.company}[${r.bullets.length}]`).join(", ") || "(none)"}`);
expect("the new employer does not inherit the previous job's duties",
  !(harbor?.bullets ?? []).some((b) => /Northwind service desk|Okta/i.test(b)),
  JSON.stringify(harbor?.bullets));
expect("evidence carries an explicit owning roleId",
  session2.evidence.some((item) => typeof item.roleId === "string" && item.roleId.length > 0));
expect("no evidence record is owned by two roles",
  new Set(session2.evidence.filter((e) => e.roleId).map((e) => e.id)).size === session2.evidence.filter((e) => e.roleId).length);
void northwind;

H("T-4 — corroboration, projects, and the recovery path");
// Two legitimate employers recording the SAME responsibility must each keep
// their own record: identity includes ownership, so they do not collapse.
const twoOwners = ["role-alpha", "role-beta"].map((rid) =>
  evidenceRecord("responsibility", "Managed inbound shipments and carrier handoffs", "manual", true, NOW, { roleId: rid }));
expect("identical text at two employers yields two distinct owned records",
  twoOwners[0].id !== twoOwners[1].id && twoOwners[0].roleId !== twoOwners[1].roleId);

// A short corroborating fragment must not vouch for a longer foreign fact.
const legacyShared = { ...evidenceRecord("responsibility", "Troubleshot Northwind laptops for the customer service floor", "manual", true, NOW), id: "ev-legacy" };
const legacyRoles = [
  { id: "r-now", title: "Help Desk Technician", employer: "Northwind IT", startDate: "2024", endDate: "", current: true, responsibilities: ["Troubleshot Northwind laptops for the customer service floor"], tools: [], outcomes: [], evidenceIds: ["ev-legacy"] },
  { id: "r-old", title: "Security Guard", employer: "Sentinel Group", startDate: "2020", endDate: "2024", current: false, responsibilities: ["customer service"], tools: [], outcomes: [], evidenceIds: ["ev-legacy"] },
];
const legacyPack2 = generateResumePack({ ...emptyDossier(NOW), roles: legacyRoles, evidence: [legacyShared], approvedClaims: [legacyShared.detail] }, jobChangeLanes, NOW);
const sentinel2 = legacyPack2.variants[0].resume.experience.find((r) => r.company === "Sentinel Group");
expect("a two-word fragment cannot corroborate a foreign fact", !sentinel2,
  sentinel2 ? `Sentinel Group prints ${JSON.stringify(sentinel2.bullets)}` : "");

// A project must not reprint an employer's owned facts.
const indieIntake = { ...initialIntake, fullName: "Sam Ito", email: "s@e.com", targetJobTitle: "Operations Coordinator",
  currentTitle: "Operations Associate", currentCompany: "Harbor Logistics", currentTime: "2021 - Present",
  responsibilities: "Coordinated inbound shipments", outcomes: "Cut average ticket resolution time in half",
  independentWorkType: "Dog walking side business", education: "BA" };
const indieDossier = mergeIntakeIntoDossier(emptyDossier(NOW), indieIntake, "guided", true, "g", NOW);
const indiePack = generateResumePack(indieDossier, jobChangeLanes, NOW);
const indieProject = indiePack.variants[0].resume.experience.find((r) => r.kind === "project");
L(`  project bullets: ${JSON.stringify(indieProject?.bullets ?? null)}`);
expect("an independent-work project does not reprint the employer's facts",
  !(indieProject?.bullets ?? []).some((b) => /Coordinated inbound shipments|ticket resolution/i.test(b)),
  JSON.stringify(indieProject?.bullets));

// ═══ T-5 — admissibility must be checked by every VISIBLE surface, not just export
H("T-5 — a quarantined record must reach no surface, on screen or in a file");

// The defect this covers: sanitization stopped rewriting `kind` (correctly —
// that rewrite was irreversible), and two consumers were still using `kind` as
// a shortcut for admissibility. Contaminants stored under innocuous kinds then
// entered the in-memory résumé, its evidenceReferences and the pack receipt,
// and rendered in the /versions editor and evidence drawer. The exported file
// stayed clean because sanitizeResumeForProfessionalUse catches it at the export
// boundary — so an export-only assertion would have passed while the user was
// looking at the contamination on screen. Every surface is checked here.
const CONTAMINANTS = [
  ["proof", "No reliable numerical performance metrics", "No reliable numerical"],
  ["proof", "Managed vendor contracts worth $2M annually until I was laid off in June 2026", "laid off"],
  ["metric", "I don't know my exact ticket numbers", "I don't know"],
  ["responsibility", "Target roles: Product Operations Specialist", "Target roles:"],
  ["responsibility", "Currently do not have leadership experience", "do not have leadership"],
];
const CLEAN_FACT = "Resolved customer escalations and documented the outcome";
const contaminatedEvidence = [
  ...CONTAMINANTS.map(([kind, detail]) => ({ ...evidenceRecord(kind, detail, "manual", true, NOW), roleId: "role-contam" })),
  { ...evidenceRecord("responsibility", CLEAN_FACT, "manual", true, NOW), roleId: "role-contam" },
];
const contaminatedDossier = {
  ...emptyDossier(NOW),
  identity: { ...emptyDossier(NOW).identity, fullName: "Dana Ruiz", email: "dana@example.com" },
  roles: [{
    id: "role-contam", title: "Operations Associate", employer: "Harbor Logistics",
    startDate: "2021", endDate: "", current: true,
    responsibilities: [...CONTAMINANTS.map(([, detail]) => detail), CLEAN_FACT],
    tools: [], outcomes: [], evidenceIds: contaminatedEvidence.map((item) => item.id),
  }],
  evidence: contaminatedEvidence,
  approvedClaims: [...CONTAMINANTS.map(([, detail]) => detail), CLEAN_FACT],
  proofPoints: [...CONTAMINANTS.map(([, detail]) => detail), CLEAN_FACT],
};
const contamLane = [{ id: "lane-contam", title: "Operations Coordinator", status: "active", whyFit: "x", resumeAngle: "y", proof: [], gaps: [], keywords: [], source: "library", createdAt: NOW }];
// Exactly what the app does on every read and write.
const liveDossier = sanitizeCareerDossier(contaminatedDossier).dossier;
const contamPack = generateResumePack(liveDossier, contamLane, NOW);
const contamVariant = contamPack.variants[0];
const SURFACES = {
  "in-memory résumé (rendered in the /versions editor)": JSON.stringify(contamPack.variants.map((v) => v.resume)),
  "evidence references (rendered in the evidence drawer)": JSON.stringify(contamPack.variants.map((v) => v.evidenceReferences)),
  "pack receipt": JSON.stringify(contamPack.receipt ?? {}),
  "exported plain text": variantPlainText(liveDossier, contamVariant.resume, contamVariant.sectionOrder, contamVariant.kind),
  "early-win preview": JSON.stringify(earlyWinBullets(liveDossier)?.bullets ?? []),
};
for (const [surface, text] of Object.entries(SURFACES)) {
  const found = CONTAMINANTS.map(([, , marker]) => marker).filter((marker) => text.toLowerCase().includes(marker.toLowerCase()));
  expect(`no contaminant on: ${surface}`, found.length === 0, found.join(", "));
}
expect("the clean fact still reaches the résumé",
  SURFACES["exported plain text"].includes(CLEAN_FACT.slice(0, 30)));

// …and the fix must not re-create self-sealing quarantine: correcting the
// wording has to make the record usable again all the way through to output,
// not merely re-classify it in isolation.
const repairedEvidence = liveDossier.evidence.map((item) =>
  item.detail === "Currently do not have leadership experience"
    ? { ...item, detail: "Led the weekly dispatch stand-up for six drivers" }
    : item);
const repairedLive = sanitizeCareerDossier({
  ...liveDossier,
  evidence: repairedEvidence,
  roles: liveDossier.roles.map((role) => ({
    ...role,
    responsibilities: role.responsibilities.map((line) =>
      line === "Currently do not have leadership experience" ? "Led the weekly dispatch stand-up for six drivers" : line),
  })),
  approvedClaims: [...liveDossier.approvedClaims, "Led the weekly dispatch stand-up for six drivers"],
}).dossier;
const repairedPack = generateResumePack(repairedLive, contamLane, NOW);
const repairedText = variantPlainText(repairedLive, repairedPack.variants[0].resume, repairedPack.variants[0].sectionOrder, repairedPack.variants[0].kind);
expect("corrected wording becomes usable output again (no self-sealing quarantine)",
  repairedText.includes("Led the weekly dispatch stand-up"),
  repairedText.slice(0, 220));

// ═══ T-6 — the polish layer must not invent, escalate, or alter the user's words
H("T-6 — /resume-builder output asserts only what the user wrote (issue #53)");

// generateResumePackage ends in polishResumePackage, so everything below reaches
// the résumé a user prints from /resume-builder and /versions/view.
const { generateResumePackage } = load("src/lib/generator.ts");
const builderIntake = (over) => ({
  ...initialIntake, fullName: "Sam Ito", email: "s@e.com", education: "High school diploma",
  currentTitle: "Store Associate", currentCompany: "Bellview Market", currentTime: "2022 - Present", ...over,
});
const bulletsFor = (over) =>
  generateResumePackage(builderIntake(over)).experience.flatMap((role) => role.bullets);

// 1. A thin phrase must not be expanded into activities the user never named.
const expanded = bulletsFor({ responsibilities: "sorted the mail, answered phones" });
L(`  typed "sorted the mail, answered phones" -> ${JSON.stringify(expanded)}`);
expect("a thin phrase is not expanded into invented activities",
  !expanded.some((b) => /assisting customers|routing requests|inbound calls/i.test(b)),
  JSON.stringify(expanded));

// 2. The user's verb must not be swapped for a stronger one.
const escalated = bulletsFor({ responsibilities: "handled the returns desk on weekends\nresponsible for the opening float" });
L(`  typed "handled …" / "responsible for …" -> ${JSON.stringify(escalated)}`);
expect("a user's verb is not escalated to 'Managed'",
  !escalated.some((b) => /^Managed\b/.test(b)),
  JSON.stringify(escalated));

// 3. Distinct bullets sharing an opener keep their own verb.
const repeated = bulletsFor({
  currentTitle: "Site Safety Coordinator",
  responsibilities: "Maintained the county permit binder for four job sites\nMaintained the safety incident log for four job sites",
});
L(`  three "Maintained …" lines -> ${JSON.stringify(repeated)}`);
expect("an opening verb is never substituted from a global action-verb list",
  !repeated.some((b) => /^(Built|Developed|Created|Implemented)\b/.test(b)),
  JSON.stringify(repeated));

// 4. Word-altering rules must leave the user's wording intact.
const pronoun = bulletsFor({ responsibilities: "Checked every shipment before it left the dock" });
expect('the pronoun "it" is not rewritten to the acronym "IT"',
  pronoun.some((b) => /before it left the dock/.test(b)) && !pronoun.some((b) => /before IT left/.test(b)),
  JSON.stringify(pronoun));

const placeName = bulletsFor({ responsibilities: "Supported the Walla Walla distribution center inventory reconciliation" });
expect("a genuine repeated word is not deleted (Walla Walla survives)",
  placeName.some((b) => /walla walla/i.test(b)),
  JSON.stringify(placeName));

const article = bulletsFor({ responsibilities: "Trained a user group on the new returns policy" });
expect('"a user group" is not corrupted to "an user group"',
  !article.some((b) => /\ban user\b/i.test(b)),
  JSON.stringify(article));

// 5. A single evidenced token may authorise at most a clause about that token.
//    "helped customers" must never acquire purchases, returns, transactions or
//    accuracy — the expansion this issue exists to remove.
const thin = bulletsFor({ responsibilities: "helped customers" });
L(`  typed "helped customers" -> ${JSON.stringify(thin)}`);
for (const invented of ["purchases", "returns", "transactions accurate", "keeping transactions"]) {
  expect(`"helped customers" does not acquire "${invented}"`,
    !thin.some((b) => b.toLowerCase().includes(invented)),
    JSON.stringify(thin));
}
// …and the same holds in a second occupation, so the fix is not customer-service specific.
const thinWarehouse = bulletsFor({
  currentTitle: "Warehouse Associate", currentCompany: "Cedar Logistics",
  responsibilities: "moved boxes",
});
L(`  typed "moved boxes" (warehouse) -> ${JSON.stringify(thinWarehouse)}`);
for (const invented of ["scanning", "picking", "packing", "forklift", "safety procedures"]) {
  expect(`"moved boxes" does not acquire "${invented}"`,
    !thinWarehouse.some((b) => b.toLowerCase().includes(invented)),
    JSON.stringify(thinWarehouse));
}

// 5b. Multi-occupation: a sparse line must survive unchanged, and must not
//     acquire any activity the occupation bank could have supplied.
const OCCUPATION_CASES = [
  { occupation: "bartender", title: "Bartender", company: "The Anchor", typed: "poured drinks",
    forbidden: ["payments", "cash", "tabs", "register", "policy-aware", "stocked", "organized"] },
  { occupation: "security", title: "Security Officer", company: "Meridian Facilities", typed: "walked the perimeter",
    forbidden: ["access points", "visitor flow", "camera feeds", "incidents", "shift notes", "reliable coverage"] },
  { occupation: "caregiver", title: "Home Health Aide", company: "Brightpath Care", typed: "drove clients to appointments",
    forbidden: ["personal care", "mobility", "care notes", "reminders", "safety procedures", "calm communication"] },
  { occupation: "construction", title: "Construction Laborer", company: "Rowan Builders", typed: "carried lumber",
    forbidden: ["PPE", "equipment", "safety procedures", "housekeeping", "next steps", "material needs"] },
  { occupation: "receptionist", title: "Front Desk Receptionist", company: "Halden Clinic", typed: "answered the phone",
    forbidden: ["welcoming visitors", "routing requests", "scheduling", "records", "appointments", "handoffs"] },
  { occupation: "janitor", title: "Custodian", company: "Northline Schools", typed: "mopped the halls",
    forbidden: ["restocking supplies", "equipment", "basic tools", "broken fixtures", "supply needs", "safety concerns"] },
];
for (const scenario of OCCUPATION_CASES) {
  const produced = bulletsFor({ currentTitle: scenario.title, currentCompany: scenario.company, responsibilities: scenario.typed });
  L(`  [${scenario.occupation}] typed "${scenario.typed}" -> ${JSON.stringify(produced)}`);
  const leaked = scenario.forbidden.filter((phrase) =>
    produced.some((b) => b.toLowerCase().includes(phrase.toLowerCase())));
  expect(`[${scenario.occupation}] a sparse line acquires no unevidenced activity`,
    leaked.length === 0, leaked.join(", "));
  // Criterion: sparse user wording is PRESERVED, not silently dropped.
  const head = scenario.typed.split(" ")[0].toLowerCase();
  expect(`[${scenario.occupation}] the user's own wording survives`,
    produced.some((b) => b.toLowerCase().includes(head)),
    JSON.stringify(produced));
}

// 5b-ii. Employer NAMES must not ground activity either — an identity is not
//        evidence of work. "Corner Kitchen" once grounded a coworkers claim and
//        "Brightpath Care" a "patient support" strength.
for (const company of ["Sanitation Solutions LLC", "Safety First Staffing", "Accurate Inventory Co", "Customer Care Partners", "Corner Kitchen", "Brightpath Care"]) {
  const pack = generateResumePackage(builderIntake({ currentTitle: "Line Cook", currentCompany: company, responsibilities: "" }));
  const surfaces = [...pack.experience.flatMap((r) => r.bullets), ...pack.coreSkills, pack.summary];
  expect(`employer "${company}" grounds no claim`,
    pack.experience.flatMap((r) => r.bullets).length === 0 && pack.coreSkills.length === 0 &&
      !/strengths the candidate reports/i.test(pack.summary),
    JSON.stringify(surfaces));
}

// 5b-iii. Restatement suppression is REVERTED (independent review of 0eeb3f2:
//         it deleted a scope metric along with the bullet, and unrelated user
//         lines suppressed each other through global bag-of-words overlap).
//         Duplicate truthful wording is a polish problem; deleting a supported
//         metric is a truth failure. So the contract here is narrower: the
//         user's own wording must survive, and nothing unsupported may appear.
//         A template that repeats the user is TOLERATED until suppression is
//         rebuilt on per-bullet structured evidence dependencies.
for (const [title, typed, forbidden] of [
  ["Bartender", "poured drinks", /purchases|returns|high-volume|payments|tabs/i],
  ["Construction Laborer", "carried lumber", /PPE|safety procedures|next steps|equipment/i],
  ["Home Health Aide", "drove clients to appointments", /personal care|meals|mobility|care procedures/i],
]) {
  const out = bulletsFor({ currentTitle: title, currentCompany: "Co", responsibilities: typed });
  L(`  [reverted-suppression] "${typed}" -> ${JSON.stringify(out)}`);
  expect(`"${typed}" produces no unsupported claim`, !out.some((b) => forbidden.test(b)), JSON.stringify(out));
  expect(`"${typed}" survives in the user's own words`,
    out.some((b) => b.toLowerCase().includes(typed.split(" ")[0].toLowerCase())), JSON.stringify(out));
}
// A metric the user supplied must never be lost — the defect that forced the revert.
const metricOut = bulletsFor({
  currentTitle: "Warehouse Associate", currentCompany: "Accurate Fulfillment Co",
  responsibilities: "I picked orders and packed orders.", reportsCreated: "12"
});
L(`  [metric-survival] -> ${JSON.stringify(metricOut)}`);
expect("a supplied metric is not deleted from the package",
  metricOut.join(" ").includes("12"), JSON.stringify(metricOut));

// Unrelated user lines must not suppress a separately grounded claim.
const unrelatedOut = bulletsFor({
  currentTitle: "Bartender", currentCompany: "Corner Tavern",
  responsibilities: "I stay calm with upset guests.\nThe bar enforces a strict dress code policy."
});
L(`  [no-cross-suppression] -> ${JSON.stringify(unrelatedOut)}`);
expect("a grounded claim is not suppressed by unrelated user lines",
  unrelatedOut.length >= 2, JSON.stringify(unrelatedOut));

// 5b-iv. Sparse user wording must survive EXACTLY, apart from safe
//        capitalization and punctuation. Two defects made this necessary:
//        composeUserBullets classified any verb outside a closed whitelist as a
//        noun label and wrapped it in an invented lead ("Mopped." ->
//        "Supported mopped."), and it drew from buildResponsibilityList, which
//        also carries derived labels, so a typed line was joined with template
//        vocabulary ("Mopped." -> "Mopped and cleaning standards.").
//
//        These assert EXACT output. The earlier harness asserted only that the
//        output CONTAINED the typed word, and "Supported mopped." contains
//        "mopped" — so it certified the distortion as preservation across every
//        probe. Substring assertions do not test preservation.
for (const typed of ["Mopped.", "Poured drinks.", "Wiped tables.", "Swept the floors.",
                     "Dusted shelves.", "Vacuumed the lobby.", "Checked labels.", "Carried lumber."]) {
  const out = bulletsFor({ currentTitle: "Custodian", currentCompany: "Northline Schools", responsibilities: typed });
  expect(`sparse line survives exactly: ${JSON.stringify(typed)}`, out.includes(typed), JSON.stringify(out));
  expect(`no invented lead on ${JSON.stringify(typed)}`,
    !out.some((b) => /^Supported /.test(b) && b.toLowerCase().includes(typed.toLowerCase().replace(/\.$/, ""))),
    JSON.stringify(out));
}

// 5c. Occupation and title ALONE must authorize zero factual bullets.
for (const scenario of OCCUPATION_CASES) {
  const titleOnly = bulletsFor({ currentTitle: scenario.title, currentCompany: scenario.company, responsibilities: "" });
  L(`  [${scenario.occupation}] title only -> ${JSON.stringify(titleOnly)}`);
  expect(`[${scenario.occupation}] title and occupation alone produce no factual bullet`,
    titleOnly.length === 0, JSON.stringify(titleOnly));
}

// 5d. A competency label needs evidence of the competency, not of the setting.
expect('"busy" alone does not authorise a time-management claim',
  !bulletsFor({ responsibilities: "worked busy shifts" }).some((b) => /time management/i.test(b)));
expect('"checked labels" alone does not authorise an attention-to-detail claim',
  !bulletsFor({ responsibilities: "checked labels on boxes" }).some((b) => /attention to detail/i.test(b)));

// 6. A canned bullet may not assert personal qualities with nothing behind them.
const ungated = bulletsFor({
  currentTitle: "Security Officer", currentCompany: "Meridian Facilities",
  responsibilities: "Walked the perimeter each hour",
});
L(`  security title + one line -> ${JSON.stringify(ungated)}`);
expect("no ungated reliability / attention-to-detail claim is emitted",
  !ungated.some((b) => /reliable coverage|attention to detail|steady job site progress|shared spaces ready/i.test(b)),
  JSON.stringify(ungated));

L();
L("=".repeat(78));
L(`Truth integrity regression: ${passes} passed, ${fails} failed`);
L("=".repeat(78));
if (fails > 0) process.exit(1);
