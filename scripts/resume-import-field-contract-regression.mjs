import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { RESUME_IMPORT_FIELD_FIXTURES } from "./lib/resume-import-field-fixtures.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleCache = new Map();
function loadTsModule(filePath) {
  const absolute = path.resolve(filePath);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute });
  const cjsModule = { exports: {} };
  moduleCache.set(absolute, cjsModule);
  const localRequire = (request) => request.startsWith("@/")
    ? loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`))
    : request.startsWith(".") ? loadTsModule(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`)) : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, cjsModule, cjsModule.exports, path.dirname(absolute), absolute);
  return cjsModule.exports;
}

const dossierLib = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const inbox = loadTsModule(path.join(root, "src/lib/truth-inbox.ts"));
const store = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const backup = loadTsModule(path.join(root, "src/lib/backup.ts"));
const resumePack = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));

const NOW = "2026-08-11T12:00:00.000Z";
let passed = 0;
let failed = 0;
function check(label, condition, detail = "") {
  if (condition) { passed += 1; console.log(`PASS ${label}`); }
  else { failed += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
const parse = (fixture, filename = "fixture.txt") => dossierLib.parseResumePackToProposals([{ filename, text: fixture }]);
const byField = (items, field) => items.filter((item) => item.proposedField === field);
const approveSafe = (items, includeIdentity = true) => items.map((item) => ({
  ...item,
  status: item.validation === "conflicting" || item.validation === "ambiguous" || item.validation === "structural" || item.validation === "noise" || (!includeIdentity && item.group === "identity") ? "proposed" : "approved"
}));

const clean = parse(RESUME_IMPORT_FIELD_FIXTURES.clean.text, "clean.txt");
const cleanBatch = inbox.createPendingImportReview("clean", clean, NOW, true);
const cleanMerged = dossierLib.mergeImportProposals(dossierLib.emptyDossier(NOW), approveSafe(clean), NOW, true);

// Identity and contact (1-16)
check("01 name mapping", byField(clean, "identity.fullName")[0]?.candidateValue === "Morgan Lee");
check("02 hyphenated and accented names", byField(parse("Élise-Marie O’Connor-Sato"), "identity.fullName")[0]?.candidateValue === "Élise-Marie O’Connor-Sato");
check("03 email mapping", byField(clean, "identity.email")[0]?.candidateValue === "morgan.lee@example.com");
const identityFiles = RESUME_IMPORT_FIELD_FIXTURES.conflictingIdentity.files;
const identityConflict = dossierLib.parseResumePackToProposals(identityFiles);
check("04 email conflict", byField(identityConflict, "identity.email").length === 2 && byField(identityConflict, "identity.email").every((item) => item.validation === "conflicting"));
check("05 US phone formats", ["(312) 555-0142", "312-555-0142", "312.555.0142"].every((phone) => byField(parse(phone), "identity.phone").length === 1));
check("06 international-prefix phone", byField(parse("+1 312 555 0142"), "identity.phone").length === 1);
check("07 extension phone", byField(parse("312-555-0142 ext. 204"), "identity.phone")[0]?.candidateValue.includes("204"));
check("08 date range rejected as phone", byField(parse("2021-2024"), "identity.phone").length === 0);
check("09 employer blob rejected as phone", byField(parse("Northstar Software / Support Lead / 2021-2024"), "identity.phone").length === 0);
check("10 metric rejected as phone", byField(parse("Delivered 10,000 hours and improved results by 28%."), "identity.phone").length === 0);
check("11 location mapping", byField(clean, "identity.location")[0]?.candidateValue === "Chicago, IL");
check("12 location/date ambiguity", byField(parse("Chicago, IL / 2021-2024"), "identity.location").length === 0);
check("13 LinkedIn mapping", byField(clean, "identity.link").some((item) => /linkedin/i.test(item.candidateValue)));
check("14 portfolio mapping", byField(clean, "identity.link").some((item) => item.candidateValue === "https://morganlee.example"));
const links = dossierLib.parseResumePackToProposals(identityFiles);
check("15 duplicate link normalization", byField(links, "identity.link").length === 1 && byField(links, "identity.link")[0].occurrenceCount === 2);
check("16 imported identity requires explicit confirmation", cleanBatch.proposals.filter((item) => item.group === "identity").every((item) => item.status === "proposed" && item.reviewRequired));

// Structure (17-20)
const structure = clean.filter((item) => item.validation === "structural");
check("17 common headings are structure", ["PROFESSIONAL EXPERIENCE", "EDUCATION", "SELECTED PROJECTS", "TECHNICAL SKILLS"].every((heading) => structure.some((item) => item.candidateValue === heading)));
const noisy = parse(RESUME_IMPORT_FIELD_FIXTURES.noisy.text, "noisy.txt");
check("18 repeated headings stay structural", noisy.find((item) => item.candidateValue === "EXPERIENCE")?.occurrenceCount === 2 && noisy.find((item) => item.candidateValue === "EXPERIENCE")?.validation === "structural");
const malformed = parse(RESUME_IMPORT_FIELD_FIXTURES.malformedStructure.text, "malformed.txt");
check("19 page headers and footers are noise", malformed.some((item) => item.candidateValue === "MORGAN LEE — RESUME" && item.validation === "noise") && malformed.some((item) => item.candidateValue === "2 / 2" && item.validation === "noise"));
check("20 heading-like entities remain facts", malformed.some((item) => item.roleCandidate?.employer === "Education Works") && malformed.some((item) => item.projectCandidate?.name === "Skills Matrix"));

// Employment (21-28)
const roles = clean.filter((item) => item.roleCandidate);
check("21 same-line role parsing", roles.some((item) => item.roleCandidate.title === "Support Lead" && item.roleCandidate.employer === "Northstar Software"));
const multiline = parse("EXPERIENCE\nNorthstar Software\nSupport Lead\n2021-2024");
check("22 multi-line role parsing", multiline.some((item) => item.roleCandidate?.title === "Support Lead" && item.roleCandidate?.employer === "Northstar Software"));
check("23 employer and title not swapped", roles.every((item) => !/Software|Health/.test(item.roleCandidate.title)));
const fullDateRole = parse("Support Lead — Northstar Software | January 3, 2021 - May 4, 2024").find((item) => item.roleCandidate)?.roleCandidate;
check("24 date attaches to intended role", roles.find((item) => item.roleCandidate.employer === "Northstar Software")?.roleCandidate.startDate === "Jan 2021" && roles.find((item) => item.roleCandidate.employer === "Harbor Health")?.roleCandidate.endDate === "2020" && fullDateRole?.startDate === "January 3, 2021" && fullDateRole?.endDate === "May 4, 2024" && fullDateRole?.datePrecision === "day");
const dateless = parse("EXPERIENCE\nSupport Lead — Northstar Software");
check("25 missing date remains missing", dateless[1]?.roleCandidate?.startDate === "" && dateless[1]?.roleCandidate?.endDate === "");
check("26 present represented consistently", roles.find((item) => item.roleCandidate.employer === "Northstar Software")?.roleCandidate.current === true && roles.find((item) => item.roleCandidate.employer === "Northstar Software")?.roleCandidate.endDate === "");
const partialRole = parse("EXPERIENCE\nOperations Manager");
check("27 partial role remains unresolved", partialRole.some((item) => item.candidateValue === "Operations Manager" && item.validation === "ambiguous" && !item.roleCandidate));
check("28 employer blob cannot enter identity", noisy.filter((item) => item.sourceExcerpts.includes("Northstar Software / Support Lead / 2021-2024")).every((item) => item.group !== "identity"));

// Chronology and conflict (29-36)
const chronology = parse(RESUME_IMPORT_FIELD_FIXTURES.chronology.text, "chronology.txt");
const roleConflicts = chronology.filter((item) => item.conflictGroup?.startsWith("conflict-role-"));
const separateRoleBatch = inbox.createPendingImportReview("separate-role", parse("Advisor — Civic Lab | 2019-2021", "role-a.txt"), NOW, true);
const addedRoleConflict = inbox.addProposalsToReview(separateRoleBatch, parse("Advisor — Civic Lab | 2018-2021", "role-b.txt"), NOW);
check("29 conflicting role dates surface", roleConflicts.length === 2 && roleConflicts.every((item) => item.validation === "conflicting") && addedRoleConflict.proposals.filter((item) => item.conflictGroup?.startsWith("conflict-role-")).length === 2);
check("30 concurrent roles do not falsely conflict", chronology.filter((item) => ["Northstar Software", "Harbor Health"].includes(item.roleCandidate?.employer)).every((item) => !item.conflictGroup));
const exactRoles = dossierLib.parseResumePackToProposals([{ filename: "a.txt", text: "Support Lead — Northstar Software | 2021-2024" }, { filename: "b.txt", text: "Support Lead — Northstar Software | 2021-2024" }]);
check("31 exact role duplicates collapse", exactRoles.filter((item) => item.roleCandidate).length === 1 && exactRoles.find((item) => item.roleCandidate)?.occurrenceCount === 2);
check("32 differing dates prevent unsafe merge", roleConflicts[0]?.candidateValue !== roleConflicts[1]?.candidateValue && roleConflicts[0]?.status === "proposed");
check("33 year-only dates gain no month", chronology.filter((item) => item.roleCandidate?.datePrecision === "year").every((item) => !/[A-Za-z]/.test(item.roleCandidate.startDate)));
const conflictBatch = inbox.createPendingImportReview("conflict", identityConflict, NOW, true);
const conflictState = { ...store.emptyState(), pendingImportReviews: [conflictBatch] };
const reloadedConflict = store.parseState(JSON.stringify(conflictState));
check("34 conflict survives reload", reloadedConflict.pendingImportReviews[0].proposals.filter((item) => item.conflictGroup).length >= 6);
const restoredConflict = backup.validateBackup(JSON.stringify(backup.createBackup(conflictState, NOW)));
check("35 conflict survives backup restore", restoredConflict.ok && restoredConflict.state.pendingImportReviews[0].proposals.some((item) => item.validation === "conflicting"));
const chosenEmail = conflictBatch.proposals.find((item) => item.proposedField === "identity.email");
const resolvedState = { ...conflictState, pendingImportReviews: [{ ...conflictBatch, proposals: conflictBatch.proposals.map((item) => item.conflictGroup === chosenEmail.conflictGroup ? { ...item, status: item.id === chosenEmail.id ? "approved" : "rejected" } : item) }] };
const reloadedResolution = store.parseState(JSON.stringify(resolvedState));
check("36 explicit resolution survives reload", reloadedResolution.pendingImportReviews[0].proposals.find((item) => item.id === chosenEmail.id)?.status === "approved" && reloadedResolution.pendingImportReviews[0].proposals.filter((item) => item.conflictGroup === chosenEmail.conflictGroup && item.id !== chosenEmail.id).every((item) => item.status === "rejected"));

// Education, projects, skills (37-42)
check("37 education survives", cleanMerged.education.some((item) => item.institution === "Lakeview University" && item.credential === "BS" && item.field === "Information Systems" && item.dates === "2018"));
check("38 project remains first-class", cleanMerged.projects.some((item) => item.name === "Skills Matrix") && !cleanMerged.roles.some((item) => item.title === "Skills Matrix"));
check("39 project date does not attach to role", cleanMerged.projects.find((item) => item.name === "Skills Matrix")?.dates === "2023" && cleanMerged.roles.every((item) => item.startDate !== "2023"));
check("40 skills survive", ["Zendesk", "Jira", "SQL"].every((skill) => cleanMerged.transferableSkills.includes(skill)));
check("41 heading does not become skill", !cleanMerged.transferableSkills.some((skill) => /skills/i.test(skill)));
check("42 no invented proficiency", clean.filter((item) => item.proposedField === "skill").every((item) => !/expert|advanced|proficient/i.test(item.candidateValue)));

// Workflow integrity (43-55)
const identityOnly = approveSafe(parse("Morgan Lee\nmorgan@example.com"));
const identityOnlyDossier = dossierLib.mergeImportProposals(dossierLib.emptyDossier(NOW), identityOnly, NOW, true);
check("43 partial save does not imply completion", dossierLib.assessDossierReadiness(identityOnlyDossier).level === "not-ready");
check("44 zero roles and projects is incomplete", identityOnlyDossier.roles.length === 0 && identityOnlyDossier.projects.length === 0 && dossierLib.assessDossierReadiness(identityOnlyDossier).nextActions.some((item) => /role or project/i.test(item)));
const noFormal = parse(RESUME_IMPORT_FIELD_FIXTURES.noFormalEmployment.text, "volunteer.txt");
const noFormalReviewed = noFormal.map((item) => ({ ...item, status: item.validation === "structural" || item.validation === "noise" ? "proposed" : "approved" }));
const noFormalDossier = dossierLib.mergeImportProposals(dossierLib.emptyDossier(NOW), noFormalReviewed, NOW, true);
check("45 non-employment experience remains supported", noFormalDossier.roles.length === 0 && noFormalDossier.projects.length === 1 && noFormalDossier.education.length === 1 && dossierLib.assessDossierReadiness(noFormalDossier).level !== "not-ready", JSON.stringify({ proposals: noFormal, roles: noFormalDossier.roles, projects: noFormalDossier.projects, education: noFormalDossier.education, readiness: dossierLib.assessDossierReadiness(noFormalDossier) }));
const partialBatch = inbox.createPendingImportReview("partial", [...partialRole, ...byField(clean, "identity.phone")], NOW, true);
check("46 unresolved candidates remain available", partialBatch.proposals.some((item) => item.validation === "ambiguous") && partialBatch.proposals.some((item) => item.proposedField === "identity.phone"));
const rejectedPhone = byField(clean, "identity.phone").map((item) => ({ ...item, status: "rejected" }));
check("47 rejected candidates do not merge", dossierLib.mergeImportProposals(dossierLib.emptyDossier(NOW), rejectedPhone, NOW, true).identity.phone === "");
const meaningfulPositions = new Set(RESUME_IMPORT_FIELD_FIXTURES.noisy.text.split("\n").map((_, index) => index));
const disposedPositions = new Set(noisy.flatMap((item) => item.sourcePositions ?? []));
check("48 every meaningful fixture line has disposition", [...meaningfulPositions].every((position) => disposedPositions.has(position)) && noisy.every((item) => item.disposition));
const existing = store.parseState(JSON.stringify({ ...store.emptyState(), dossier: cleanMerged }));
check("49 existing localStorage remains readable", existing.dossier.roles.length === cleanMerged.roles.length && existing.dossier.identity.email === cleanMerged.identity.email);
const restored = backup.validateBackup(JSON.stringify(backup.createBackup({ ...store.emptyState(), dossier: cleanMerged }, NOW)));
check("50 existing backup remains restorable", restored.ok && restored.state.dossier.projects.some((item) => item.name === "Skills Matrix"));
const revisionPack = resumePack.generateResumePack(cleanMerged, [{ id: "lane-import-contract", title: "Customer Support", status: "active", whyFit: "", resumeAngle: "Support operations", proof: [], gaps: [], keywords: ["support"], source: "custom", createdAt: NOW }], NOW);
check("51 Pass 01 evidence bindings stay represented", cleanMerged.roles.every((role) => role.evidenceIds.length > 0) && revisionPack.variants.every((variant) => variant.evidenceReferences.every((reference) => reference.evidenceIds.every((id) => typeof reference.evidenceRevisions?.[id] === "string"))));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
check("52 Pass 02 PDF security suite remains configured", packageJson.scripts["test:pdf-boundary"] === "node scripts/pdf-trust-boundary-browser.mjs");
const parity = ["clean.txt", "clean.docx", "clean.pdf"].map((filename) => dossierLib.parseResumePackToProposals([{ filename, text: RESUME_IMPORT_FIELD_FIXTURES.clean.text }]).map((item) => `${item.proposedField}|${item.candidateValue}`).sort().join("\n"));
check("53 PDF DOCX TXT semantic contract parity", new Set(parity).size === 1);
const serialized = JSON.stringify({ ...store.emptyState(), pendingImportReviews: [cleanBatch], dossier: cleanMerged });
check("54 raw source bytes are not persisted", !serialized.includes("%PDF-") && !serialized.includes("PK\\u0003\\u0004") && !serialized.includes("arrayBuffer"));
const importerSource = fs.readFileSync(path.join(root, "src/lib/local-resume-import.ts"), "utf8");
check("55 no new external import service", !/\bfetch\s*\(|XMLHttpRequest|sendBeacon/.test(importerSource));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
