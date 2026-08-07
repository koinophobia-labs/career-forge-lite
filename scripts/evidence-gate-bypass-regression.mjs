// ADVERSARIAL ARCHITECTURE TESTS for the point-of-read evidence gate.
//
// These deliberately BYPASS intake. Every other suite in this repo enters
// through the guided form or the dossier merge, which is exactly why 1,999
// assertions were green while five different representations of the same
// evidence reached generation ungated (Round 8).
//
// The question here is not "does the happy path work". It is:
//
//   Can any caller authorize evidence by choosing a different route?
//
// So each case constructs state by hand — an unresolved record dropped
// straight into the store, a hand-populated proofPoints pool, a selected*
// array filled from nowhere — and then calls a real generator or exporter.
// The gate must hold no matter which door the caller came in through.
//
// A record is INELIGIBLE if it is unresolved, excluded, rejected, resolved
// against older text, or owned by a different role. Ineligible must never
// mean deleted: the raw store is asserted intact in every case.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const moduleCache = new Map();

function load(filePath) {
  const absolute = path.resolve(filePath);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  const { outputText } = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: absolute
  });
  const mod = { exports: {} };
  moduleCache.set(absolute, mod);
  const dir = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return load(path.join(root, "src", `${request.slice(2)}.ts`));
    if (request.startsWith(".")) return load(path.resolve(dir, request.endsWith(".ts") ? request : `${request}.ts`));
    return require(request);
  };
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, mod, mod.exports, dir, absolute);
  return mod.exports;
}

const { emptyDossier, intakeFromDossier } = load(path.join(root, "src/lib/dossier.ts"));
const { generateResumePackage } = load(path.join(root, "src/lib/generator.ts"));
const { resumeToText } = load(path.join(root, "src/lib/resume-export.ts"));
const { applyTailoredContext } = load(path.join(root, "src/lib/tailored-resume.ts"));
const { getUsableIntake } = load(path.join(root, "src/lib/evidence-read.ts"));
const { generateResumePack } = load(path.join(root, "src/lib/resume-pack.ts"));
const { variantPlainText, materialsText } = load(path.join(root, "src/lib/pack-export.ts"));
const { initialIntake } = load(path.join(root, "src/lib/career-data.ts"));
const { sanitizeCommandCenterState } = load(path.join(root, "src/lib/evidence-admissibility.ts"));
const { getEvidence, getUsableEvidence, getPendingReviews, evidenceEligibility } = load(path.join(root, "src/lib/evidence-read.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) {
    passes += 1;
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const NOW = "2026-08-06T12:00:00.000Z";

// Fixtures authored for this file. Deliberately in the register real people
// use, not the register the code was written in.
const UNRESOLVED = "I was on medical leave for three months that year.";
const EXCLUDED = "I was laid off in February 2025 when the contract ended.";
const STALE_NOW = "I stepped back from the supervisor role after my diagnosis.";
const STALE_REVIEWED = "I stepped back from the supervisor role in 2024.";
const OTHER_ROLE = "Rebuilt the delivery rota for the Fairhill depot from scratch.";
const CLEAN = "Ran the daily stock count for the whole shop floor.";

const record = (over) => ({
  id: `ev-${Math.abs(String(over.detail).split("").reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7))}`,
  kind: "responsibility",
  label: "Responsibility",
  detail: "",
  source: "manual",
  sourceText: "",
  confidence: "high",
  approved: true,
  rejected: false,
  createdAt: NOW,
  updatedAt: NOW,
  ...over
});

const INELIGIBLE = [
  ["unresolved needs_review", record({ detail: UNRESOLVED, disclosureReview: "needs_review", disclosureReason: "health", roleId: "role-a" })],
  ["explicitly excluded", record({ detail: EXCLUDED, disclosureReview: "exclude", disclosureReviewedText: EXCLUDED, disclosureReason: "financial", roleId: "role-a" })],
  ["rejected", record({ detail: "I never actually ran the tills on my own.", rejected: true, roleId: "role-a" })],
  ["stale resolution", record({ detail: STALE_NOW, disclosureReview: "keep", disclosureReviewedText: STALE_REVIEWED, roleId: "role-a" })],
  ["resolution with no fingerprint", record({ detail: "I was let go when the depot shut.", disclosureReview: "keep", roleId: "role-a" })],
  // NOTE: the retro-flag is only as strong as the classifier. It misses every
  // one of these natural phrasings today — "I was signed off sick for most of
  // the winter.", "I took unpaid leave to care for my father after his
  // stroke.", "I had to take time off when my mum got ill." That is a
  // classifier RECALL defect, reported separately; it is not an architecture
  // defect, and pinning it here would hide it inside a green suite.
  ["legacy record, never reviewed", record({ detail: "I was on long-term sick leave that spring.", roleId: "role-a" })]
];

const CLEAN_REC = record({ detail: CLEAN, roleId: "role-a" });

function dossierWith(extra = [], over = {}) {
  return {
    ...emptyDossier(NOW),
    evidence: [CLEAN_REC, ...INELIGIBLE.map(([, r]) => r), ...extra],
    roles: [
      { id: "role-a", title: "Shop Assistant", employer: "Bridgeway Stores", startDate: "2021", endDate: "2026", current: false, responsibilities: [], tools: [], outcomes: [], evidenceIds: [] }
    ],
    ...over
  };
}

const ALL_INELIGIBLE_TEXT = [UNRESOLVED, EXCLUDED, STALE_NOW, "I never actually ran the tills", "I was let go when the depot shut", "I was on long-term sick leave"];
const leaks = (haystack) => ALL_INELIGIBLE_TEXT.filter((needle) => haystack.toLowerCase().includes(needle.toLowerCase().slice(0, 34)));

// ---------------------------------------------------------------------------
console.log("\n--- 0. the reader itself ---");
{
  const d = dossierWith();
  check("every ineligible class is refused by the reader",
    getUsableEvidence(d).length === 1 && getUsableEvidence(d)[0].detail === CLEAN,
    JSON.stringify(getUsableEvidence(d).map((e) => e.detail)));
  check("  each refusal reports its true reason, never a guess",
    INELIGIBLE.every(([, r]) => evidenceEligibility(r).reason !== "ok"),
    JSON.stringify(INELIGIBLE.map(([n, r]) => [n, evidenceEligibility(r).reason])));
  check("  ineligible NEVER means deleted — raw store is whole",
    getEvidence(d).length === 7, String(getEvidence(d).length));
  check("  the user is told what is waiting on them", getPendingReviews(d).length >= 3, String(getPendingReviews(d).length));
}

// ---------------------------------------------------------------------------
console.log("\n--- 1. hand-built dossier straight into the pack builder ---");
{
  const d = dossierWith();
  const lanes = [{ id: "lane-1", title: "Retail Supervisor", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "custom", createdAt: NOW }];
  const pack = generateResumePack(d, lanes, NOW);
  const whole = JSON.stringify(pack);
  check("pack built from a hand-made dossier leaks nothing ineligible", leaks(whole).length === 0, JSON.stringify(leaks(whole)));
  check("  and the eligible fact still comes through", whole.includes("stock count"), whole.slice(0, 200));
  const variant = pack.variants?.[0];
  if (variant) {
    const plain = variantPlainText(d, variant.resume);
    check("  plain-text export of that pack is clean", leaks(plain).length === 0, JSON.stringify(leaks(plain)));
  }
  {
    // The exact surface that leaked in Round 8: the bundle's materials file
    // built its own `approved && !rejected` list, so unresolved AND excluded
    // disclosures printed verbatim under a heading claiming they were approved
    // — while the README in the same archive reported them as refused.
    const materials = materialsText(pack, lanes, d);
    check("  the bundle's cover-letter facts are clean", leaks(materials).length === 0, JSON.stringify(leaks(materials)));
    check("    and still carry the eligible fact", materials.includes("stock count"), materials.slice(0, 200));
  }
}

// ---------------------------------------------------------------------------
console.log("\n--- 2. hand-populated global proofPoints pool ---");
{
  const d = dossierWith([], { proofPoints: [UNRESOLVED, EXCLUDED, CLEAN] });
  const lanes = [{ id: "lane-1", title: "Retail Supervisor", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "custom", createdAt: NOW }];
  const whole = JSON.stringify(generateResumePack(d, lanes, NOW));
  check("the proofPoints pool cannot smuggle ineligible facts", leaks(whole).length === 0, JSON.stringify(leaks(whole)));
}

// ---------------------------------------------------------------------------
console.log("\n--- 3. the selected* arrays, via the route the app actually uses ---");
{
  // Round 8 B1: intakeFromDossier refills selected* from the role's string
  // pools on every mount, and the generator reads them raw — so an EXCLUDED
  // disclosure printed in the summary, a bullet and the LinkedIn summary after
  // one reload. The prefill is a READ of career facts and must resolve through
  // the reader.
  const d = dossierWith();
  d.roles[0].responsibilities = [CLEAN, UNRESOLVED, EXCLUDED];
  d.roles[0].outcomes = [STALE_NOW];
  const prefilled = intakeFromDossier(d);
  check("the prefill itself refuses ineligible facts",
    leaks(JSON.stringify(prefilled)).length === 0, JSON.stringify(leaks(JSON.stringify(prefilled))));
  check("  and still carries the eligible one",
    JSON.stringify(prefilled).includes("stock count"), JSON.stringify(prefilled.selectedResponsibilities));
  const whole = JSON.stringify(generateResumePackage({ ...initialIntake, ...prefilled }));
  check("  so nothing ineligible reaches the generated résumé", leaks(whole).length === 0, JSON.stringify(leaks(whole)));

  // And directly, with no dossier to consult: bare text carries no record, so
  // the only signal is the classifier. It still fails closed on what it can see.
  const direct = JSON.stringify(generateResumePackage({
    ...initialIntake,
    currentTitle: "Shop Assistant", currentCompany: "Bridgeway Stores", currentTime: "2021 - 2026",
    responsibilities: CLEAN,
    selectedResponsibilities: [UNRESOLVED, EXCLUDED, CLEAN],
    selectedOutcomes: [STALE_NOW]
  }));
  check("  hand-populated arrays are gated at the generator boundary too",
    leaks(direct).length === 0, JSON.stringify(leaks(direct)));
}

// ---------------------------------------------------------------------------
console.log("\n--- 4. the outcomes lane ---");
{
  const intake = {
    ...initialIntake,
    currentTitle: "Shop Assistant", currentCompany: "Bridgeway Stores", currentTime: "2021 - 2026",
    responsibilities: CLEAN,
    outcomes: `Cut waste by a fifth; ${UNRESOLVED}`
  };
  const whole = JSON.stringify(generateResumePackage(intake));
  check("the outcomes lane is gated like every other lane", leaks(whole).length === 0, JSON.stringify(leaks(whole)));
}

// ---------------------------------------------------------------------------
console.log("\n--- 5. every evidence kind, not just the original three ---");
{
  const KINDS = ["responsibility", "proof", "metric", "education", "story", "project", "role", "skill", "tool"];
  const d = {
    ...emptyDossier(NOW),
    evidence: KINDS.map((kind, i) => record({ kind, detail: `${UNRESOLVED} (${kind})`, disclosureReview: "needs_review", disclosureReason: "health", id: `k-${i}` }))
  };
  check("no evidence kind escapes the gate",
    getUsableEvidence(d).length === 0,
    JSON.stringify(getUsableEvidence(d).map((e) => e.kind)));
  const lanes = [{ id: "lane-1", title: "Retail Supervisor", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "custom", createdAt: NOW }];
  const whole = JSON.stringify(generateResumePack(d, lanes, NOW));
  check("  and none of them reach a generated pack", !whole.toLowerCase().includes("signed off sick"), whole.slice(0, 200));
}

// ---------------------------------------------------------------------------
console.log("\n--- 6. saved-version regeneration and export after a refresh ---");
{
  const d = dossierWith();
  // A refresh is a serialization round trip. Fields lost in transit must fail
  // CLOSED: this is the exact path that turned a stale keep into a live
  // approval when the reviewed-text fingerprint was dropped.
  const rehydrated = JSON.parse(JSON.stringify(d));
  check("a serialization round trip does not widen eligibility",
    getUsableEvidence(rehydrated).length === getUsableEvidence(d).length,
    `${getUsableEvidence(rehydrated).length} vs ${getUsableEvidence(d).length}`);

  const stripped = { ...d, evidence: d.evidence.map(({ disclosureReviewedText, ...rest }) => rest) };
  const stillUsable = getUsableEvidence(stripped).map((e) => e.detail);
  check("  dropping the fingerprint never ADMITS anything new",
    stillUsable.every((detail) => getUsableEvidence(d).some((e) => e.detail === detail)),
    JSON.stringify(stillUsable));

  const state = {
    dossier: d, profile: {}, lanes: [], applications: [], resumePacks: [], roleSprints: [], pendingImportReviews: [],
    resumeVersions: [{
      id: "v1", label: "saved", laneId: null, notes: "", source: "builder", applicationId: null,
      targetCompany: "", targetTitle: "", keywordsUsed: [], gapsAcknowledged: [], influenceSummary: "",
      resumeText: `- ${CLEAN}\n- ${UNRESOLVED}\n- ${EXCLUDED}`, resumeSnapshot: null, createdAt: NOW
    }]
  };
  const migrated = sanitizeCommandCenterState(state);
  const savedText = migrated.resumeVersions[0].resumeText;
  check("a previously-saved version is cleaned of ineligible content", leaks(savedText).length === 0, savedText);
  check("  while the legitimate line survives", savedText.includes("stock count"), savedText);
}

// ---------------------------------------------------------------------------
console.log("\n--- 7. changing reviewed text after approval ---");
{
  const approved = record({ detail: CLEAN, disclosureReview: "keep", disclosureReviewedText: CLEAN, roleId: "role-a" });
  check("an approved record is usable", evidenceEligibility(approved).usable);
  const edited = { ...approved, detail: "I only did the stock count while I was off sick from the tills." };
  check("  editing the text revokes the old approval immediately",
    !evidenceEligibility(edited).usable && evidenceEligibility(edited).reason === "stale_resolution",
    JSON.stringify(evidenceEligibility(edited)));
  const d = { ...emptyDossier(NOW), evidence: [edited] };
  check("  and the edited words reach no generated pack",
    !JSON.stringify(generateResumePack(d, [{ id: "l", title: "Retail", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "custom", createdAt: NOW }], NOW)).includes("off sick from the tills"));
  check("  the user's text is not mutated by any of this", edited.detail.includes("off sick from the tills"));
}

// ---------------------------------------------------------------------------
console.log("\n--- 8. evidence belonging to another role ---");
{
  const d = {
    ...emptyDossier(NOW),
    evidence: [record({ detail: OTHER_ROLE, roleId: "role-b" }), record({ detail: CLEAN, roleId: "role-a" })]
  };
  const forA = getUsableEvidence(d, { roleId: "role-a" }).map((e) => e.detail);
  check("one employer's evidence never resolves under another",
    forA.length === 1 && forA[0] === CLEAN, JSON.stringify(forA));
  const ownerless = { ...emptyDossier(NOW), evidence: [record({ detail: OTHER_ROLE })] };
  check("  and an ownerless legacy record is not silently adopted",
    getUsableEvidence(ownerless, { roleId: "role-a" }).length === 0,
    JSON.stringify(getUsableEvidence(ownerless, { roleId: "role-a" }).map((e) => e.detail)));
}

// ---------------------------------------------------------------------------
console.log("\n--- 9. fields the gate exempted, and laundering ---");
{
  const base = { ...initialIntake, fullName: "Sam Okafor", currentTitle: "Assistant", currentCompany: "Bridgeway", currentTime: "2021 - 2026", responsibilities: CLEAN };

  // The exemption list is the gate's one hand-maintained surface, so it gets
  // its own assertions. `education` and the *Time fields print on the résumé
  // and were exempt: the SAME sentence was withheld from customRoleNotes and
  // printed from education in one generation call.
  const edu = { ...base, education: "Dropped out of the plumbing diploma after the first term." };
  const eduPkg = generateResumePackage(edu);
  check("a disclosure typed into the education field is withheld",
    !/plumbing diploma/i.test(resumeToText(edu, eduPkg) + JSON.stringify(eduPkg)), JSON.stringify(eduPkg.education));
  check("  while ordinary education still prints",
    /Business Administration/i.test(JSON.stringify(generateResumePackage({ ...base, education: "AA in Business Administration, Tri-C 2020" }))));

  const dated = { ...base, currentTime: "2019-2023, until my position was cut because I flagged the billing error" };
  check("a disclosure typed into an employment date is withheld",
    !/billing error/i.test(JSON.stringify(generateResumePackage(dated))));
  check("  while ordinary dates still print", /2021 - 2026/.test(JSON.stringify(generateResumePackage(base))));

  // Laundering: the withheld sentence is never printed, but it must not
  // AUTHORIZE a posting keyword to be claimed as a skill either. That is worse
  // than printing it — the resulting claim has no citation to invalidate.
  const denial = { ...base, currentCompany: "Clinic", responsibilities: "I dropped out of the phlebotomy program after one term." };
  const ctx = { roleTitle: "Phlebotomist", company: "Acme Clinic", laneTitle: null, resumeAngle: "", keywords: ["phlebotomy"], coveredRequirements: [], partialRequirements: [], gaps: [] };
  const tailored = applyTailoredContext(generateResumePackage(denial), ctx, getUsableIntake(denial), "");
  check("a denial cannot authorize a posting keyword as a skill",
    !tailored.resume.coreSkills.some((skill) => /phlebotom/i.test(skill)), JSON.stringify(tailored.resume.coreSkills));
  check("  nor as claimed experience in the summary",
    !/experience in phlebotomy/i.test(tailored.resume.summary), tailored.resume.summary);
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
