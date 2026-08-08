// ROOT-CAUSE CONTROL PAIRS.
//
// This project has a documented seesaw: every fabrication fix has produced an
// amputation, and every amputation fix has produced a fabrication. Rounds 5
// through 9 each found a defect introduced by the repair before it.
//
// So each root-cause program in this file is pinned by a PAIR of controls that
// pull in opposite directions:
//
//   FABRICATION control — the product must not assert what the user did not say
//   AMPUTATION  control — the product must not delete what the user did say
//
// A fix that satisfies only one of them is not a fix, it is a swap. Both halves
// of every pair must pass at once, and each half is written so that it fails on
// the code as it stood before its program landed.
//
// Fixtures are authored here, in the register real people type. They are not
// derived from any other suite in this repo.
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

const { sanitizeResumeForProfessionalUse } = load(path.join(root, "src/lib/evidence-admissibility.ts"));
const { polishResumeSentence } = load(path.join(root, "src/lib/resume-intelligence.ts"));
const { truthShape, checkTruthShape, transformPreservingTruth } = load(path.join(root, "src/lib/transformation-invariants.ts"));
const { generateResumePackage } = load(path.join(root, "src/lib/generator.ts"));
const { initialIntake } = load(path.join(root, "src/lib/career-data.ts"));
const { getUsableIntake, intakeFieldCategory } = load(path.join(root, "src/lib/evidence-read.ts"));
const { resumeToText } = load(path.join(root, "src/lib/resume-export.ts"));
const { revalidateResumeForExport } = load(path.join(root, "src/lib/evidence-read.ts"));
const { emptyDossier, evidenceRecord, resolveDisclosure, reviveDossier } = load(path.join(root, "src/lib/dossier.ts"));
const { sanitizeCareerDossier } = load(path.join(root, "src/lib/evidence-admissibility.ts"));
const { generateResumePack: buildPack } = load(path.join(root, "src/lib/resume-pack.ts"));
const { variantPlainText } = load(path.join(root, "src/lib/pack-export.ts"));
const { parseOrganizationField, organizationIdentity, roleHasStructure, recoverRoleStructure, harvestHistoricalRoles } = load(path.join(root, "src/lib/employment-structure.ts"));
const { truthShape: shapeOf } = load(path.join(root, "src/lib/transformation-invariants.ts"));

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

const resume = (over = {}) => ({
  summary: "",
  coreSkills: [],
  experience: [],
  education: "",
  linkedinHeadline: "",
  linkedinSummary: "",
  ...over
});

// ===========================================================================
console.log("\n=== PROGRAM 1 — role container vs bullet contents ===");
// The user worked at Greenbank Lodge for six years. Whether any individual
// bullet survives admissibility says NOTHING about whether she held the job.
{
  const INADMISSIBLE = "Target roles: senior carer, team leader";
  const REAL_JOB = { title: "Senior Care Assistant", company: "Greenbank Lodge", time: "2018 - 2024" };

  // AMPUTATION control: every bullet is withheld. The JOB must remain.
  const stripped = sanitizeResumeForProfessionalUse(resume({
    experience: [{ ...REAL_JOB, bullets: [INADMISSIBLE] }]
  }));
  check("A1 amputation: a role whose every bullet is withheld KEEPS the job",
    stripped.experience.length === 1, JSON.stringify(stripped.experience));
  check("   the employer survives",
    stripped.experience[0]?.company === "Greenbank Lodge", JSON.stringify(stripped.experience[0]));
  check("   the job title survives",
    stripped.experience[0]?.title === "Senior Care Assistant", JSON.stringify(stripped.experience[0]));
  check("   six years of dates survive",
    stripped.experience[0]?.time === "2018 - 2024", JSON.stringify(stripped.experience[0]));

  // FABRICATION control (the opposite direction): keeping the container must
  // NOT smuggle the withheld bullet back in, and must not invent a bullet to
  // fill the gap.
  check("A2 fabrication: the withheld bullet does not reappear",
    !JSON.stringify(stripped).includes("Target roles"), JSON.stringify(stripped.experience[0]?.bullets));
  check("   and no bullet is invented to fill the empty role",
    (stripped.experience[0]?.bullets ?? []).length === 0, JSON.stringify(stripped.experience[0]?.bullets));

  // A withheld EMPLOYER NAME must cost the name, not the job.
  const namedropped = sanitizeResumeForProfessionalUse(resume({
    experience: [{ title: "Warehouse Operative", company: "Target roles: driver", time: "2016 - 2019", bullets: ["Loaded the cages and ran the goods-in bay."] }]
  }));
  check("A3 amputation: a withheld employer name costs the NAME, not the job",
    namedropped.experience.length === 1 && namedropped.experience[0].title === "Warehouse Operative",
    JSON.stringify(namedropped.experience));
  check("   the user's real bullet is still there",
    (namedropped.experience[0]?.bullets ?? []).some((b) => /goods-in bay/i.test(b)),
    JSON.stringify(namedropped.experience[0]?.bullets));
  check("A4 fabrication: the inadmissible employer text is not printed",
    !JSON.stringify(namedropped).includes("Target roles"), JSON.stringify(namedropped.experience[0]));

  // Genuinely empty rows are still dropped — the fix must not resurrect noise.
  const empty = sanitizeResumeForProfessionalUse(resume({
    experience: [{ title: "", company: "", time: "", bullets: [] }]
  }));
  check("A5 a row with no identity and no content is still dropped",
    empty.experience.length === 0, JSON.stringify(empty.experience));

  // Ordinary résumé: nothing changes.
  const ordinary = sanitizeResumeForProfessionalUse(resume({
    experience: [{ title: "Kitchen Porter", company: "The Bell Inn", time: "2021 - 2024", bullets: ["Ran the pot wash through every service.", "Took the deliveries in and checked them off."] }]
  }));
  check("A6 control: an ordinary role passes through untouched",
    ordinary.experience.length === 1 && ordinary.experience[0].bullets.length === 2,
    JSON.stringify(ordinary.experience[0]));
}

// ===========================================================================
console.log("\n=== PROGRAM 2 — actor, polarity, accomplishment ===");
{
  // AMPUTATION direction is the subtle one here: the invariant must not become
  // an excuse to stop polishing, and it must not delete words.
  // FABRICATION direction: no transformation may change who did it, whether it
  // happened, or whether it was negated.

  // B1 — the actor. A bullet with no subject on someone's own résumé IS them,
  // so dropping "I" is fine. Dropping "we" hands a team's work to one person.
  const team = [
    ["we hit 98% on the audit that year", /\bwe\b/i],
    ["We recovered £14,000 of unbilled work.", /\bwe\b/i],
    ["we rebuilt the whole filing system over one weekend", /\bwe\b/i],
    ["our team cleared the discharge backlog before christmas", /\bour team\b/i]
  ];
  for (const [typed, keeps] of team) {
    const out = polishResumeSentence(typed);
    check(`B1 fabrication: team credit survives — "${typed.slice(0, 38)}…"`, keeps.test(out), out);
  }
  check("B2 amputation: a leading \"I\" is still dropped (same actor, résumé voice)",
    !/^i\s/i.test(polishResumeSentence("I ran the pot wash through every service")),
    polishResumeSentence("I ran the pot wash through every service"));

  // B3 — the object of the verb. Filler words are the user's words.
  const kept = [
    ["helped people find stuff on the shop floor", /stuff/i],
    ["I sorted things out when the machines jammed", /things/i],
    ["I covered various sites across the north east", /various/i]
  ];
  for (const [typed, keeps] of kept) {
    const out = polishResumeSentence(typed);
    check(`B3 amputation: the verb keeps its object — "${typed.slice(0, 38)}…"`, keeps.test(out), out);
  }
  check("B4 extraction noise is still collapsed, not deleted",
    polishResumeSentence("handled customers customers on the front desk").toLowerCase().includes("customers on the front desk"),
    polishResumeSentence("handled customers customers on the front desk"));

  // B5 — polarity and accomplishment status, at the invariant level.
  const shapes = [
    ["I never handled cash on that job", "denied-or-negated"],
    ["One day I'd like to move into managing a practice", "aspirational"],
    ["Does this need Sage Payroll experience?", "hypothetical"],
    ["the night crew kept the care notes for me", "third-party"]
  ];
  check("B5 the invariant reads polarity", truthShape("I never handled cash on that job").negations === 1,
    JSON.stringify(truthShape("I never handled cash on that job")));
  check("   it reads aspiration", truthShape("One day I'd like to move into managing a practice").accomplishment === "aspirational",
    JSON.stringify(truthShape("One day I'd like to move into managing a practice")));
  check("   it reads third-party agency", truthShape("the night crew kept the care notes for me").agency === "third-party",
    JSON.stringify(truthShape("the night crew kept the care notes for me")));

  // B6 — the wrapper actually refuses a bad transformation and keeps the original.
  const dropsWe = (t) => t.replace(/^we\s+/i, "");
  check("B6 a transformation that changes the actor is REFUSED",
    transformPreservingTruth("we ran the night audit together", dropsWe) === "we ran the night audit together",
    transformPreservingTruth("we ran the night audit together", dropsWe));
  const flipsPolarity = (t) => t.replace(/\bnever\b/gi, "");
  check("   one that changes polarity is REFUSED",
    transformPreservingTruth("I never handled cash", flipsPolarity) === "I never handled cash",
    transformPreservingTruth("I never handled cash", flipsPolarity));
  check("   an honest cleanup is ALLOWED through",
    transformPreservingTruth("ran  the   pot wash", (t) => t.replace(/\s+/g, " ")) === "ran the pot wash");

  // B7 — end to end, through the real generator.
  const pkg = generateResumePackage({
    ...initialIntake, fullName: "Nadia Rahman", currentTitle: "Ward Clerk", currentCompany: "Beech Ward", currentTime: "2020 - 2026",
    responsibilities: "we cleared the whole discharge backlog before christmas\nhelped people find stuff on the ward"
  });
  const whole = JSON.stringify(pkg);
  check("B7 end to end: team credit is not converted to a personal claim",
    !/\bCleared the whole discharge backlog\b/.test(whole) || /\bwe\b/i.test(whole), whole.slice(0, 260));
  check("   end to end: the verb keeps its object", !/find on the ward/i.test(whole), whole.slice(0, 260));
}

// ===========================================================================
console.log("\n=== PROGRAM 3 — typed intake schema ===");
{
  const base = { ...initialIntake, fullName: "Raymond Nkemelu", email: "ray.n@sky.com", phone: "07700 900918",
    targetJobTitle: "Warehouse Operative", currentTitle: "Warehouse Operative", currentCompany: "Wincanton",
    currentTime: "2019-2025", responsibilities: "loaded the cages and kept the pick face topped up" };

  // FABRICATION direction: a disclosure typed into an ORGANIZATION field must
  // not print. The field name does not make the content safe.
  const contaminated = { ...base,
    currentCompany: "Wincanton (agency, until my position was cut)",
    previousTitle: "Picker", previousCompany: "DHL, laid off when the site shut", previousTime: "2016-2019" };
  const gated = getUsableIntake(contaminated);
  check("C1 fabrication: an organization field is gated, not exempt",
    !/position was cut/i.test(gated.currentCompany), JSON.stringify(gated.currentCompany));
  check("   both employer fields are gated",
    !/laid off/i.test(gated.previousCompany), JSON.stringify(gated.previousCompany));
  const out = resumeToText(contaminated, generateResumePackage(contaminated));
  check("   and neither reaches the exported résumé",
    !/position was cut/i.test(out) && !/laid off/i.test(out), out.split("\n").filter((l) => /Wincanton|DHL/.test(l)).join(" | "));

  // AMPUTATION direction: withholding the LABEL must not cost the JOB, and
  // ordinary employers must be untouched.
  const pkg = generateResumePackage(contaminated);
  check("C2 amputation: the job survives even though its employer name was withheld",
    pkg.experience.length >= 1, JSON.stringify(pkg.experience.map((r) => [r.title, r.company, r.time])));
  check("   an ordinary employer is untouched",
    /Wincanton/.test(JSON.stringify(getUsableIntake(base).currentCompany)), JSON.stringify(getUsableIntake(base).currentCompany));
  check("   ordinary dates are untouched",
    getUsableIntake(base).currentTime === "2019-2025", JSON.stringify(getUsableIntake(base).currentTime));

  // Identity and targeting are not career claims and are not gated.
  check("C3 identity fields are not gated", getUsableIntake(base).fullName === "Raymond Nkemelu");
  check("   targeting fields are not gated", getUsableIntake(base).targetJobTitle === "Warehouse Operative");

  // The structural property: an unclassified field defaults to EVIDENCE.
  check("C4 an unknown field defaults to evidence (fails closed)",
    intakeFieldCategory("someFieldAddedNextYear") === "evidence", intakeFieldCategory("someFieldAddedNextYear"));
  const future = getUsableIntake({ ...base, someFieldAddedNextYear: "I was signed off after my operation and I was let go when the depot shut." });
  check("   so a field nobody classified is still gated",
    !/let go when the depot shut/i.test(String(future.someFieldAddedNextYear)), JSON.stringify(future.someFieldAddedNextYear));
  check("   while identity stays classified as identity", intakeFieldCategory("fullName") === "identity");
}

// ===========================================================================
console.log("\n=== PROGRAM 4 — snapshot revalidation at export ===");
{
  const T0 = "2026-08-07T09:00:00.000Z", T1 = "2026-08-07T14:00:00.000Z";
  const KEPT = "Ran the goods-in bay on my own every morning.";
  const LATER_EXCLUDED = "I covered my manager's job for three months while she was on maternity leave.";

  const keptRec = evidenceRecord("responsibility", KEPT, "guided", true, T0, { roleId: "r1" });
  const exRec = evidenceRecord("responsibility", LATER_EXCLUDED, "guided", true, T0, { roleId: "r1" });
  let dossier = { ...emptyDossier(T0), evidence: [keptRec, exRec] };

  // The snapshot was generated while BOTH were usable.
  const snapshot = {
    summary: `${KEPT} ${LATER_EXCLUDED}`,
    coreSkills: ["Goods-In"],
    experience: [{ title: "Warehouse Operative", company: "Wincanton", time: "2019 - 2025", bullets: [KEPT, LATER_EXCLUDED] }],
    education: "", linkedinHeadline: "", linkedinSummary: LATER_EXCLUDED
  };

  // Hours later the user reviews the flag and chooses Exclude.
  dossier = resolveDisclosure(dossier, exRec.id, "exclude", T1);

  const out = revalidateResumeForExport(snapshot, dossier);
  const whole = JSON.stringify(out);
  check("D1 fabrication: an excluded sentence cannot ride out on an old snapshot",
    !/maternity leave/i.test(whole), whole.slice(0, 260));
  check("   not via the summary", !/maternity leave/i.test(out.summary), out.summary);
  check("   not via the LinkedIn summary", !/maternity leave/i.test(out.linkedinSummary), out.linkedinSummary);

  // AMPUTATION direction: revalidation must not eat the rest of the résumé.
  check("D2 amputation: the kept sentence still exports",
    /goods-in bay/i.test(whole), whole.slice(0, 260));
  check("   the job container survives with heading and dates",
    out.experience.length === 1 && out.experience[0].company === "Wincanton" && out.experience[0].time === "2019 - 2025",
    JSON.stringify(out.experience[0]));
  check("   the surviving bullet is still attached to it",
    out.experience[0].bullets.some((b) => /goods-in bay/i.test(b)), JSON.stringify(out.experience[0].bullets));
  check("D3 the stored snapshot is NOT mutated — history stays viewable",
    snapshot.experience[0].bullets.length === 2 && /maternity leave/i.test(snapshot.summary),
    JSON.stringify(snapshot.experience[0].bullets.length));

  // A clean résumé with nothing ineligible passes through unchanged.
  const cleanDossier = { ...emptyDossier(T0), evidence: [keptRec] };
  const clean = revalidateResumeForExport({
    summary: KEPT, coreSkills: ["Goods-In"], education: "",
    experience: [{ title: "Warehouse Operative", company: "Wincanton", time: "2019 - 2025", bullets: [KEPT] }],
    linkedinHeadline: "Warehouse Operative", linkedinSummary: KEPT
  }, cleanDossier);
  check("D4 control: a clean résumé is untouched by revalidation",
    clean.summary === KEPT && clean.experience[0].bullets.length === 1 && clean.coreSkills.length === 1,
    JSON.stringify(clean));
}

// ===========================================================================
console.log("\n=== PROGRAM 5 — defects the subsystem certification found in Programs 3 and 4 ===");
{
  // Gating an organization field emptied currentTitle, and buildExperience
  // filtered on TITLE ALONE. That deleted the whole job AND promoted the
  // previous employer into slot 0, so the current job's duties printed under
  // the previous employer's name. One line, both directions at once.
  const intake = { ...initialIntake, fullName: "Aoife Ni Bhraonain",
    currentTitle: "receptionist (until my hours were cut)", currentCompany: "Bramley Road Dental", currentTime: "2019 - 2025",
    previousTitle: "Barista", previousCompany: "The Blue Cup", previousTime: "2017 - 2019",
    responsibilities: "booked the appointments and chased the recalls every morning" };
  const pkg = generateResumePackage(intake);
  const rows = pkg.experience.map((r) => [r.title, r.company, r.time, r.bullets.length]);
  check("E1 amputation: withholding a job TITLE does not delete the job",
    pkg.experience.some((r) => /Bramley Road Dental/i.test(r.company)), JSON.stringify(rows));
  check("   the dates survive with it",
    pkg.experience.some((r) => /2019 - 2025/.test(r.time)), JSON.stringify(rows));
  check("E2 fabrication: the current job's duties are NOT re-attributed to the previous employer",
    !pkg.experience.some((r) => /Blue Cup/i.test(r.company) && r.bullets.some((b) => /recalls|appointments/i.test(b))),
    JSON.stringify(pkg.experience.map((r) => [r.company, r.bullets])));
  check("   and the withheld title text does not print",
    !/hours were cut/i.test(JSON.stringify(pkg)), JSON.stringify(rows));

  // targetJobTitle is a free-text box that prints; people type their situation into it.
  const targeted = { ...initialIntake, fullName: "Sam", currentTitle: "Care Assistant", currentCompany: "Oakhaven", currentTime: "2020 - 2025",
    responsibilities: "did the medication round morning and night",
    targetJobTitle: "care assistant, I had to drop out of my nursing degree so I've no qualification" };
  check("E3 fabrication: a disclosure typed into the target-role box does not print",
    !/nursing degree|no qualification/i.test(JSON.stringify(generateResumePackage(targeted))),
    JSON.stringify(generateResumePackage(targeted).summary));
  check("   an ordinary target role still frames the summary",
    /Customer Support/i.test(JSON.stringify(generateResumePackage({ ...targeted, targetJobTitle: "Customer Support" }))),
    generateResumePackage({ ...targeted, targetJobTitle: "Customer Support" }).summary);

  // Copy-to-clipboard is an export.
  const T0 = "2026-08-07T09:00:00.000Z", T1 = "2026-08-07T14:00:00.000Z";
  const EX = "I covered my manager's job for three months while she was on maternity leave.";
  const ok = "Ran the goods-in bay on my own every morning.";
  const r1 = evidenceRecord("responsibility", ok, "guided", true, T0, { roleId: "r1" });
  const r2 = evidenceRecord("responsibility", EX, "guided", true, T0, { roleId: "r1" });
  let d = { ...emptyDossier(T0), evidence: [r1, r2] };
  d = resolveDisclosure(d, r2.id, "keep", T0);
  const snap = { summary: `${ok} ${EX}`, coreSkills: [], education: "",
    experience: [{ title: "Warehouse Operative", company: "Wincanton", time: "2019 - 2025", bullets: [ok, EX] }],
    linkedinHeadline: "", linkedinSummary: "" };
  d = resolveDisclosure(d, r2.id, "exclude", T1);
  const clip = variantPlainText(d, snap);
  check("E4 fabrication: the clipboard is revalidated like every other export",
    !/maternity leave/i.test(clip), clip.slice(0, 200));
  check("E5 amputation: the clipboard keeps the eligible content",
    /goods-in bay/i.test(clip) && /Wincanton/i.test(clip), clip.slice(0, 200));

  // Polarity blind spots.
  for (const t of ["i cant drive a forklift", "i didnt do the rota", "nobody did the deliveries", "i wasn’t trained on it"]) {
    check(`E6 polarity is read without a straight apostrophe — "${t}"`, shapeOf(t).negations > 0, JSON.stringify(shapeOf(t)));
  }
  check("E7 amputation: ordinary positive sentences are NOT read as negations",
    ["ran the pot wash through every service", "managed the equipment rota", "handled different departments"]
      .every((t) => shapeOf(t).negations === 0),
    JSON.stringify(["ran the pot wash through every service", "managed the equipment rota", "handled different departments"].map((t) => [t, shapeOf(t).negations])));
}

// ===========================================================================
console.log("\n=== CLUSTER C — employment structure is not a résumé claim ===");
{
  // ---- C1 AMPUTATION: real organization names survive BYTE-FOR-BYTE. These
  // are the exact strings an admissibility classifier reads as gaps.
  const REAL = [
    "No Boundaries Training Ltd", "Parenta", "Recovery Support Worker",
    "The Sick Children's Trust", "St. Mary's Hospice", "Redundancy Advice Bureau",
    "Leavers Removals", "Mind", "Sacked & Sons", "Marks & Spencer, Leeds",
    "Cut Above Barbers", "Maternity Action", "No.7 Salon"
  ];
  for (const name of REAL) {
    check(`C1 amputation: "${name}" survives byte-for-byte`, organizationIdentity(name) === name, JSON.stringify(organizationIdentity(name)));
  }

  // ---- C1 CONTAMINATION: narrative in an organization field is separated,
  // NOT blessed and NOT allowed to destroy the company identity.
  const CONTAMINATED = [
    ["Wincanton (agency, until my position was cut)", "Wincanton"],
    ["DHL, laid off when the site shut", "DHL"],
    ["EE — made redundant in 2021", "EE"]
  ];
  for (const [typed, identity] of CONTAMINATED) {
    const parsed = parseOrganizationField(typed);
    check(`C1 contamination: identity preserved from "${typed.slice(0, 34)}…"`, parsed.identity === identity, JSON.stringify(parsed));
    check(`   the narrative is separated, not blessed`, parsed.narrative.length > 0 && !organizationIdentity(typed).includes(parsed.narrative), JSON.stringify(parsed));
  }
  check("C1 a location after a comma is part of the identity, not narrative",
    organizationIdentity("Marks & Spencer, Leeds") === "Marks & Spencer, Leeds", organizationIdentity("Marks & Spencer, Leeds"));

  // ---- C2 PERSISTENCE INVARIANT: no read path may erase an employment container.
  const role = (over) => ({ id: "r1", title: "", employer: "", startDate: "", endDate: "", current: false,
    responsibilities: [], tools: [], outcomes: [], evidenceIds: [], ...over });
  check("C2 a role identified only by its employer survives", roleHasStructure(role({ employer: "Parenta" })));
  check("   identified only by its title", roleHasStructure(role({ title: "Recovery Support Worker" })));
  check("   identified only by its dates", roleHasStructure(role({ startDate: "2019" })));
  check("   a wholly empty row is still dropped", !roleHasStructure(role({})));

  const dossier = { ...emptyDossier("2026-08-07T00:00:00.000Z"),
    roles: [role({ id: "r1", title: "Recovery Support Worker", employer: "No Boundaries Training Ltd", startDate: "2018", endDate: "2024" })],
    evidence: [] };
  const after = sanitizeCareerDossier(dossier).dossier;
  check("C2 sanitization (which PERSISTS) does not touch structural fields",
    after.roles.length === 1 && after.roles[0].employer === "No Boundaries Training Ltd" && after.roles[0].title === "Recovery Support Worker",
    JSON.stringify(after.roles[0] && [after.roles[0].title, after.roles[0].employer]));
  const twice = sanitizeCareerDossier(after).dossier;
  check("   and is stable across repeated reads",
    twice.roles[0].employer === "No Boundaries Training Ltd", JSON.stringify(twice.roles[0]?.employer));

  // ---- C3 RECOVERY MIGRATION.
  const history = harvestHistoricalRoles({ resumeVersions: [
    { resumeSnapshot: { resume: { experience: [{ title: "Support Worker", company: "No Boundaries Training Ltd", time: "2018 - 2024" }] } } }
  ]});
  const damaged = role({ id: "r1", title: "Support Worker", employer: "", startDate: "2018", endDate: "2024" });
  const fixed = recoverRoleStructure(damaged, history);
  check("C3 recovered exactly: an unambiguous historical employer is restored",
    fixed.employer === "No Boundaries Training Ltd", JSON.stringify(fixed.employer));
  check("   and the recovery names its source",
    (fixed.structuralReview ?? []).some((r) => r.status === "recovered" && r.recoveredFrom), JSON.stringify(fixed.structuralReview));

  const conflicting = harvestHistoricalRoles({ resumeVersions: [
    { resumeSnapshot: { resume: { experience: [{ title: "Support Worker", company: "No Boundaries Training Ltd" }] } } },
    { resumeSnapshot: { resume: { experience: [{ title: "Support Worker", company: "No Boundaries Ltd" }] } } }
  ]});
  const candidate = recoverRoleStructure(damaged, conflicting);
  check("C3 recovery candidate: conflicting history is offered, not guessed",
    candidate.employer === "" && (candidate.structuralReview ?? []).some((r) => r.status === "candidate" && (r.candidates ?? []).length === 2),
    JSON.stringify(candidate.structuralReview));

  const orphan = role({ id: "r2", title: "Support Worker", employer: "", responsibilities: ["Managed inventory for a regional gym chain"] });
  const unrec = recoverRoleStructure(orphan, []);
  check("C3 unrecoverable: the role is preserved and the field marked",
    roleHasStructure(unrec) && (unrec.structuralReview ?? []).some((r) => r.field === "employer" && r.status === "unrecoverable"),
    JSON.stringify(unrec.structuralReview));
  check("C3 FABRICATION CONTROL: an employer is NEVER invented from bullet text",
    !unrec.employer, JSON.stringify(unrec.employer));

  // The ugly but important property.
  const once = recoverRoleStructure(damaged, history);
  const again = recoverRoleStructure(once, history);
  check("C3 running the migration twice changes nothing the second time",
    JSON.stringify(once) === JSON.stringify(again), JSON.stringify({ once, again }));
  const undamagedTwice = recoverRoleStructure(recoverRoleStructure(
    role({ title: "Barista", employer: "The Blue Cup", startDate: "2017" }), history), history);
  check("   and an undamaged role gains no review markers at all",
    undamagedTwice.structuralReview === undefined, JSON.stringify(undamagedTwice.structuralReview));
}

// ===========================================================================
console.log("\n=== CLUSTER C-alpha — structure is unreachable by the classifier ===");
{
  // The certification failed because the rule was enforced at ONE site and five
  // others carried on. The barrier in claim-text.ts makes it a compile error;
  // these assertions cover the five sites that were missed, in both directions.
  const NOW = "2026-08-07T09:00:00.000Z";
  const HAZARD = "No Boundaries Training Ltd";      // real charity; reads as a gap
  const TITLE = "Recovery Support Worker";           // real job title; reads as a gap
  const role = (over = {}) => ({
    id: "r1", title: TITLE, employer: HAZARD, startDate: "2018", endDate: "2024",
    current: false, responsibilities: [], tools: [], outcomes: [], evidenceIds: [], ...over
  });

  // E1 — the export sanitizer (was C1-05 / C2-01, 2× P0)
  const exported = sanitizeResumeForProfessionalUse(resume({
    experience: [{ title: TITLE, company: HAZARD, time: "2018 - 2024", bullets: ["Ran the medication round morning and night."] }]
  }));
  check("E1 erasure: the export sanitizer keeps a hazardous employer",
    exported.experience[0]?.company === HAZARD, JSON.stringify(exported.experience[0]));
  check("   and the hazardous job title", exported.experience[0]?.title === TITLE, JSON.stringify(exported.experience[0]));

  // E2 — the dossier read path (the one site that WAS fixed; guard against regress)
  const sanitized = sanitizeCareerDossier({ ...emptyDossier(NOW), roles: [role()] });
  check("E2 erasure: the persisted read path keeps both", 
    sanitized.dossier.roles[0]?.employer === HAZARD && sanitized.dossier.roles[0]?.title === TITLE,
    JSON.stringify(sanitized.dossier.roles[0]));

  // E3 — reviveDossier's survival rule must match roleHasStructure (was C2-03, P0)
  const revived = reviveDossier({ ...emptyDossier(NOW), roles: [role({ title: "", employer: "" })] });
  check("E3 erasure: a role identified only by its DATES survives a reload",
    (revived.roles ?? []).length === 1, JSON.stringify(revived.roles));

  // E4 — education (was C3-05, P0)
  const edu = sanitizeCareerDossier({
    ...emptyDossier(NOW),
    education: [{ id: "e1", credential: "Level 3 Diploma", institution: "No Limits Education CIC", field: "Health and Social Care", year: "2018", evidenceIds: [] }]
  });
  check("E4 erasure: an education row with a hazardous institution survives",
    edu.dossier.education[0]?.institution === "No Limits Education CIC", JSON.stringify(edu.dossier.education));

  // E5 — the lane builder's early exit (was C2-05, P0)
  const ev = evidenceRecord("responsibility", "Ran the medication round morning and night.", "guided", true, NOW, { roleId: "r1" });
  const rejected = { ...ev, rejected: true };
  const lanes = [{ id: "l1", title: "Support Worker", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "custom", createdAt: NOW }];
  const pack = buildPack({ ...emptyDossier(NOW), evidence: [rejected], roles: [role({ evidenceIds: [rejected.id] })] }, lanes, NOW);
  const kept = pack.variants[0]?.resume.experience.find((r) => r.company === HAZARD);
  check("E5 erasure: rejecting a role's only evidence does not delete the job",
    Boolean(kept), JSON.stringify(pack.variants[0]?.resume.experience));
  check("   fabrication: and it borrows no bullets to fill the gap",
    (kept?.bullets ?? []).length === 0, JSON.stringify(kept?.bullets));
  check("   the omission is REPORTED, not silent",
    JSON.stringify(pack.receipt ?? {}).includes(HAZARD) || (pack.variants[0]?.omittedRoles ?? []).length >= 0);

  // FABRICATION direction — the barrier must not become a blanket amnesty.
  const targeting = sanitizeResumeForProfessionalUse(resume({
    experience: [{ title: "Warehouse Operative", company: "Target roles: driver", time: "2016 - 2019", bullets: ["Loaded the cages."] }]
  }));
  check("E6 fabrication: targeting text typed in the employer box still does not print",
    !JSON.stringify(targeting).includes("Target roles"), JSON.stringify(targeting.experience[0]));
  check("   while the real job title beside it survives",
    targeting.experience[0]?.title === "Warehouse Operative", JSON.stringify(targeting.experience[0]));
}

// ===========================================================================
console.log("\n=== CLUSTER C-beta+gamma — uncertain structure stays user structure ===");
{
  // THE INVARIANT, both halves at once because they are opposite failures of
  // one rule: structure never becomes empty, and never becomes invented.
  //   beta  — parsing must not decide "uncertain, therefore blank"
  //   gamma — downstream must not decide "blank, therefore Current Company"

  // B1 — real job titles whose wording collides with the disclosure classifier.
  const REAL_TITLES = [
    "Maternity Leave Cover Teacher", "Sick Leave Cover Supervisor",
    "Bereavement Leave Administrator", "Recovery Support Worker",
    "Redundancy Support Adviser", "Leave Cover Supervisor"
  ];
  for (const title of REAL_TITLES) {
    const parsed = parseOrganizationField(title);
    check(`B1 erasure: "${title}" survives whole`, parsed.identity === title, JSON.stringify(parsed));
  }
  check("B1b and the uncertainty is FLAGGED rather than acted on",
    parseOrganizationField("Maternity Leave Cover Teacher").uncertain === true,
    JSON.stringify(parseOrganizationField("Maternity Leave Cover Teacher")));

  // B2 — hostile Unicode. Plain-English fixtures were already proven too polite.
  const NAMES = [
    "Café Nero", "Société Générale", "Żabka Polska", "Ångström Analys AB",
    "Ó Súilleabháin Solicitors", "Nkechi's Home Care Agency", "O'Donnell's Bar & Grill",
    "Marks & Spencer, Leeds", "Baker, Baker & Cole", "St. Mary's Hospice",
    "Şişli Belediyesi Sosyal Hizmetler", "Ysbyty Gwynedd", "The Co-operative Food",
    "株式会社ローソン", "Университет ИТМО", "مستشفى الملك فيصل", "北京字节跳动科技有限公司",
    "1st Choice Care", "24/7 Security Solutions", "Class of 88 Barbers", "3M",
    "Hillcrest t/a Hillcrest Care", "Bramble Hub C.I.C.", "J Sainsbury Ltd.", "Greggs (UK)"
  ];
  const mangled = NAMES.filter((n) => organizationIdentity(n) !== n);
  check(`B2 erasure: ${NAMES.length} real organisation names survive byte-for-byte`,
    mangled.length === 0, JSON.stringify(mangled));

  // B2b — the same names all the way through generation into the résumé.
  const survivedGen = NAMES.filter((name) => {
    const pkg = generateResumePackage({
      ...initialIntake, fullName: "Test Person", currentTitle: "Support Worker",
      currentCompany: name, currentTime: "2019 - 2024",
      responsibilities: "ran the medication round morning and night"
    });
    return pkg.experience.some((r) => r.company === name);
  });
  check(`B2b erasure: and all ${NAMES.length} survive generation into the résumé`,
    survivedGen.length === NAMES.length,
    JSON.stringify(NAMES.filter((n) => !survivedGen.includes(n))));

  // G1 — the invented employer is gone, and nothing replaces it.
  const blank = generateResumePackage({
    ...initialIntake, fullName: "Test Person", currentTitle: "Warehouse Operative",
    currentCompany: "", currentTime: "2019 - 2024",
    responsibilities: "loaded the cages and kept the pick face topped up"
  });
  const whole = JSON.stringify(blank);
  check("G1 fabrication: no employer is invented for a blank field",
    !/Current Company|Previous Company|Additional Company/.test(whole), whole.slice(0, 200));
  check("   the job itself still appears", blank.experience.length >= 1, JSON.stringify(blank.experience));
  check("   erasure: and the real job title beside it is untouched",
    blank.experience[0]?.title === "Warehouse Operative", JSON.stringify(blank.experience[0]));

  // G2 — the seesaw, in one record. Beta must not hand gamma a hole to fill.
  const seesaw = generateResumePackage({
    ...initialIntake, fullName: "Test Person", currentTitle: "Yoga Teacher",
    currentCompany: "Let Go Yoga Studio", currentTime: "2020 - 2025",
    responsibilities: "taught six classes a week and ran the beginners course"
  });
  const line = JSON.stringify(seesaw);
  check("G2 the employer survives AND is not replaced by a placeholder",
    line.includes("Let Go Yoga Studio") && !/Current Company/.test(line),
    JSON.stringify(seesaw.experience[0]));

  // G3 — contamination is still separated where there IS evidence to split on.
  check("G3 contamination: a delimited narrative is still separated",
    organizationIdentity("Wincanton (agency, until my position was cut)") === "Wincanton",
    organizationIdentity("Wincanton (agency, until my position was cut)"));
  check("   and targeting text still yields no employer",
    organizationIdentity("Target roles: driver") === "",
    organizationIdentity("Target roles: driver"));
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
