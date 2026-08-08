// Runs INSIDE the pre-fix worktree (6b4b66c). Builds clean dossiers, pushes
// them through the OLD sanitizeCommandCenterState, and writes out whatever the
// old build actually did to them. The output is real scar tissue, not a model
// of it.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = process.cwd();
const cache = new Map();
function load(fp) {
  const a = path.resolve(fp);
  if (cache.has(a)) return cache.get(a).exports;
  const { outputText } = ts.transpileModule(fs.readFileSync(a, "utf8"), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: a
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

const { emptyDossier, evidenceRecord } = load("src/lib/dossier.ts");
const { sanitizeCommandCenterState } = load("src/lib/evidence-admissibility.ts");

const NOW = "2026-08-01T09:00:00.000Z";

const role = (over) => ({
  id: "r1", title: "", employer: "", startDate: "", endDate: "", current: false,
  responsibilities: [], tools: [], outcomes: [], evidenceIds: [], ...over
});

const version = (id, experience) => ({
  id, label: "saved", laneId: null, notes: "", source: "builder", applicationId: null,
  targetCompany: "", targetTitle: "", keywordsUsed: [], gapsAcknowledged: [], influenceSummary: "",
  resumeText: "", createdAt: NOW,
  resumeSnapshot: {
    fullName: "Dee Okafor", email: "dee@example.com", phone: "", website: "", template: "Modern ATS",
    resume: { summary: "", coreSkills: [], experience, education: "", linkedinHeadline: "", linkedinSummary: "" }
  }
});

const state = (dossier, resumeVersions = []) => ({
  dossier, profile: {}, lanes: [], applications: [], resumePacks: [], roleSprints: [],
  pendingImportReviews: [], resumeVersions
});

const ev = (detail, roleId) => evidenceRecord("responsibility", detail, "guided", true, NOW, { roleId });

// ---------------------------------------------------------------------------
// The four cases. Employers and titles chosen because the OLD classifier reads
// them as gaps — these are real organisation names, not contrived strings.
const CASES = {
  // 1. Unambiguous history exists in a saved snapshot -> should recover exactly.
  recoverable: (() => {
    const e = ev("did the medication round morning and night", "r1");
    return state(
      { ...emptyDossier(NOW), evidence: [e],
        roles: [role({ id: "r1", title: "Recovery Support Worker", employer: "No Boundaries Training Ltd",
                       startDate: "2018", endDate: "2024", evidenceIds: [e.id] })] },
      [version("v1", [{ title: "Recovery Support Worker", company: "No Boundaries Training Ltd", time: "2018 - 2024", bullets: [] }])]
    );
  })(),

  // 2. Two snapshots disagree -> should offer candidates, restore nothing.
  conflicting: (() => {
    const e = ev("ran the午 after-school club every weekday", "r1");
    return state(
      { ...emptyDossier(NOW), evidence: [e],
        roles: [role({ id: "r1", title: "Recovery Support Worker", employer: "No Boundaries Training Ltd",
                       startDate: "2018", endDate: "2024", evidenceIds: [e.id] })] },
      [version("v1", [{ title: "Recovery Support Worker", company: "No Boundaries Training Ltd", time: "2018 - 2024", bullets: [] }]),
       version("v2", [{ title: "Recovery Support Worker", company: "No Boundaries Ltd", time: "2018 - 2024", bullets: [] }])]
    );
  })(),

  // 3. No history at all -> must be marked, preserved, and NOT invented.
  unrecoverable: (() => {
    const e = ev("managed inventory for a regional gym chain", "r1");
    return state(
      { ...emptyDossier(NOW), evidence: [e],
        roles: [role({ id: "r1", title: "Support Worker", employer: "No Boundaries Training Ltd",
                       startDate: "2016", endDate: "2019", evidenceIds: [e.id] })] },
      []
    );
  })(),

  // 4. Control: an ordinary employer the old build leaves alone.
  control: (() => {
    const e = ev("ran the pot wash through every service", "r1");
    return state(
      { ...emptyDossier(NOW), evidence: [e],
        roles: [role({ id: "r1", title: "Kitchen Porter", employer: "The Bell Inn",
                       startDate: "2021", endDate: "2024", evidenceIds: [e.id] })] },
      []
    );
  })()
};

const out = {};
for (const [name, before] of Object.entries(CASES)) {
  const after = sanitizeCommandCenterState(JSON.parse(JSON.stringify(before)));
  const b = before.dossier.roles[0];
  const a = after.dossier.roles[0];
  out[name] = {
    truth: { title: b.title, employer: b.employer, startDate: b.startDate, endDate: b.endDate },
    damagedState: after,
    damaged: a ? { title: a.title, employer: a.employer } : null,
    roleSurvived: Boolean(a)
  };
  console.log(`${name.padEnd(14)} typed(${JSON.stringify(b.title)}, ${JSON.stringify(b.employer)}) -> old build produced ${a ? JSON.stringify([a.title, a.employer]) : "ROLE DELETED"}`);
}

const dest = "/private/tmp/claude-501/-Users-koi/31b47771-1641-4a90-a1a6-7bf18cd00818/scratchpad/scar-tissue.json";
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log("\nwrote", dest);
