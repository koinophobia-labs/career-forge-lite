import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
function load(filePath) {
  const absolute = path.resolve(filePath);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute });
  const mod = { exports: {} };
  cache.set(absolute, mod);
  const localRequire = (request) => request.startsWith("@/")
    ? load(path.join(root, "src", `${request.slice(2)}.ts`))
    : request.startsWith(".") ? load(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`)) : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, mod, mod.exports, path.dirname(absolute), absolute);
  return mod.exports;
}

const story = load(path.join(root, "src/lib/story-facts.ts"));
const storyMode = load(path.join(root, "src/lib/story-mode.ts"));
const dossier = load(path.join(root, "src/lib/dossier.ts"));
const store = load(path.join(root, "src/lib/command-center-store.ts"));
const backup = load(path.join(root, "src/lib/backup.ts"));
const ats = load(path.join(root, "src/lib/ats.ts"));
const { initialIntake } = load(path.join(root, "src/lib/career-data.ts"));

const FIXTURES = {
  A: "I worked at a neighborhood café for a few years, but I am not sure of the exact start month. I handled customers and trained newer workers. I do not know any numerical metrics. I built a volunteer spreadsheet project to organize community donations. After leaving the café, I took time away during a career transition. I am now moving toward product operations.",
  B: "I worked at Northstar as an operations assistant around 2021 and left in late 2022. I was there two or three years and do not remember the exact months. I am currently building a personal inventory app.",
  C: "I worked at Beacon as a coordinator from 2021 to 2024. I handled customer calls and prepared reports. We did not track numbers and I cannot quantify the result.",
  D: "I helped with scheduling and customer calls in my family business. I had no formal title. The dates were around 2020. I built a scheduling process improvement project.",
  E: "I built a volunteer spreadsheet project using Google Sheets for a food pantry around 2022. I created a community event coordination project using Trello in late 2023. Both were unpaid.",
  F: "I worked at Harbor Shop as a sales associate from 2019 to 2021. I took time away after the store closed. During that gap I built a portfolio website project. I returned to job searching and want to move into support operations.",
  G: "I worked at Atlas as a service associate starting in 2020. Later I remembered it may have been 2021. I handled customer questions. I am not sure whether my title was lead or supervisor.",
  H: "I worked at Corner Shop as a helper for a short time. I stocked shelves. I do not know any metrics.",
  I: "I worked at HelpCo as a customer service representative from 2022 to 2024. I want to move into product operations and want to learn SQL and analytics.",
  J: "I built a personal budgeting app project around 2023. I created a volunteer food-pantry spreadsheet project. I completed community college coursework and used JavaScript and Excel.",
  K: "Around 2021 I worked at a local store, but I do not remember the month, where I handled customers and trained a new worker; I also built a volunteer spreadsheet project, took time away, and now want to move into operations.",
  L: "I worked at Private Studio as an assistant in 2022 and organized client files."
};

let passed = 0;
let failed = 0;
function check(label, condition, detail = "") {
  if (condition) { passed += 1; console.log(`PASS ${label}`); }
  else { failed += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
const parse = (key) => story.parseStoryFacts(FIXTURES[key]);
const facts = (contract, category) => contract.facts.filter((item) => item.category === category);
const confirm = (contract) => ({ ...contract, facts: contract.facts.map((item) => ({ ...item, disposition: item.disposition === "intentionally-omitted" || item.disposition === "user-rejected" ? item.disposition : "user-confirmed", reviewRequired: false })) });
const noSilentLoss = (contract) => contract.silentlyLostCount === 0 && contract.facts.every((item) => item.disposition);

const A = parse("A");
check("01 café employer is segmented", facts(A, "employer")[0]?.candidateValue === "Neighborhood Café", facts(A, "employer")[0]?.candidateValue);
check("02 uncertainty is absent from employer", !/few years|not sure|month/i.test(facts(A, "employer")[0]?.candidateValue ?? ""));
check("03 no title is invented", facts(A, "title").every((item) => !item.candidateValue));
check("04 approximate duration remains duration", facts(A, "role-date").some((item) => item.certainty === "approximate" && item.precision === "duration"));
check("05 unknown month remains unknown", facts(A, "role-date").some((item) => item.certainty === "unknown" && item.precision === "unknown"));
check("06 no exact month is invented", !facts(A, "role-date").some((item) => item.precision === "month" && item.certainty === "exact"));
check("07 both responsibilities survive", facts(A, "responsibility").length === 2, JSON.stringify(facts(A, "responsibility")));
check("08 explicit no metrics is represented", A.explicitNoMetrics && facts(A, "metric")[0]?.certainty === "not-applicable");
check("09 no metric is invented", !facts(A, "metric").some((item) => story.hasAchievementMetric(item.candidateValue)));
check("10 volunteer spreadsheet is first-class", A.projects.some((item) => /volunteer spreadsheet project/i.test(item.name) && item.volunteer));
check("11 gap is context", facts(A, "career-gap").length === 1 && facts(A, "career-gap")[0].disposition === "non-resume-context");
check("12 transition is context", facts(A, "career-transition").length >= 1);
check("13 aspiration is separate", facts(A, "aspiration").some((item) => /product operations/i.test(item.candidateValue)));
check("14 no placeholder identity or education", facts(A, "identity").length === 0 && facts(A, "education").length === 0);
check("15 café disposition manifest is complete", noSilentLoss(A));
const storyDossierA = storyMode.parseStoryToDossier(FIXTURES.A);
check("16 story mode exposes only café employer", storyDossierA.extracted.company === "Neighborhood Café");
check("17 story mode does not create historical target title", storyDossierA.extracted.role === "");
check("18 sparse evidence yields two distinct facts", new Set(storyDossierA.extracted.responsibilities.map((item) => item.toLowerCase())).size === 2);
const mergedA = dossier.mergeStoryFactsIntoDossier(dossier.emptyDossier(), confirm(A), "2026-08-11T12:00:00.000Z");
check("19 reviewed café role has no false title", mergedA.roles.length === 1 && mergedA.roles[0].title === "");
check("20 volunteer project survives dossier merge", mergedA.projects.length === 1 && mergedA.projects[0].volunteer === true);
check("21 no metric survives dossier merge", mergedA.metrics.length === 0 && !mergedA.evidence.some((item) => item.kind === "metric"));

const B = parse("B");
check("22 around year is approximate", facts(B, "role-date").some((item) => /2021/.test(item.candidateValue) && item.certainty === "approximate"));
check("23 late year is approximate", facts(B, "role-date").some((item) => /late 2022/i.test(item.candidateValue) && item.certainty === "approximate"));
check("24 bounded duration remains bounded", facts(B, "role-date").some((item) => item.certainty === "bounded-range" && item.precision === "duration"));
check("25 duration creates no endpoint", !facts(B, "role-date").some((item) => /\d{4}.+(?:to|-).+\d{4}/.test(item.candidateValue)));
check("26 exact months stay unknown", facts(B, "role-date").some((item) => item.certainty === "unknown"));
check("27 current project state survives", facts(B, "project-date").some((item) => item.precision === "current"));
const mergedB = dossier.mergeStoryFactsIntoDossier(dossier.emptyDossier(), confirm(B));
check("28 approximate role date does not enter exact field", mergedB.roles[0]?.startDate === "");
check("29 approximate chronology metadata survives revival", dossier.reviveDossier(JSON.parse(JSON.stringify(mergedB))).roles[0]?.chronology?.certainty !== "exact");

const C = parse("C");
check("30 explicit no metrics detected", C.explicitNoMetrics);
check("31 dates are not metrics", !story.hasAchievementMetric("Worked from 2021 to 2024"));
check("32 phone is not a metric", !story.hasAchievementMetric("312-555-0142"));
check("33 ZIP is not a metric", !story.hasAchievementMetric("Chicago 60614"));
check("34 version is not a metric", !story.hasAchievementMetric("Used version 2.4.1"));
check("35 qualitative result is not quantified", !story.hasAchievementMetric("Significantly improved efficiency"));
check("36 supported volume is a metric", story.hasAchievementMetric("Handled 40 customer calls per week"));
const emptyResume = { summary: "Coordinator with experience in 2021", coreSkills: ["Service"], experience: [{ title: "Coordinator", company: "Beacon", time: "2021-2024", bullets: ["Handled calls."] }], education: "", linkedinHeadline: "", linkedinSummary: "" };
const numericCheck = (input, resume = emptyResume) => ats.runAtsChecks(input, resume).find((item) => item.label === "Quantified achievements present");
check("37 ATS dates do not produce PASS", numericCheck({ ...initialIntake })?.status !== "PASS");
check("38 ATS phone does not produce PASS", numericCheck({ ...initialIntake, phone: "312-555-0142" })?.status !== "PASS");
const metricResume = { ...emptyResume, experience: [{ ...emptyResume.experience[0], bullets: ["Handled 40 customer calls per week."] }] };
check("39 current supported metric can pass", numericCheck({ ...initialIntake, callsHandled: "40 customer calls per week" }, metricResume)?.status === "PASS");

const D = parse("D");
check("40 family business remains informal", facts(D, "informal-work").length >= 1);
check("41 no title invented for family work", facts(D, "title").every((item) => !item.candidateValue));
check("42 responsibilities survive family work", facts(D, "responsibility").length >= 2);
check("43 approximate family date remains approximate", facts(D, "role-date").every((item) => item.certainty !== "exact"));
check("44 process project survives", D.projects.some((item) => /scheduling process improvement project/i.test(item.name)));
check("45 family fixture has no silent loss", noSilentLoss(D));

const E = parse("E");
check("46 two volunteer projects remain distinct", E.projects.length === 2 && new Set(E.projects.map((item) => item.id)).size === 2, JSON.stringify(E.projects));
check("47 spreadsheet project survives", E.projects.some((item) => /spreadsheet project/i.test(item.name)));
check("48 event project survives", E.projects.some((item) => /event coordination project/i.test(item.name)));
check("49 projects do not become employers", facts(E, "employer").length === 0);
check("50 volunteer status survives", E.projects.every((item) => item.volunteer));
check("51 project skills remain associated", facts(E, "skill").every((item) => E.projects.some((project) => project.id === item.associationId)));

const F = parse("F");
check("52 gap never becomes employer", !facts(F, "employer").some((item) => /gap|time away|job searching/i.test(item.candidateValue)));
check("53 gap never becomes title", !facts(F, "title").some((item) => /gap|time away|job searching/i.test(item.candidateValue)));
check("54 project during gap remains project", F.projects.some((item) => /portfolio website project/i.test(item.name)));
check("55 job search remains context", facts(F, "career-gap").length >= 1 || facts(F, "career-transition").length >= 1);
check("56 future target is not historical title", !facts(F, "title").some((item) => /support operations/i.test(item.candidateValue)));

const G = parse("G");
check("57 conflicting dates share a conflict group", facts(G, "role-date").filter((item) => item.certainty === "conflicting").length >= 2);
check("58 conflict has no silent winner", facts(G, "role-date").filter((item) => item.certainty === "conflicting").every((item) => item.disposition === "conflicting"));
check("59 certain employer remains exact", facts(G, "employer")[0]?.certainty === "exact");
check("60 responsibility remains exact", facts(G, "responsibility")[0]?.certainty === "exact");
check("61 uncertain title remains unknown", facts(G, "title").some((item) => item.certainty === "unknown" && !item.candidateValue));
const revivedG = dossier.reviveDossier(JSON.parse(JSON.stringify(dossier.mergeStoryFactsIntoDossier(dossier.emptyDossier(), G))));
check("62 conflict survives reload without merging", revivedG.storyFacts.some((item) => item.certainty === "conflicting"));

const H = parse("H");
check("63 sparse story has no placeholders", !H.facts.some((item) => /candidate name|unknown company|job title|school|n\/a|tbd/i.test(item.candidateValue)));
check("64 one responsibility remains one fact", facts(H, "responsibility").length === 1, JSON.stringify(facts(H, "responsibility")));
check("65 sparse story is savable", confirm(H).facts.every((item) => item.disposition));
check("66 sparse story is not called ready", H.readiness !== "foundation" || H.facts.some((item) => item.reviewRequired));
check("67 missing education remains missing", facts(H, "education").length === 0);

const I = parse("I");
check("68 desired title remains aspiration", facts(I, "aspiration").some((item) => /product operations/i.test(item.candidateValue)));
check("69 desired title is not history", !facts(I, "title").some((item) => /product operations/i.test(item.candidateValue)));
check("70 desired skills do not become current skills", !facts(I, "skill").some((item) => /SQL|analytics/i.test(item.candidateValue)));
check("71 past customer service remains separate", facts(I, "title").some((item) => /customer service representative/i.test(item.candidateValue)));

const J = parse("J");
check("72 project-only foundation creates no employment", facts(J, "employer").length === 0 && facts(J, "title").length === 0);
check("73 two project-only records survive", J.projects.length === 2);
check("74 education survives project-only story", facts(J, "education").length === 1);
check("75 project skills survive", facts(J, "skill").length >= 2);
check("76 unknown project dates never become role dates", facts(J, "role-date").length === 0);

const K = parse("K");
check("77 compound paragraph separates facts", K.facts.length >= 7, String(K.facts.length));
check("78 compound source positions are retained", K.facts.every((item) => item.sourceStart >= 0 && item.sourceEnd > item.sourceStart));
check("79 compound uncertainty does not swallow employer", !facts(K, "employer").some((item) => /not remember|month/i.test(item.candidateValue)));
check("80 compound project is not silently omitted", K.projects.length === 1);
check("80a compound responsibilities remain distinct", facts(K, "responsibility").length === 2, JSON.stringify(facts(K, "responsibility")));
check("80b compound facts have complete dispositions", noSilentLoss(K));

const L = parse("L");
L.facts[0] = { ...L.facts[0], disposition: "intentionally-omitted", omissionReason: "User chose not to include this fact." };
const mergedL = dossier.mergeStoryFactsIntoDossier(dossier.emptyDossier(), confirm({ ...L, facts: L.facts.map((item, index) => index === 0 ? item : { ...item, disposition: "user-confirmed" }) }));
check("81 omitted fact remains in ledger", mergedL.storyFacts.some((item) => item.disposition === "intentionally-omitted"));
check("82 omitted fact does not become evidence", !mergedL.storyFacts.filter((item) => item.disposition === "intentionally-omitted").some((item) => item.evidenceId));
const stateL = { ...store.emptyState(), dossier: mergedL };
const restoredL = backup.validateBackup(JSON.stringify(backup.createBackup(stateL, "2026-08-11T12:00:00.000Z")));
check("83 omission survives backup restore", restoredL.ok && restoredL.state.dossier.storyFacts.some((item) => item.disposition === "intentionally-omitted"));
check("84 raw story survives backup restore", restoredL.ok && restoredL.state.dossier.storyRawSources.includes(FIXTURES.L));
check("85 existing dossier evidence is not rewritten", dossier.mergeStoryFactsIntoDossier(mergedA, confirm(H)).evidence.some((item) => mergedA.evidence.some((old) => old.id === item.id && old.detail === item.detail)));
check("86 no raw story external service exists", !fs.readFileSync(path.join(root, "src/lib/story-facts.ts"), "utf8").match(/fetch\(|https?:\/\//));
check("87 PDF package remains pinned", require(path.join(root, "package.json")).dependencies["pdfjs-dist"] === "6.2.108");
check("88 no fixture silently loses a fact", Object.keys(FIXTURES).every((key) => noSilentLoss(parse(key))));

console.log(`\n${passed} story fact-contract checks passed; ${failed} failed.`);
if (failed) process.exit(1);
