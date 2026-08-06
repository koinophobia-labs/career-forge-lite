// Closure-audit regressions (2026-08-05): pins the launch-audit generator
// repairs. Each case failed on the pre-fix code:
//   1. "refunds" evidence fabricated an "Assisted customers with returns." bullet.
//   2. Naming tools ("POS Systems, Cash Drawer") fabricated "Processed payments"
//      activity and a "Cash Handling" skill with no described work.
//   3. The industry chip ("Retail") was rendered as a duty and fused into
//      invented "Supported …" bullets.
//   4. toResumeVoice stripped every mid-sentence "my", exporting broken English
//      ("It was job to reconcile the drawer").
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const moduleCache = new Map();

function loadTsModule(filePath) {
  const absolute = path.resolve(filePath);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: absolute
  });
  const cjsModule = { exports: {} };
  moduleCache.set(absolute, cjsModule);
  const dirname = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`));
    if (request.startsWith(".")) return loadTsModule(path.resolve(dirname, request.endsWith(".ts") ? request : `${request}.ts`));
    return require(request);
  };
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, cjsModule, cjsModule.exports, dirname, absolute);
  return cjsModule.exports;
}

const { generateResumePackage } = loadTsModule(path.join(root, "src/lib/generator.ts"));
const { toResumeVoice } = loadTsModule(path.join(root, "src/lib/truth-guards.ts"));
const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));

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

const intake = (overrides) => ({ ...initialIntake, ...overrides });
const packageText = (pkg) => JSON.stringify(pkg).toLowerCase();

// --- 1. refunds evidence must not fabricate a "returns" claim ----------------------
{
  const pkg = generateResumePackage(
    intake({
      currentTitle: "Retail Associate",
      currentCompany: "Big Box Store",
      currentTime: "2022 - Present",
      targetJobTitle: "Customer Service Associate",
      responsibilities: "Handled customer complaints and refunds."
    })
  );
  const bullets = pkg.experience.flatMap((role) => role.bullets);
  check(
    'refunds evidence never emits "Assisted customers with returns."',
    !bullets.some((b) => /assisted .*with .*returns/i.test(b)),
    JSON.stringify(bullets)
  );
  check(
    "the refunds evidence itself still reaches the document",
    packageText(pkg).includes("refunds"),
    packageText(pkg).slice(0, 200)
  );
}

// --- 2. tool names alone must not fabricate activity or skill claims ---------------
{
  const pkg = generateResumePackage(
    intake({
      currentTitle: "Retail Associate",
      currentCompany: "Big Box Store",
      currentTime: "2022 - Present",
      targetJobTitle: "Customer Service Associate",
      responsibilities: "Greeted shoppers at the door.",
      tools: "POS Systems, Cash Drawer"
    })
  );
  const text = packageText(pkg);
  const bullets = pkg.experience.flatMap((role) => role.bullets);
  check(
    "tool names alone never emit a 'Processed payments' activity bullet",
    !bullets.some((b) => /processed .*payments/i.test(b)),
    JSON.stringify(bullets)
  );
  check(
    "tool names alone never mint a 'Cash Handling' skill",
    !pkg.coreSkills.some((s) => /cash handling/i.test(s)),
    JSON.stringify(pkg.coreSkills)
  );
  check("the tools still appear as tools", text.includes("pos"), text.slice(0, 300));
}

// --- 3. the industry chip is a sector, not a duty ----------------------------------
{
  const pkg = generateResumePackage(
    intake({
      currentTitle: "Shift Supervisor",
      currentCompany: "Fresh Market Grocery",
      currentTime: "2021 - 2024",
      targetJobTitle: "Assistant Store Manager",
      responsibilities: "Trained 4 new cashiers on the register system.",
      customRoleIndustry: "Retail"
    })
  );
  const bullets = pkg.experience.flatMap((role) => role.bullets);
  check(
    "the industry chip never appears as its own duty bullet",
    !bullets.some((b) => /^(supported\s+)?retail\.?$/i.test(b.trim()) || /supported .*\bretail\b/i.test(b)),
    JSON.stringify(bullets)
  );
}

// --- 4. mid-sentence possessives survive résumé voice ------------------------------
check(
  'toResumeVoice keeps mid-sentence "my" intact',
  toResumeVoice("It was my job to reconcile the drawer.") === "It was my job to reconcile the drawer.",
  JSON.stringify(toResumeVoice("It was my job to reconcile the drawer."))
);
check(
  'toResumeVoice keeps "Reported to my manager and the shift lead." verbatim',
  toResumeVoice("Reported to my manager and the shift lead.") === "Reported to my manager and the shift lead.",
  JSON.stringify(toResumeVoice("Reported to my manager and the shift lead."))
);
check(
  'toResumeVoice still lifts a leading "My"',
  toResumeVoice("My duties included closing the store.") === "Duties included closing the store.",
  JSON.stringify(toResumeVoice("My duties included closing the store."))
);
check(
  'toResumeVoice still lifts a leading "I managed"',
  toResumeVoice("I managed the front end.") === "Managed the front end.",
  JSON.stringify(toResumeVoice("I managed the front end."))
);

// --- 5. "Clear local data" clears every registered key ------------------------------
// Pre-fix, the settings page enumerated five keys by hand: interview
// transcripts, practice answers, beta feedback (with self-identifying
// testimonials), and application activity survived a clear the privacy page
// describes as removing every Career Forge record.
{
  const { CAREER_DATA_KEYS, IDENTITY_BOUND_KEYS, PRESERVED_KEYS, clearCareerDataKeys, clearIdentityBoundKeys } =
    loadTsModule(path.join(root, "src/lib/local-keys.ts"));

  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    }
  };

  // Every key any module actually persists, discovered from source so a newly
  // added key that is never registered fails this test instead of leaking
  // silently. Only constants passed to a localStorage call count — a DOM event
  // name or a JSON schema string that happens to start "career-forge-" is not
  // a storage key.
  const sourceFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) sourceFiles.push(full);
    }
  };
  walk(path.join(root, "src"));

  const constantValues = new Map();
  const usedInStorage = new Set();
  const literalKeys = new Set();
  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, "utf8");
    for (const m of source.matchAll(/(?:export\s+)?const\s+(\w+)\s*=\s*"(career-forge-[a-z0-9-]+)"/g)) {
      constantValues.set(m[1], m[2]);
    }
    for (const m of source.matchAll(/localStorage\.(?:get|set|remove)Item\(\s*(?:(\w+)|"(career-forge-[a-z0-9-]+)")/g)) {
      if (m[1]) usedInStorage.add(m[1]);
      if (m[2]) literalKeys.add(m[2]);
    }
  }
  const declaredKeys = new Set([
    ...literalKeys,
    ...[...usedInStorage].map((name) => constantValues.get(name)).filter(Boolean)
  ]);
  check("the key scan found the known storage keys", declaredKeys.size >= 8, `found: ${[...declaredKeys].join(", ")}`);
  const registered = new Set([...CAREER_DATA_KEYS, ...PRESERVED_KEYS]);
  const unregistered = [...declaredKeys].filter((key) => !registered.has(key));
  check(
    "every career-forge-* key in src/lib is registered in local-keys.ts",
    unregistered.length === 0,
    `unregistered: ${unregistered.join(", ")}`
  );

  for (const key of declaredKeys) store.set(key, JSON.stringify({ sensitive: "termination and immigration details" }));
  clearCareerDataKeys();

  const survivors = [...store.keys()];
  check(
    "clearing leaves only the license key",
    survivors.length === PRESERVED_KEYS.length && survivors.every((key) => PRESERVED_KEYS.includes(key)),
    `survivors: ${survivors.join(", ")}`
  );
  check("interview practice answers do not survive a clear", !store.has("career-forge-prep-drafts-v1"));
  check("beta feedback and testimonials do not survive a clear", !store.has("career-forge-beta-feedback-v1"));
  check("application activity does not survive a clear", !store.has("career-forge-application-activity-v1"));
  check("an activated license IS preserved by a clear", store.has("career-forge-license-v1"));

  // --- 6. Restore does not leave the previous person's own words behind -------------
  for (const key of declaredKeys) store.set(key, JSON.stringify({ owner: "Alex Rivera", detail: "terminated from Acme" }));
  clearIdentityBoundKeys();
  for (const key of IDENTITY_BOUND_KEYS) {
    check(`restore clears identity-bound key ${key}`, !store.has(key));
  }
  check("restore does not clear the license", store.has("career-forge-license-v1"));

  delete globalThis.window;
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
