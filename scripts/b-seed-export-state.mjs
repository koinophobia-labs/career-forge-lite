// Builds a seeded command-center state with a forged pack, printed as JSON.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = process.cwd();
const moduleCache = new Map();
function loadTsModule(filePath) {
  const absolute = path.resolve(filePath);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute });
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

const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { mergeIntakeIntoDossier } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));

const NOW = new Date().toISOString();
const withIdentity = process.argv.includes("--with-identity");
const intake = { ...initialIntake, fullName: withIdentity ? "Riley Example" : "", email: withIdentity ? "riley@example.com" : "", phone: "555-0100", website: "", targetJobTitle: "Product Support Specialist", currentTitle: "Retail Associate", currentCompany: "ShopCo", currentTime: "2022–Present", tools: "Zendesk, Excel", responsibilities: "Resolved customer questions\nDocumented escalations", outcomes: "Improved handoff clarity until I was laid off in June 2026", customersServed: "40+ customers per shift", education: "Associate degree" };
const dossier = mergeIntakeIntoDossier(emptyState().dossier, intake, "guided", true, "guided source", NOW);
const lanes = [{ id: "lane-0", title: "Product Support", status: "active", whyFit: "Verified fit", resumeAngle: "Angle", proof: [], gaps: [], keywords: ["Zendesk"], source: "custom", createdAt: NOW }];
const pack = generateResumePack(dossier, lanes, NOW);
// A saved version whose resumeText is ONLY the summary sentence (the audited
// copy-plain-text bug shape) but which carries a full snapshot — /versions/view
// must copy the whole document from the snapshot, not the stale text.
const snapshot = {
  fullName: intake.fullName,
  email: intake.email,
  phone: intake.phone,
  website: "",
  template: "Modern ATS",
  resume: {
    summary: "Product Support candidate with retail operations experience.",
    coreSkills: ["Zendesk", "Excel", "Documentation"],
    experience: [{ title: "Retail Associate", company: "ShopCo", time: "2022–Present", bullets: ["Resolved customer questions", "Documented escalations"] }],
    education: "Associate degree",
    linkedinHeadline: "",
    linkedinSummary: ""
  }
};
const version = {
  id: "version-snapshot-1", label: "Product Support — tailored", laneId: "lane-0", notes: "", source: "tailor",
  applicationId: null, targetCompany: "Acme", targetTitle: "Product Support Specialist", keywordsUsed: [], gapsAcknowledged: [],
  influenceSummary: "", resumeText: snapshot.resume.summary, resumeSnapshot: snapshot, createdAt: NOW
};
const state = { ...emptyState(), dossier, lanes, resumePacks: [pack], resumeVersions: [version] };
process.stdout.write(JSON.stringify(state));
