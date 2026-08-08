// CLUSTER C — RECOVERY AGAINST REAL SCAR TISSUE.
//
// The control pairs in rootcause-control-regression.mjs prove the migration
// algorithm works on a MODEL of the damage: a role object with an empty
// employer, hand-built to look broken.
//
// This file proves something different and harder. Its fixture was produced by
// running clean dossiers through the PRE-FIX BUILD ITSELF (worktree at
// 6b4b66c, see docs/evidence/cluster-c/make-scar-tissue.mjs). Whatever the old
// Career Forge actually did to a person's employment record is what is loaded
// here — including the parts nobody predicted. Recorded damage:
//
//   typed "No Boundaries Training Ltd" -> old build persisted ""
//   (the TITLE survived; only the employer was destroyed)
//
// A model of the damage would have guessed at that asymmetry. The fixture did
// not have to.
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

const { sanitizeCommandCenterState } = load(path.join(root, "src/lib/evidence-admissibility.ts"));

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

const SCAR = JSON.parse(fs.readFileSync(path.join(root, "docs/evidence/cluster-c/prefix-scar-tissue.json"), "utf8"));
const roleOf = (state) => state.dossier.roles[0];
const reviewFor = (role, field) => (role.structuralReview ?? []).find((r) => r.field === field);

console.log("\n--- the damage the pre-fix build actually did ---");
for (const [name, c] of Object.entries(SCAR)) {
  console.log(`  ${name.padEnd(14)} employer: ${JSON.stringify(c.truth.employer)} -> ${JSON.stringify(c.damaged.employer)}`);
}
// Guard the fixture itself: if a future change stops the old build from being
// the thing that broke these records, these assertions are meaningless.
check("fixture integrity: three cases really are damaged",
  ["recoverable", "conflicting", "unrecoverable"].every((k) => SCAR[k].damaged.employer === "" && SCAR[k].truth.employer),
  JSON.stringify(Object.entries(SCAR).map(([k, v]) => [k, v.damaged.employer])));
check("fixture integrity: the control really is undamaged",
  SCAR.control.damaged.employer === SCAR.control.truth.employer);

// ---------------------------------------------------------------------------
console.log("\n--- 1. the snapshot was damaged too ---");
{
  // EXPECTATION CORRECTED BY THE FIXTURE. The model said: one saved snapshot
  // holds the truth, so recovery restores it exactly. The real scar tissue says
  // otherwise — the pre-fix build blanked the company inside the SAVED SNAPSHOT
  // by the same mechanism it used on the live record:
  //
  //   snapshot -> [("Recovery Support Worker", "")]
  //
  // There is nothing left to recover from. The honest outcome is a refusal, and
  // asserting a successful restore here would be asserting a fantasy. What must
  // hold is that the refusal is explicit and nothing is invented.
  const c = SCAR.recoverable;
  const healed = sanitizeCommandCenterState(JSON.parse(JSON.stringify(c.damagedState)));
  const role = roleOf(healed);
  check("a destroyed employer with a destroyed snapshot is NOT invented", !role.employer, JSON.stringify(role.employer));
  check("  the user is told it cannot be recovered",
    reviewFor(role, "employer")?.status === "unrecoverable", JSON.stringify(role.structuralReview));
  check("  the job, its title and its dates all survive",
    role.title === c.truth.title && role.startDate === c.truth.startDate && role.endDate === c.truth.endDate,
    JSON.stringify([role.title, role.startDate, role.endDate]));

  // Recovery DOES work when an authoritative record actually survived. Same
  // damaged role, with the rendered heading still present in the saved version
  // — which is how real users' data most often looks, because the pre-fix build
  // blanked the structured snapshot while leaving resumeText alone.
  const withRendered = JSON.parse(JSON.stringify(c.damagedState));
  withRendered.resumeVersions[0].resumeText =
    "EXPERIENCE\nRecovery Support Worker | No Boundaries Training Ltd | 2018 - 2024\n- did the medication round morning and night";
  const rescued = roleOf(sanitizeCommandCenterState(withRendered));
  check("a surviving rendered heading DOES restore the employer exactly",
    rescued.employer === "No Boundaries Training Ltd", JSON.stringify(rescued.employer));
  check("  and the repair names its source",
    reviewFor(rescued, "employer")?.status === "recovered" && Boolean(reviewFor(rescued, "employer")?.recoveredFrom),
    JSON.stringify(rescued.structuralReview));
}

// ---------------------------------------------------------------------------
console.log("\n--- 2. a survivor among blanks is not unanimity ---");
{
  // The defect this fixture caught, and the reason real scar tissue is worth
  // generating. History here is:
  //   snapshot 1: company ""                     (destroyed by the old build)
  //   snapshot 2: company "No Boundaries Ltd"
  // One distinct value survives, so it LOOKS unanimous — and the migration
  // silently restored the variant spelling as the confident answer while the
  // true value, which lived in the destroyed snapshot, was gone without a
  // signal. Unanimity may only be claimed when nothing was destroyed.
  const healed = sanitizeCommandCenterState(JSON.parse(JSON.stringify(SCAR.conflicting.damagedState)));
  const role = roleOf(healed);
  const review = reviewFor(role, "employer");
  check("a survivor among destroyed entries is NOT auto-applied", !role.employer, JSON.stringify(role.employer));
  check("  it is offered as a candidate instead",
    review?.status === "candidate" && (review.candidates ?? []).includes("No Boundaries Ltd"), JSON.stringify(review));
  check("  the job itself is preserved", role.title === "Recovery Support Worker", JSON.stringify(role.title));
}

// ---------------------------------------------------------------------------
console.log("\n--- 3. unrecoverable — the refusal ---");
{
  const healed = sanitizeCommandCenterState(JSON.parse(JSON.stringify(SCAR.unrecoverable.damagedState)));
  const role = roleOf(healed);
  check("the role survives even though its employer cannot be recovered", Boolean(role), JSON.stringify(healed.dossier.roles));
  check("  the missing field is marked for the user",
    reviewFor(role, "employer")?.status === "unrecoverable", JSON.stringify(role.structuralReview));
  check("  FABRICATION CONTROL: no employer is invented", !role.employer, JSON.stringify(role.employer));
  // The bullet says "managed inventory for a regional gym chain". Knowing that
  // does not tell anyone the company was No Boundaries Training Ltd.
  check("  and it is NOT reconstructed from the bullet text",
    !JSON.stringify(role).includes("No Boundaries"), JSON.stringify(role));
}

// ---------------------------------------------------------------------------
console.log("\n--- 4. control — an undamaged record is left alone ---");
{
  const before = JSON.parse(JSON.stringify(SCAR.control.damagedState));
  const healed = sanitizeCommandCenterState(JSON.parse(JSON.stringify(before)));
  const role = roleOf(healed);
  check("an undamaged employer is untouched", role.employer === "The Bell Inn", JSON.stringify(role.employer));
  check("  and gains no review markers", role.structuralReview === undefined, JSON.stringify(role.structuralReview));
}

// ---------------------------------------------------------------------------
console.log("\n--- 5. idempotency on the real damage ---");
{
  for (const name of ["recoverable", "conflicting", "unrecoverable", "control"]) {
    const once = sanitizeCommandCenterState(JSON.parse(JSON.stringify(SCAR[name].damagedState)));
    const twice = sanitizeCommandCenterState(JSON.parse(JSON.stringify(once)));
    check(`running the migration twice changes nothing — ${name}`,
      JSON.stringify(roleOf(once)) === JSON.stringify(roleOf(twice)),
      JSON.stringify({ once: roleOf(once), twice: roleOf(twice) }));
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
