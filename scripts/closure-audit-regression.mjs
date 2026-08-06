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
const { emptyDossier, evidenceRecord, resolveDisclosure, intakeEligibleForGeneration, pendingDisclosureReviews } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { disclosureResolutionIsStale, isUsableEvidence, needsDisclosureReview } = loadTsModule(path.join(root, "src/lib/evidence-admissibility.ts"));
const { mergeIntakeIntoDossier } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { sanitizeResumeForProfessionalUse } = loadTsModule(path.join(root, "src/lib/evidence-admissibility.ts"));
const { resumeToText } = loadTsModule(path.join(root, "src/lib/resume-export.ts"));
const { withholdSeparationFromGeneratedProse, possibleDisclosure } = loadTsModule(path.join(root, "src/lib/truth-guards.ts"));

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

// --- 7. The job posting must not supply its own evidence -----------------------------
// In a tailored session intake.targetJobTitle IS the posting's title, so
// including it in the evidence corpus let the employer's ad add "Store
// Manager" to CORE SKILLS and "hands-on experience in store manager" to the
// summary of a user who had never held the role.
{
  const { buildEvidenceCorpus } = loadTsModule(path.join(root, "src/lib/tailored-resume.ts"));
  const corpus = buildEvidenceCorpus(
    intake({
      targetJobTitle: "Assistant Store Manager",
      currentTitle: "Shift Supervisor",
      currentCompany: "Fresh Market Grocery",
      responsibilities: "Trained 4 new cashiers on the register system.",
      education: "Certified Public Accountant"
    })
  );
  check("the posting's own title is not evidence", !corpus.includes("assistant store manager"), corpus.slice(0, 200));
  check("a credential is not a description of work performed", !corpus.includes("certified public accountant"), corpus.slice(0, 200));
  check("the user's own role and duties remain evidence", corpus.includes("shift supervisor") && corpus.includes("trained 4 new cashiers"), corpus.slice(0, 200));
}

// --- 8. The public health endpoint must not publish a bearer credential --------------
// /api/commerce-health is unauthenticated and /api/license treats a Stripe
// session id as a bearer credential: printing the certified session id let
// anyone mint a signed paid license from the certification drill's evidence.
{
  const source = fs.readFileSync(path.join(root, "src/lib/server/fulfillment-readiness.ts"), "utf8");
  check(
    "the certified Stripe session id is never interpolated into a public detail string",
    !/\$\{evidence!?\.checkoutSessionId\}/.test(source),
    "found a raw checkoutSessionId interpolation"
  );
  check(
    "the session reference is a non-reversible digest",
    /sessionDigest\(evidence!?\.checkoutSessionId\)/.test(source) && /createHash\("sha256"\)/.test(source)
  );
  check(
    "the approver's name is not published either",
    !/\$\{approval!?\.approvalActor\}/.test(source),
    "found a raw approvalActor interpolation"
  );
}

// --- 9. Preview edits must reach the saved version record (DS-03) --------------------
// recordResumeVersion ran once inside generate() and the preview's onChange
// only touched React state, so the saved record — and every export and linked
// application derived from it — kept the pre-edit text while /versions/view
// told the user "This is the exact document you generated".
{
  const builderSource = fs.readFileSync(path.join(root, "src/app/resume-builder/page.tsx"), "utf8");
  check(
    "recordResumeVersion returns the id of the record it created",
    /function recordResumeVersion\([\s\S]*?\):\s*string\s*\{/.test(builderSource) && /return versionId;/.test(builderSource)
  );
  check(
    "the builder remembers which version this session recorded",
    /setRecordedVersionId\(/.test(builderSource) && /const \[recordedVersionId/.test(builderSource)
  );
  check(
    "preview edits are written back to that same record",
    /resumeVersions: state\.resumeVersions\.map\(\(version\) =>[\s\S]*?version\.id === recordedVersionId/.test(builderSource)
  );
  check(
    "the write-back is debounced rather than firing per keystroke",
    /setTimeout\([\s\S]*?\}, 600\)/.test(builderSource) && /clearTimeout\(handle\)/.test(builderSource)
  );

  // The tailored path must accept the caller's id, or the write-back targets
  // a record that does not exist.
  const handoffSource = fs.readFileSync(path.join(root, "src/lib/tailor-handoff.ts"), "utf8");
  check(
    "recordTailoredResumeVersion accepts a caller-supplied version id",
    /providedVersionId\?: string/.test(handoffSource) && /providedVersionId \?\? createId\("resume"\)/.test(handoffSource)
  );
}

// --- 10. A deleted duty must stop printing (DS-02) -----------------------------------
// BEHAVIOURAL, not a source scan: build a dossier, generate the pack, delete a
// duty the way the /profile editor does, regenerate, and assert the bullet is
// gone from the real generated output. Pre-fix the editor wrote only
// role.responsibilities while the generator also read role-owned evidence, so
// the removed duty came back with the receipt certifying it as "direct".
{
  const { withRoleResponsibilitiesEdited, evidenceRecord, emptyDossier } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
  const { generateResumePack } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));

  const NOW = "2026-08-06T00:00:00.000Z";
  const DUTIES = [
    "Reconciled the cash drawer at close.",
    "Trained 4 new cashiers on the register system.",
    "Made weekly schedules for a team of 6."
  ];
  const roleId = "role-fmg";
  const evidence = DUTIES.map((detail) =>
    evidenceRecord("responsibility", detail, "manual", true, NOW, { label: "Role responsibility", roleId })
  );
  const base = {
    ...emptyDossier(NOW),
    identity: { fullName: "Jordan Reyes", email: "jordan@example.com", phone: "", location: "", links: [] },
    roles: [
      {
        id: roleId,
        title: "Shift Supervisor",
        employer: "Fresh Market Grocery",
        startDate: "2021-2024",
        endDate: "",
        current: false,
        responsibilities: [...DUTIES],
        tools: [],
        outcomes: [],
        evidenceIds: evidence.map((item) => item.id)
      }
    ],
    evidence,
    responsibilities: [...DUTIES],
    approvedClaims: [...DUTIES]
  };
  const lanes = [{
    id: "lane-1", title: "Retail Shift Supervisor", status: "active", whyFit: "", resumeAngle: "",
    proof: [], gaps: [], keywords: [], source: "custom", createdAt: NOW
  }];
  const packText = (dossier) => JSON.stringify(generateResumePack(dossier, lanes, NOW));

  const before = packText(base);
  check("the duty prints before it is deleted", before.includes("Trained 4 new cashiers on the register system"), before.slice(0, 200));

  const edited = withRoleResponsibilitiesEdited(base, roleId, [DUTIES[0], DUTIES[2]], NOW);
  const after = packText(edited);
  check(
    "a deleted duty does not print after the edit",
    !after.includes("Trained 4 new cashiers on the register system"),
    after.slice(0, 400)
  );
  check(
    "the duties the user kept still print",
    after.includes("Reconciled the cash drawer at close") && after.includes("Made weekly schedules for a team of 6"),
    after.slice(0, 400)
  );
  check(
    "the removed duty is rejected, not destroyed (restorable)",
    edited.evidence.some((item) => item.detail === DUTIES[1] && item.rejected && !item.approved),
    JSON.stringify(edited.evidence.map((item) => [item.detail.slice(0, 30), item.approved, item.rejected]))
  );
  // The role KEEPS the link and exclusion is carried by the rejected flag.
  // Stripping the id orphaned the record so that neither documented restore
  // path could bring the duty back — the user could not recover their own
  // text. What must hold is that it does not PRINT and stays restorable.
  check(
    "the removed evidence stays linked so it can be restored",
    edited.roles[0].evidenceIds.length === 3,
    JSON.stringify(edited.roles[0].evidenceIds)
  );
  check(
    "restoring the rejected record makes the duty print again",
    (() => {
      const target = edited.evidence.find((item) => item.detail === DUTIES[1]);
      const restored = { ...edited, evidence: edited.evidence.map((item) => (item.id === target.id ? { ...item, approved: true, rejected: false } : item)) };
      return packText(restored).includes("Trained 4 new cashiers on the register system");
    })(),
    "restore-and-approve did not bring the duty back"
  );
  check(
    "retyping the duty also restores it",
    packText(withRoleResponsibilitiesEdited(edited, roleId, DUTIES, NOW)).includes("Trained 4 new cashiers on the register system"),
    "retyping did not bring the duty back"
  );
  check(
    "the removed duty leaves approvedClaims and the responsibility pool",
    !edited.approvedClaims.includes(DUTIES[1]) && !edited.responsibilities.includes(DUTIES[1])
  );
  // Control: the ORIGINAL editor behaviour — update role.responsibilities and
  // leave the evidence untouched — must still print the deleted duty. This is
  // what makes the assertions above meaningful rather than vacuous.
  const naiveEdit = {
    ...base,
    roles: base.roles.map((item) => (item.id === roleId ? { ...item, responsibilities: [DUTIES[0], DUTIES[2]] } : item))
  };
  check(
    "control: the pre-fix edit path DOES resurrect the deleted duty",
    packText(naiveEdit).includes("Trained 4 new cashiers on the register system"),
    "the control no longer reproduces the bug — this test would pass vacuously"
  );

  // Re-running the same edit must not churn state (the editor saves on every submit).
  const twice = withRoleResponsibilitiesEdited(edited, roleId, [DUTIES[0], DUTIES[2]], NOW);
  check(
    "repeating the edit is idempotent",
    twice.roles[0].evidenceIds.length === edited.roles[0].evidenceIds.length &&
      twice.evidence.length === edited.evidence.length &&
      twice.evidence.filter((item) => item.rejected).length === edited.evidence.filter((item) => item.rejected).length,
    JSON.stringify([twice.roles[0].evidenceIds.length, twice.evidence.length, edited.evidence.length])
  );
}

// --- 11. Commerce posture: "off" means no checkout, and no paid-state copy ----------
// PE-04: the non-live branch of /api/checkout applied NONE of the safety gates
// (no sell verdict, no tier restriction), so with commerce off — the public
// beta posture, and the fallback for any typo in NEXT_PUBLIC_COMMERCE_MODE — a
// direct POST could create a real Stripe session for any tier while the UI
// truthfully said "No purchases enabled".
{
  const checkoutSource = fs.readFileSync(path.join(root, "src/app/api/checkout/route.ts"), "utf8");
  check(
    "checkout refuses outright when commerce is off",
    /getCommerceMode\(\) === "off"[\s\S]{0,160}status: 503/.test(checkoutSource),
    "no unconditional off-mode guard found"
  );
  // Compare against the CALL, not the import line at the top of the file.
  const offGuardIndex = checkoutSource.indexOf('getCommerceMode() === "off"');
  const firstCallIndex = checkoutSource.search(/await createCheckoutSession\(/);
  check(
    "the off guard runs before any session can be created",
    offGuardIndex > -1 && firstCallIndex > -1 && offGuardIndex < firstCallIndex,
    `guard@${offGuardIndex} call@${firstCallIndex}`
  );

  // PE-01: /founding-beta advertised a live $49 checkout unconditionally while
  // /pricing said "No purchases enabled" and the gate was closed.
  const foundingSource = fs.readFileSync(path.join(root, "src/app/founding-beta/page.tsx"), "utf8");
  check(
    "founding-beta reads the commerce posture",
    /getCommerceMode\(\) !== "off"/.test(foundingSource)
  );
  check(
    'no unconditional "Secure checkout is live" claim',
    !/^\s*Secure checkout is live\./m.test(foundingSource),
    "found an unconditional live-checkout claim"
  );
  check(
    "the paid CTA and the price framing are both conditional",
    /purchasesEnabled && \(/.test(foundingSource) && /purchasesEnabled\s*\?/.test(foundingSource)
  );
}

// --- 12. With commerce off nothing is gated and no paywall renders -------------------
{
  // The parser lives in a server-safe module so server components can read the
  // posture too; entitlement.ts re-exports it for client callers.
  const modeSource = fs.readFileSync(path.join(root, "src/lib/commerce-mode.ts"), "utf8");
  check(
    "an unrecognised commerce mode falls back to off, never to live",
    /if \(raw === "test" \|\| raw === "live"\) return raw;[\s\S]{0,40}return "off";/.test(modeSource)
  );
  check(
    "the mode parser is server-safe (not a client module)",
    !/^\s*"use client"/m.test(modeSource)
  );
  const entitlementSource = fs.readFileSync(path.join(root, "src/lib/entitlement.ts"), "utf8");
  check(
    "there is exactly one commerce-mode parser",
    !/function getCommerceMode\(\)/.test(entitlementSource) && /export \{ getCommerceMode \} from "@\/lib\/commerce-mode"/.test(entitlementSource)
  );
  check(
    "commerce off grants every feature (no lock UI can render)",
    /if \(!commerceEnabled\) return true;/.test(entitlementSource)
  );
}

// --- 13. A failed save must not discard later edits (DS-01 / RELY-01) ---------------
// updateCommandCenter always rebased on what was ON DISK. After one quota
// failure the next edit rebased on the last state that saved, silently
// throwing away everything done since — in the UI as well as on disk.
{
  const storeModule = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
  const { updateCommandCenter, hasUnsavedWork } = loadTsModule(path.join(root, "src/lib/use-command-center.ts"));

  const disk = new Map();
  let failWrites = false;
  globalThis.window = {
    localStorage: {
      getItem: (key) => (disk.has(key) ? disk.get(key) : null),
      setItem: (key, value) => {
        if (failWrites) {
          const error = new Error("QuotaExceededError");
          error.name = "QuotaExceededError";
          throw error;
        }
        disk.set(key, String(value));
      },
      removeItem: (key) => disk.delete(key)
    },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  globalThis.CustomEvent = class {
    constructor(type) {
      this.type = type;
    }
  };

  const label = (state) => (state.lanes[0] ? state.lanes[0].title : "");
  const addLane = (title) => (state) => ({
    ...state,
    lanes: [{ id: "lane-1", title, status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "custom", createdAt: "2026-08-06T00:00:00.000Z" }]
  });

  updateCommandCenter(addLane("Edit A"));
  check("a normal save reaches disk", label(storeModule.loadState()) === "Edit A", label(storeModule.loadState()));
  check("no unsaved work is reported after a good save", hasUnsavedWork() === false);

  failWrites = true;
  updateCommandCenter(addLane("Edit B"));
  check("a failed save is reported, not swallowed", hasUnsavedWork() === true);

  // THE DEFECT: the next edit used to rebase on disk (still "Edit A"), so
  // "Edit B" vanished from the visible state as well as from storage.
  updateCommandCenter((state) => ({ ...state, lanes: state.lanes.map((lane) => ({ ...lane, whyFit: "note added after the failure" })) }));
  failWrites = false;
  updateCommandCenter((state) => state);
  check(
    "work done after a failed save survives once storage recovers",
    label(storeModule.loadState()) === "Edit B",
    `disk now holds "${label(storeModule.loadState())}" — the post-failure edit was discarded`
  );
  check("the unsaved flag clears after a successful write", hasUnsavedWork() === false);

  delete globalThis.window;
  delete globalThis.CustomEvent;
}

// --- 14. Responsibility entry is line-based, matching its own field label -----------
// The field says "One recurring responsibility per line", but the parser also
// split on commas, so an ordinary sentence was shredded at INPUT time:
// "Mopped, swept, wiped the front end." became three records and the résumé
// printed the fragments "Mopped" and "Swept" while the remainder fell off the
// bullet cap. A sentence the user wrote is one claim at input as well as at
// generation.
{
  const profileSource = fs.readFileSync(path.join(root, "src/app/profile/page.tsx"), "utf8");
  check(
    "a line-based parser exists for responsibilities",
    /function lines\(text: string\): string\[\] \{[\s\S]{0,160}split\(\/\\n\/\)/.test(profileSource)
  );
  check(
    "every responsibility field uses the line parser, never the comma splitter",
    [...profileSource.matchAll(/responsibilities:?\s*=?\s*(lines|values)\(/g)].every((m) => m[1] === "lines"),
    JSON.stringify([...profileSource.matchAll(/responsibilities:?\s*=?\s*(lines|values)\(/g)].map((m) => m[0]))
  );
  check(
    "comma-separated fields (tools) still split on commas",
    /tools: values\(/.test(profileSource)
  );
  check(
    "the field label still promises one per line",
    /One recurring responsibility per line/.test(profileSource)
  );
}

// ---------------------------------------------------------------------------
// Resolution belongs to the evidence VERSION the user reviewed, not to an id
// that can later contain different text. Blake's regression, run verbatim:
//
//   1. Enter flagged evidence in guided intake.
//   2. Resolve Keep.
//   3. Generate.
//   4. Edit the source sentence.
//   5. Make the edit newly sensitive.
//   6. Confirm the old Keep decision does not silently authorize the changed
//      evidence.
//
// The failure this prevents is the quiet one: a stale "keep" waving through a
// sentence the user has never seen, because the id matched.
{
  const ORIGINAL = "I was laid off after I completed the certification.";
  const EDITED = "I was laid off after my cancer treatment ended.";
  const role = { currentTitle: "Sales Associate", currentCompany: "Northgate", currentTime: "2022 - 2025" };

  // 1. Flagged evidence enters through guided intake.
  let dossier = emptyDossier();
  const record = evidenceRecord("responsibility", ORIGINAL, "guided", true, "2026-08-05T00:00:00.000Z", { roleId: "role-1" });
  dossier = { ...dossier, evidence: [record] };
  check("1. guided intake flags the sentence for review", needsDisclosureReview(dossier.evidence[0]) && !isUsableEvidence(dossier.evidence[0]));
  check("   and it is withheld from generation until resolved",
    !JSON.stringify(generateResumePackage(intake({ ...role, responsibilities: ORIGINAL,
      ...intakeEligibleForGeneration({ ...initialIntake, ...role, responsibilities: ORIGINAL }, dossier) }))).includes("completed the certification"));

  // 2. The user resolves Keep.
  dossier = resolveDisclosure(dossier, record.id, "keep", "2026-08-06T00:00:00.000Z");
  check("2. Keep marks the evidence usable", isUsableEvidence(dossier.evidence[0]) && !needsDisclosureReview(dossier.evidence[0]));

  // 3. Generation now includes their own words.
  const keptIntake = intakeEligibleForGeneration({ ...initialIntake, ...role, responsibilities: ORIGINAL }, dossier);
  check("3. the kept sentence reaches the document",
    JSON.stringify(generateResumePackage(intake({ ...keptIntake, ...role }))).includes("completed the certification"),
    JSON.stringify(keptIntake.disclosureApproved));

  // 4 + 5. The user edits the source sentence, and the edit is newly sensitive.
  dossier = { ...dossier, evidence: [{ ...dossier.evidence[0], detail: EDITED }] };

  // 6. The old decision must NOT carry over to text the user never reviewed.
  check("6. the stale Keep is detected", disclosureResolutionIsStale(dossier.evidence[0]));
  check("   the edited sentence is NOT authorized by it", !isUsableEvidence(dossier.evidence[0]));
  check("   it returns to the review queue", needsDisclosureReview(dossier.evidence[0]) && pendingDisclosureReviews(dossier).length === 1);
  const staleIntake = intakeEligibleForGeneration({ ...initialIntake, ...role, responsibilities: EDITED }, dossier);
  const staleOut = JSON.stringify(generateResumePackage(intake({ ...staleIntake, ...role })));
  check("   and nothing from it is published", !/cancer treatment/i.test(staleOut), staleOut.slice(0, 200));
  check("   while the user's own text is left untouched in storage", dossier.evidence[0].detail === EDITED);

  // Re-resolving the NEW version authorizes the new version only.
  dossier = resolveDisclosure(dossier, record.id, "keep", "2026-08-06T01:00:00.000Z");
  check("   re-reviewing the new version restores it", isUsableEvidence(dossier.evidence[0]) && !disclosureResolutionIsStale(dossier.evidence[0]));
}

// ---------------------------------------------------------------------------
// The ten invariants pinned for the guided path entering the canonical
// evidence lifecycle. Asserted rather than asserted-to-be-true.
{
  const FLAGGED = "I was laid off after I completed the certification.";
  const CLEAN = "Resolved customer escalations and documented the outcome.";
  const NOW = "2026-08-06T00:00:00.000Z";
  const role = { currentTitle: "Sales Associate", currentCompany: "Northgate", currentTime: "2022 - 2025" };
  const guidedIntake = { ...initialIntake, ...role, responsibilities: `${FLAGGED}\n${CLEAN}` };

  // I1. Every meaningful guided statement gets a stable evidence ID before generation.
  const merged = mergeIntakeIntoDossier(emptyDossier(NOW), guidedIntake, "guided", true, "", NOW);
  const flaggedRec = merged.evidence.find((e) => e.detail === FLAGGED);
  const cleanRec = merged.evidence.find((e) => e.detail === CLEAN);
  check("I1. guided statements become identified evidence before generation",
    Boolean(flaggedRec?.id && cleanRec?.id) && flaggedRec.id !== cleanRec.id,
    JSON.stringify(merged.evidence.map((e) => [e.id, e.detail])));

  // I2. Flagging never mutates its text.
  check("I2. flagging leaves the user's text byte-identical", flaggedRec.detail === FLAGGED, flaggedRec.detail);

  // I3. needs_review survives a serialization round trip (refresh / navigation).
  const rehydrated = JSON.parse(JSON.stringify(merged));
  check("I3. needs_review persists across a refresh",
    needsDisclosureReview(rehydrated.evidence.find((e) => e.detail === FLAGGED)),
    JSON.stringify(rehydrated.evidence.find((e) => e.detail === FLAGGED)));

  // I4. An unresolved record reaches NONE of the five downstream surfaces.
  const eligible = intakeEligibleForGeneration(guidedIntake, merged);
  const pkg = generateResumePackage(eligible);
  const surfaces = {
    "résumé": JSON.stringify(pkg.experience) + pkg.summary,
    "LinkedIn": `${pkg.linkedinHeadline}\n${pkg.linkedinSummary}`,
    "skills": JSON.stringify(pkg.coreSkills),
    "export text": resumeToText(eligible, pkg),
    "cover-letter source": JSON.stringify(eligible)
  };
  for (const [name, text] of Object.entries(surfaces)) {
    check(`I4. unresolved evidence never reaches ${name}`, !/laid off|completed the certification/i.test(text), text.slice(0, 160));
  }
  check("I4. …while the unflagged statement still comes through",
    /escalations/i.test(surfaces["résumé"]), surfaces["résumé"].slice(0, 200));

  // I5. Keep makes THAT evidence eligible.
  const keptDossier = resolveDisclosure(merged, flaggedRec.id, "keep", NOW);
  check("I5. Keep makes that exact evidence eligible",
    isUsableEvidence(keptDossier.evidence.find((e) => e.id === flaggedRec.id))
      && /completed the certification/i.test(JSON.stringify(generateResumePackage({ ...initialIntake, ...role, ...intakeEligibleForGeneration(guidedIntake, keptDossier) }))));

  // I6. Exclude keeps the record but marks it ineligible.
  const excludedDossier = resolveDisclosure(merged, flaggedRec.id, "exclude", NOW);
  const excludedRec = excludedDossier.evidence.find((e) => e.id === flaggedRec.id);
  check("I6. Exclude retains the record but makes it ineligible",
    Boolean(excludedRec) && excludedRec.detail === FLAGGED && !isUsableEvidence(excludedRec),
    JSON.stringify(excludedRec));

  // I7. Editing the text reruns classification instead of inheriting a resolution.
  const editedAfterKeep = { ...keptDossier, evidence: keptDossier.evidence.map((e) => e.id === flaggedRec.id ? { ...e, detail: "I was laid off after my treatment ended." } : e) };
  check("I7. an edit does not inherit the old resolution",
    disclosureResolutionIsStale(editedAfterKeep.evidence.find((e) => e.id === flaggedRec.id)),
    JSON.stringify(editedAfterKeep.evidence.find((e) => e.id === flaggedRec.id)));

  // I8. Generated-output withholding is a SEPARATE downstream mechanism: it
  //     acts on product prose regardless of any review state.
  check("I8. generated-prose withholding is independent of review state",
    withholdSeparationFromGeneratedProse(`${FLAGGED} ${CLEAN}`).trim() === CLEAN,
    withholdSeparationFromGeneratedProse(`${FLAGGED} ${CLEAN}`));

  // I9. Receipts keep the three-way distinction.
  const receiptKeys = fs.readFileSync(path.join(root, "src/types/dossier.ts"), "utf8");
  check("I9. receipts distinguish user-excluded / awaiting-review / export-withheld",
    /itemsExcludedByUser/.test(receiptKeys) && /itemsAwaitingReview/.test(receiptKeys) && /generatedSentencesWithheld/.test(receiptKeys));

  // I10. Dossier and guided flows agree on eligibility for equivalent evidence.
  const dossierSide = mergeIntakeIntoDossier(emptyDossier(NOW), { ...initialIntake, ...role, responsibilities: FLAGGED }, "manual", true, "", NOW);
  const guidedSide = mergeIntakeIntoDossier(emptyDossier(NOW), { ...initialIntake, ...role, responsibilities: FLAGGED }, "guided", true, "", NOW);
  const eligibilityOf = (d) => d.evidence.filter((e) => e.detail === FLAGGED).map((e) => [isUsableEvidence(e), needsDisclosureReview(e)]);
  check("I10. dossier and guided produce identical eligibility for equivalent evidence",
    JSON.stringify(eligibilityOf(dossierSide)) === JSON.stringify(eligibilityOf(guidedSide)),
    `${JSON.stringify(eligibilityOf(dossierSide))} vs ${JSON.stringify(eligibilityOf(guidedSide))}`);
}

// ---------------------------------------------------------------------------
// Export sanitization must never amputate the USER'S OWN bullets. Routing
// withholdSeparationFromGeneratedProse through sanitizeProfessionalLine did
// exactly that: the path reaches user résumé bullets via
// sanitizeProfessionalParagraph -> safeParagraphArray -> sanitizeResumeForProfessionalUse,
// and because a role with no surviving bullets is dropped whole, an employer
// and its dates vanished from the DOCX and PDF while the on-screen résumé
// still showed them. Six years of employment, silently deleted, only in the
// delivered file. Independently found by the export lens at 2d0791a.
{
  const resume = {
    summary: "", coreSkills: [], linkedinHeadline: "", linkedinSummary: "", education: "",
    experience: [
      { title: "Warehouse Team Leader", company: "Corran Logistics", timeframe: "2017-2023",
        bullets: ["Ran the loading bay single-handed for the last four months before the store closed."] },
      { title: "Stock Assistant", company: "Ferrybank Foods", timeframe: "2023-2026",
        bullets: ["Cut the pick error rate from 4.1% to 0.9% over two quarters."] }
    ]
  };
  const out = sanitizeResumeForProfessionalUse(resume);
  check("export sanitization never deletes an employer the user worked at",
    out.experience.length === 2 && out.experience[0].company === "Corran Logistics",
    JSON.stringify(out.experience.map((r) => `${r.title} | ${r.company}`)));
  check("  and the user's own bullet is not amputated from the role",
    out.experience[0]?.bullets.some((b) => /loading bay/i.test(b)),
    JSON.stringify(out.experience[0]?.bullets));
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
