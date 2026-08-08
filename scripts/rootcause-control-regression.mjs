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
const { emptyDossier, evidenceRecord, resolveDisclosure } = load(path.join(root, "src/lib/dossier.ts"));

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

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
