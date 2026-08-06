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

const { emptyState, parseState, deleteResumeVersion } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { mergeIntakeIntoDossier, intakeFromDossier, withUpdatedDossier, assessDossierReadiness } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack, updatePackVariant } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { recordTailoredResumeVersion, buildHandoff } = loadTsModule(path.join(root, "src/lib/tailor-handoff.ts"));
const { resumeVariantFilename, exportSections, variantPlainText, createPackBundle } = loadTsModule(path.join(root, "src/lib/pack-export.ts"));
const { createBackup, validateBackup, BACKUP_SCHEMA_VERSION } = loadTsModule(path.join(root, "src/lib/backup.ts"));
const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(`PASS ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

const NOW = "2026-07-15T12:00:00.000Z";
const legacy = {
  version: 1,
  profile: { currentSituation: "Moving from retail to support", targetRoles: "Product Support", transferableSkills: ["de-escalation", "documentation", "troubleshooting"], experienceSummary: "Retail Associate at ShopCo", strengths: ["calm communication"], constraints: "Remote preferred", workStyle: "Collaborative", proofPoints: "Resolved customer issues during peak shifts", updatedAt: NOW },
  lanes: [{ id: "lane-existing", title: "Product Support", status: "active", whyFit: "Customer support", resumeAngle: "Lead with support", proof: ["Resolved issues"], gaps: [], keywords: ["support"], source: "custom", createdAt: NOW }],
  applications: [{ id: "app-existing", company: "Acme", roleTitle: "Support", laneId: "lane-existing", status: "applied", jobPostUrl: "", resumeVersionId: "resume-existing", appliedAt: NOW, nextFollowUpAt: null, followUpsSent: [], interviewAt: null, notes: "", analysisKeywords: [], analysisGaps: [], analysisWeakSpots: [], createdAt: NOW }],
  outreach: [{ id: "contact-existing", name: "Pat", company: "Acme", role: "Recruiter", channel: "linkedin", status: "sent", laneId: "lane-existing", lastContactedAt: NOW, nextFollowUpAt: null, followUpCount: 0, notes: "", createdAt: NOW }],
  resumeVersions: [{ id: "resume-existing", label: "Legacy", laneId: "lane-existing", notes: "", source: "builder", applicationId: "app-existing", targetCompany: "", targetTitle: "Support", keywordsUsed: [], gapsAcknowledged: [], influenceSummary: "", resumeText: "legacy text", resumeSnapshot: null, createdAt: NOW }]
};

const migrated = parseState(JSON.stringify(legacy));
check("legacy state migrates to v2", migrated.version === 2 && migrated.dossier.id === "dossier-local");
check("migration preserves applications, outreach, lanes, and versions", migrated.applications[0]?.id === "app-existing" && migrated.outreach[0]?.id === "contact-existing" && migrated.lanes[0]?.id === "lane-existing" && migrated.resumeVersions[0]?.id === "resume-existing");
check("legacy summary retained for migration review", migrated.dossier.unstructuredNotes.includes("Retail Associate at ShopCo") && migrated.dossier.migrationReview.length > 0);
check("migration is idempotent", JSON.stringify(parseState(JSON.stringify(migrated))) === JSON.stringify(migrated));

const intake = { ...initialIntake, fullName: "Riley Example", email: "riley@example.com", phone: "555-0100", website: "riley.example", targetJobTitle: "Product Support Specialist", currentTitle: "Retail Associate", currentCompany: "ShopCo", currentTime: "2022–Present", tools: "Zendesk, Excel", responsibilities: "Resolved customer questions\nDocumented escalations", customRoleTransferableSkills: ["de-escalation", "written communication"], outcomes: "Improved handoff clarity", customersServed: "40+ customers per shift", education: "Associate degree" };
const guidedDossier = mergeIntakeIntoDossier(emptyState().dossier, intake, "guided", true, "guided source", NOW);
check("guided setup writes structured canonical dossier", guidedDossier.roles.length === 1 && guidedDossier.tools.includes("Zendesk") && guidedDossier.evidence.every((item) => item.approved));
check("normal generation can hydrate from dossier without duplicate intake", intakeFromDossier(guidedDossier, "Product Support Specialist").currentTitle === "Retail Associate" && intakeFromDossier(guidedDossier).email === "riley@example.com");
const storyDossier = mergeIntakeIntoDossier(emptyState().dossier, intake, "story", true, "I worked at ShopCo", NOW);
check("Tell My Story writes source-linked canonical evidence", storyDossier.evidence.some((item) => item.source === "story" && item.sourceText === "I worked at ShopCo"));
check("Story Mode dossier survives refresh", parseState(JSON.stringify({ ...emptyState(), dossier: storyDossier })).dossier.roles[0]?.title === "Retail Associate");
check("readiness considers evidence quality", assessDossierReadiness(guidedDossier).level === "resume-ready");

const lanes = ["Product Support", "Fraud & Risk", "Operations"].map((title, index) => ({ id: `lane-${index}`, title, status: "active", whyFit: "Verified fit", resumeAngle: `Angle ${index}`, proof: [], gaps: [`Unsupported credential ${index}`], keywords: index === 0 ? ["Zendesk", "Salesforce"] : ["Excel"], source: "custom", createdAt: NOW }));
const pack = generateResumePack(guidedDossier, lanes, NOW);
check("three active lanes produce six variants", pack.variants.length === 6);
check("variants are distinct ATS and recruiter documents", lanes.every((lane) => { const variants = pack.variants.filter((item) => item.laneId === lane.id); return variants.length === 2 && variants[0].resume.summary !== variants[1].resume.summary; }));
const approvedIds = new Set(guidedDossier.evidence.filter((item) => item.approved).map((item) => item.id));
check("every generated claim references approved dossier evidence", pack.variants.every((variant) => variant.evidenceReferences.length > 0 && variant.evidenceReferences.every((ref) => ref.evidenceIds.length > 0 && ref.evidenceIds.every((id) => approvedIds.has(id)))));
check("unsupported job keywords stay gaps without invented refusal semantics", pack.receipt.keywordsIncluded.includes("Zendesk") && !pack.receipt.keywordsIncluded.includes("Salesforce") && pack.receipt.gapsLeftUnclaimed.includes("Unsupported credential 0") && pack.receipt.unsupportedClaimsRefused.length === 0);
check("pack documents are grouped by lane", pack.lanePacks.length === 3 && pack.lanePacks.every((lanePack) => lanePack.variantIds.length === 2));

const stateWithPack = { ...emptyState(), dossier: guidedDossier, profile: migrated.profile, lanes, resumePacks: [pack] };
const changedDossier = { ...guidedDossier, proofPoints: [...guidedDossier.proofPoints, "New verified proof"], updatedAt: "2026-07-16T12:00:00.000Z" };
const stale = withUpdatedDossier(stateWithPack, changedDossier);
check("dossier changes mark affected outputs stale", stale.resumePacks[0].status === "out-of-date" && stale.resumePacks[0].variants.every((item) => item.status === "out-of-date"));
const edited = updatePackVariant(pack, pack.variants[0].id, { ...pack.variants[0].resume, summary: "User-authored summary" }, NOW);
const afterDossierChange = withUpdatedDossier({ ...stateWithPack, resumePacks: [edited] }, changedDossier);
check("user-edited résumé text is never overwritten", afterDossierChange.resumePacks[0].variants[0].resume.summary === "User-authored summary" && afterDossierChange.resumePacks[0].variants[0].userEdited);

const fakeAnalysis = { keywords: [], requirements: [], weakSpots: [], bulletSuggestions: [] };
const handoff = buildHandoff({ analysis: fakeAnalysis, lane: lanes[0], company: "Acme", roleTitle: "Support", applicationId: "app-existing", baselineVariantId: pack.variants[0].id, nowIso: NOW });
check("job-specific tailoring begins from selected baseline", handoff.baselineVariantId === pack.variants[0].id);
const tailored = recordTailoredResumeVersion({ ...stateWithPack, applications: legacy.applications }, handoff, NOW, "", "tailored", null);
check("job-specific version keeps dossier, lane, baseline, analysis, and application lineage", tailored.resumeVersions[0].dossierId === guidedDossier.id && tailored.resumeVersions[0].laneId === lanes[0].id && tailored.resumeVersions[0].baselineVariantId === pack.variants[0].id && tailored.resumeVersions[0].jobPostAnalysisId && tailored.resumeVersions[0].applicationId === "app-existing");
check("job-specific version does not replace canonical pack résumé", tailored.resumePacks[0].variants.length === 6 && tailored.resumePacks[0].variants[0].canonical);
const deleted = deleteResumeVersion(tailored, tailored.resumeVersions[0].id);
check("version deletion safely preserves application record", deleted.applications[0].id === "app-existing" && deleted.applications[0].resumeVersionId === null);

const backup = createBackup(stateWithPack, NOW);
const restored = validateBackup(JSON.stringify(backup));
check("backup v2 contains dossier, packs, evidence links, and export metadata", BACKUP_SCHEMA_VERSION === 2 && restored.ok && restored.state.dossier.evidence.length === guidedDossier.evidence.length && restored.state.resumePacks[0].variants[0].evidenceReferences.length > 0 && Array.isArray(restored.state.exports));
check("legacy backups still restore", validateBackup(JSON.stringify({ app: "career-forge", schemaVersion: 1, exportedAt: NOW, state: legacy })).ok);
check("export filenames are deterministic and sanitized", resumeVariantFilename("Riley / Example", "Fraud & Risk", "ats", "pdf") === "Riley-Example-Resume-Fraud-Risk-ATS.pdf");

// --- Export engine: section order, empty sections, termination guard -------------------
const sampleResume = {
  summary: "Led store operations until I was laid off in June 2026, kept quality high.",
  coreSkills: ["Excel", "Scheduling"],
  experience: [{ title: "Ops Lead", company: "ShopCo", time: "2022–2026", bullets: ["Ran daily operations", ""] }],
  education: "Associate degree",
  linkedinHeadline: "",
  linkedinSummary: ""
};
// PARTIAL STRIPPING IS RETIRED. This fixture's summary is a SINGLE sentence
// carrying a separation ("Led store operations until I was laid off in June
// 2026, kept quality high."), so the whole sentence is withheld and the
// summary section is absent rather than emitting a trimmed fragment. Residue
// is what turned "I dropped out of my nursing degree after one semester." into
// the fabricated bullet "Supported one semester."; the export net now removes
// whole sentences or nothing.
const orderedKeys = exportSections(sampleResume, ["education", "experience", "projects", "skills", "summary"], "ats").sections.map((section) => section.key);
check("exports respect the variant's chosen sectionOrder", orderedKeys.join(",") === "education,experience,skills", orderedKeys.join(","));
const strippedSummary = exportSections(sampleResume, undefined, "ats");
check("a separation sentence never reaches an exported summary", !/laid\s+off/i.test(JSON.stringify(strippedSummary.sections)), JSON.stringify(strippedSummary.sections));
check("no trimmed fragment is emitted in its place", !strippedSummary.sections.some((section) => section.key === "summary"), JSON.stringify(strippedSummary.sections.map((s) => s.key)));
// A multi-sentence summary keeps the sentences that carry no separation.
const mixedSummary = exportSections({ ...sampleResume, summary: "Kept quality high across two stores. Led operations until I was laid off in June 2026." }, undefined, "ats");
check("unaffected sentences in the same summary survive", mixedSummary.sections.some((section) => section.key === "summary" && section.text.includes("Kept quality high across two stores")), JSON.stringify(mixedSummary.sections));
check("  and the separation sentence does not", !/laid\s+off/i.test(JSON.stringify(mixedSummary.sections)), JSON.stringify(mixedSummary.sections));
check("stripped termination reason is surfaced as a withheld fact", strippedSummary.withheldFacts.length === 1 && strippedSummary.withheldFacts[0] === "reason for leaving");
const sparseSections = exportSections({ ...sampleResume, summary: "", coreSkills: [], education: "Education or Certification | School or Provider | Year" }, undefined, "ats").sections;
check("empty or placeholder sections never emit a heading", sparseSections.length === 1 && sparseSections[0].key === "experience");

// --- Export engine: a project is not an employer -----------------------------
const projectOnlyResume = {
  summary: "Built a campus accessibility audit tool.",
  coreSkills: ["Figma", "Accessibility auditing"],
  experience: [{ title: "Campus Accessibility Audit", company: "", time: "2025", bullets: ["Audited 12 campus buildings for accessibility barriers"], kind: "project" }],
  education: "",
  linkedinHeadline: "",
  linkedinSummary: ""
};
const projectOnlySections = exportSections(projectOnlyResume, undefined, "ats").sections;
check("a project-only résumé gets a Projects heading, never an Experience heading", projectOnlySections.some((section) => section.key === "projects" && section.heading === "Projects") && !projectOnlySections.some((section) => section.key === "experience"));

const mixedResume = {
  ...sampleResume,
  experience: [
    { title: "Ops Lead", company: "ShopCo", time: "2022–2026", bullets: ["Ran daily operations"], kind: "role" },
    { title: "Campus Accessibility Audit", company: "", time: "2025", bullets: ["Audited 12 campus buildings"], kind: "project" }
  ]
};
const mixedSections = exportSections(mixedResume, undefined, "ats").sections;
const mixedExperience = mixedSections.find((section) => section.key === "experience");
const mixedProjects = mixedSections.find((section) => section.key === "projects");
check("a mixed résumé keeps roles and projects in separate sections", mixedExperience?.roles.length === 1 && mixedProjects?.roles.length === 1);
check("the project entry never leaks into the Experience section", !mixedExperience?.roles.some((role) => role.title === "Campus Accessibility Audit"));
check("a project alongside real roles renders under 'Selected Projects', not a bare 'Projects'", mixedProjects?.heading === "Selected Projects");
check("a project never carries a fake 'Independent project' employer label", !JSON.stringify(mixedSections).includes("Independent project") && !JSON.stringify(projectOnlySections).includes("Independent project"));

// A stored variant's sectionOrder from before the projects/experience split
// (no "projects" key at all) must not silently drop project content.
const legacyOrderSections = exportSections(mixedResume, ["summary", "skills", "experience", "education"], "ats").sections;
check("project content survives a stale sectionOrder that predates the 'projects' key", legacyOrderSections.some((section) => section.key === "projects" && section.roles.length === 1));

const projectOnlyPlainText = variantPlainText({ ...guidedDossier }, projectOnlyResume, ["summary", "skills", "experience", "projects", "education"], "ats");
check("project-only plain-text export shows PROJECTS, never a bare EXPERIENCE heading", projectOnlyPlainText.includes("PROJECTS") && !projectOnlyPlainText.includes("\nEXPERIENCE\n"));

const firstVariant = pack.variants[0];
const plainText = variantPlainText(guidedDossier, firstVariant.resume, firstVariant.sectionOrder, firstVariant.kind);
check("variant plain text is the full document with identity header", plainText.startsWith("Riley Example") && plainText.includes("riley@example.com") && plainText.includes("CORE SKILLS") && plainText.includes("EXPERIENCE") && plainText.includes("- "));
const renamedDossier = { ...guidedDossier, identity: { ...guidedDossier.identity, fullName: "Riley Renamed" } };
check("document headers bind to the CURRENT dossier identity at export time", variantPlainText(renamedDossier, firstVariant.resume, firstVariant.sectionOrder, firstVariant.kind).startsWith("Riley Renamed"));
const headingPositions = ["CORE SKILLS", "EXPERIENCE"].map((label) => plainText.indexOf(label));
const atsOrderMatches = firstVariant.sectionOrder.indexOf("skills") < firstVariant.sectionOrder.indexOf("experience")
  ? headingPositions[0] < headingPositions[1]
  : headingPositions[0] > headingPositions[1];
check("plain-text section order follows the variant's sectionOrder", atsOrderMatches, `sectionOrder=${firstVariant.sectionOrder.join(",")} positions=${headingPositions.join(",")}`);

// --- Bundle integrity: no silent ZIP overwrites, no internal metadata ---------------------
const duplicatedPack = { ...pack, variants: [...pack.variants, { ...pack.variants[0], id: "dup-variant" }] };
const bundle = await createPackBundle(duplicatedPack, guidedDossier, lanes, ["pdf", "docx"]);
check("bundle filenames are de-duplicated, every variant survives", new Set(bundle.filenames).size === bundle.filenames.length && bundle.filenames.length === duplicatedPack.variants.length * 2 + 2);
check("filename collisions get -2 suffixes instead of overwriting", bundle.filenames.some((name) => /-2\.(pdf|docx)$/.test(name)));
const JSZipLib = require("jszip");
const zipContents = await JSZipLib.loadAsync(await bundle.blob.arrayBuffer());
check("ZIP contains one entry per reported filename", Object.keys(zipContents.files).length === bundle.filenames.length);
const readmeOut = await zipContents.file("README.txt").async("string");
const materialsOut = await zipContents.file("LinkedIn-and-Career-Materials.txt").async("string");
check("README never mislabels approved-but-unused evidence as unapproved", !/unapproved/i.test(readmeOut) && /Approved (?:professional )?evidence not used by these documents/.test(readmeOut));
check("exports contain no internal ids or dossier jargon", ![readmeOut, materialsOut].some((text) => /\blane-\d|variant-|dossier|debug/i.test(text)));
const noLaneBundle = await createPackBundle(pack, guidedDossier, [], ["pdf"]);
const noLaneReadme = await (await JSZipLib.loadAsync(await noLaneBundle.blob.arrayBuffer())).file("README.txt").async("string");
check("unknown lanes fall back to a human label, never a raw lane id", noLaneReadme.includes("- Custom lane") && !/lane-\d/.test(noLaneReadme));

const analyticsSource = fs.readFileSync(path.join(root, "src/lib/analytics.ts"), "utf8");
check("career workflow analytics are event-name only", /function trackCareerEvent[\s\S]*?track\(event\)/.test(analyticsSource) && !/trackCareerEvent[\s\S]*?properties/.test(analyticsSource));

// --- Guided write-back must not duplicate or hollow out profile-created roles -------
// Repro of the closure-audit contamination: roles created on /profile carry ids
// from the profile path; a guided session prefilled via intakeFromDossier and
// merged back with mergeIntakeIntoDossier must UPDATE those roles in place —
// never add a same-employment role under a new id, never shadow a recorded
// role with an empty heading-only copy, and never drop earned evidence links.
{
  const profileDossier = {
    ...emptyState().dossier,
    roles: [
      {
        id: "role-profile-fmg",
        title: "Shift Supervisor",
        employer: "Fresh Market Grocery",
        startDate: "2021–2024",
        endDate: "",
        current: false,
        responsibilities: [
          "It was my job to reconcile the drawer.",
          "Reported to my manager and the shift lead.",
          "Trained 4 new cashiers on the register system.",
          "Made weekly schedules for a team of 6.",
          "Handled customer complaints and refunds."
        ],
        tools: [],
        outcomes: [],
        evidenceIds: ["evidence-fmg-1", "evidence-fmg-2"]
      },
      {
        id: "role-profile-quickstop",
        title: "Cashier",
        employer: "QuickStop Convenience",
        startDate: "2019–2021",
        endDate: "",
        current: false,
        responsibilities: ["Answered phones.", "Rang up purchases and bagged groceries.", "Counted the till at closing."],
        tools: [],
        outcomes: [],
        evidenceIds: ["evidence-qs-1"]
      }
    ]
  };

  const prefilled = intakeFromDossier(profileDossier, "Assistant Store Manager");
  const mergedOnce = mergeIntakeIntoDossier(profileDossier, prefilled, "guided", true, "guided write-back", NOW);
  const mergedTwice = mergeIntakeIntoDossier(mergedOnce, intakeFromDossier(mergedOnce, "Assistant Store Manager"), "guided", true, "guided write-back again", NOW);

  check("guided write-back keeps exactly the two recorded roles", mergedOnce.roles.length === 2, `roles=${mergedOnce.roles.map((r) => `${r.title}@${r.employer}#${r.id}(${r.responsibilities.length})`).join(", ")}`);
  check("guided write-back reuses the profile role ids", mergedOnce.roles.every((r) => ["role-profile-fmg", "role-profile-quickstop"].includes(r.id)));
  check("no two roles share an id after write-back", new Set(mergedOnce.roles.map((r) => r.id)).size === mergedOnce.roles.length);
  check(
    "no recorded role is hollowed out by a heading-only lane",
    mergedOnce.roles.every((r) => r.responsibilities.length > 0),
    JSON.stringify(mergedOnce.roles.map((r) => [r.employer, r.responsibilities.length]))
  );
  check(
    "the current role keeps the evidence links it earned on /profile",
    (() => {
      const fmg = mergedOnce.roles.find((r) => r.id === "role-profile-fmg");
      return fmg && fmg.evidenceIds.includes("evidence-fmg-1") && fmg.evidenceIds.includes("evidence-fmg-2");
    })()
  );
  check("a second guided write-back is idempotent on role count", mergedTwice.roles.length === 2, `roles=${mergedTwice.roles.length}`);
  check(
    "a genuinely new previous employer still becomes a new role",
    (() => {
      const withNew = mergeIntakeIntoDossier(
        profileDossier,
        { ...prefilled, previousTitle: "Stocker", previousCompany: "Valley Hardware", previousTime: "2018–2019" },
        "guided",
        true,
        "typed a new employer",
        NOW
      );
      return withNew.roles.length === 3 && withNew.roles.some((r) => r.employer === "Valley Hardware");
    })()
  );
}

// --- Role identity, ordering and merge fidelity (second-review regressions) ---------
// All three were INTRODUCED by the first version of the id-adoption fix and
// found by the independent review of PR #58.
{
  const NOW2 = "2026-08-06T00:00:00.000Z";
  const base = (o) => ({ ...intake, ...o });

  // Dates are part of a role's identity: two stints at one employer must stay
  // two records, or one stint's work is exported under the other's dates.
  let d = mergeIntakeIntoDossier(emptyState().dossier, base({ currentTitle: "Associate", currentCompany: "Northwind", currentTime: "Jun 2021 - Dec 2023", responsibilities: "Answered the overnight support line." }), "guided", true, "", NOW2);
  d = mergeIntakeIntoDossier(d, base({ currentTitle: "Associate", currentCompany: "Northwind", currentTime: "Jan 2024 - present", responsibilities: "Reconciled the vendor invoice queue every Friday." }), "guided", true, "", NOW2);
  check("two stints at one employer stay two roles", d.roles.length === 2, JSON.stringify(d.roles.map((r) => [r.employer, r.startDate])));
  check(
    "each stint keeps its own dates",
    d.roles.some((r) => r.startDate === "Jun 2021 - Dec 2023") && d.roles.some((r) => r.startDate === "Jan 2024 - present"),
    JSON.stringify(d.roles.map((r) => r.startDate))
  );

  // Employment order is meaning; an unedited re-run must not invert it.
  let e = mergeIntakeIntoDossier(emptyState().dossier, base({ currentTitle: "Barista", currentCompany: "Bean Street", currentTime: "2023-present", responsibilities: "Pulled espresso shots.", previousTitle: "Cashier", previousCompany: "Fresh Market", previousTime: "2021-2023" }), "guided", true, "", NOW2);
  const orderBefore = e.roles.map((r) => `${r.title}·${r.employer}`).join("|");
  e = mergeIntakeIntoDossier(e, intakeFromDossier(e, "Operations"), "guided", true, "", NOW2);
  check("an unedited re-run preserves employment order", e.roles.map((r) => `${r.title}·${r.employer}`).join("|") === orderBefore, `${orderBefore} -> ${e.roles.map((r) => `${r.title}·${r.employer}`).join("|")}`);

  // Adoption must MERGE onto the stored role, not replace it.
  const stored = {
    ...emptyState().dossier,
    roles: [{ id: "role-x", title: "Shift Lead", employer: "Fresh Market", startDate: "Mar 2021", endDate: "Aug 2024", current: false, responsibilities: ["Counted the safe at close", "Ran the morning huddle"], tools: ["POS", "Kronos"], outcomes: ["Cut shrink 8%"], evidenceIds: ["ev1"] }]
  };
  const merged = mergeIntakeIntoDossier(stored, base({ currentTitle: "Shift Lead", currentCompany: "Fresh Market", currentTime: "Mar 2021", responsibilities: "Counted the safe at close" }), "guided", true, "", NOW2);
  const kept = merged.roles.find((r) => r.id === "role-x");
  check("adoption preserves the stored end date", kept && kept.endDate === "Aug 2024", JSON.stringify(kept && kept.endDate));
  check("adoption preserves stored tools and outcomes", kept && kept.tools.includes("POS") && kept.outcomes.includes("Cut shrink 8%"), JSON.stringify(kept && [kept.tools, kept.outcomes]));
  check("adoption preserves duties the intake pass did not carry", kept && kept.responsibilities.includes("Ran the morning huddle"), JSON.stringify(kept && kept.responsibilities));
  check("adoption preserves earned evidence links", kept && kept.evidenceIds.includes("ev1"), JSON.stringify(kept && kept.evidenceIds));
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
