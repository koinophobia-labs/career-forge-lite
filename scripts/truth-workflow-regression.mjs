import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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

const { emptyDossier, evidenceRecord, parseResumePackToProposals, mergeImportProposals } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack, updatePackVariant } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { analyzeJobPost } = loadTsModule(path.join(root, "src/lib/job-post-analyzer.ts"));
const { draftApplicationQuestion } = loadTsModule(path.join(root, "src/lib/application-questions.ts"));
const { parseState, emptyProfile } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { stripTerminationReasons } = loadTsModule(path.join(root, "src/lib/truth-guards.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(`PASS ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

const NOW = "2026-07-15T12:00:00.000Z";
const files = [
  { filename: "ats.txt", text: "Associate Sportsbook Writer — DraftKings | 2021–2024\nPolicy enforcement and ID verification\nMaintained transaction accuracy\nEarlham College — Bachelor's degree\nTools: Excel, Internal sportsbook tools" },
  { filename: "human.txt", text: "Associate Sportsbook Writer — DraftKings | 2021–2024\nPolicy enforcement and ID verification\nResolved customer disputes\nFounder — Koinophobia Labs | 2024–Present\nCareer Forge project\nMaintained 13 automated regression suites" }
];
const proposals = parseResumePackToProposals(files);
check("multi-file import deduplicates repeated roles", proposals.filter((item) => /Associate Sportsbook Writer/i.test(item.detail)).length === 1);
const repeatedRole = proposals.find((item) => /Associate Sportsbook Writer/i.test(item.detail));
check("deduplicated records retain all source filenames", repeatedRole?.sourceFilenames.length === 2);
check("import proposals are grouped", new Set(proposals.map((item) => item.group)).size >= 4);
check("import proposals begin unusable", proposals.every((item) => item.status === "proposed"));

const reviewed = proposals.map((item) => ({ ...item, status: "approved" }));
let dossier = mergeImportProposals(emptyDossier(NOW), reviewed, NOW, true);
check("structured approval promotes only reviewed records", dossier.evidence.length === reviewed.length && dossier.evidence.every((item) => item.approved));
check("source text and filenames survive approval", dossier.evidence.every((item) => item.sourceExcerpts.length && item.sourceFilenames.length));
check("filenames are not persisted without explicit opt-in", mergeImportProposals(emptyDossier(NOW), reviewed, NOW).evidence.every((item) => item.sourceFilenames.length === 0));
check("approved import materializes structured roles and education", dossier.roles.some((item) => item.title.includes("Associate Sportsbook Writer") && item.employer === "DraftKings") && dossier.education.length > 0, JSON.stringify({ roles: dossier.roles, education: dossier.education }));

const add = (kind, detail) => evidenceRecord(kind, detail, "manual", true, NOW, { label: kind, sourceText: detail });
const projectEvidence = [add("project", "Career Forge — local-first career command center"), add("responsibility", "Built automated regression testing for shipped web products"), add("metric", "Maintained 13 automated regression suites")];
dossier = {
  ...dossier,
  evidence: [...dossier.evidence, ...projectEvidence],
  projects: [{ id: "project-career-forge", name: "Career Forge", organization: "Koinophobia Labs", dates: "2024–Present", description: "Career Forge — local-first career command center", responsibilities: ["Built automated regression testing for shipped web products"], tools: [], outcomes: [], metrics: ["Maintained 13 automated regression suites"], links: [], defaultPlacement: "projects", evidenceIds: projectEvidence.map((item) => item.id) }],
  approvedClaims: [...dossier.approvedClaims, ...projectEvidence.map((item) => item.detail)],
  updatedAt: NOW
};
const lanes = ["AI Product Support / QA", "Customer Success / Implementation", "Fraud & Risk Operations"].map((title, index) => ({ id: `lane-${index}`, title, status: "active", whyFit: "", resumeAngle: title, proof: [], gaps: [], keywords: index === 0 ? ["Salesforce", "regression"] : index === 2 ? ["policy enforcement"] : ["customer support"], source: "custom", createdAt: NOW }));
const pack = generateResumePack(dossier, lanes, NOW);
check("three lanes generate six baseline resumes", pack.variants.length === 6);
check("projects can carry a resume", pack.variants.some((variant) => variant.resume.experience.some((entry) => entry.title === "Career Forge")));
check("ATS and recruiter variants differ structurally", lanes.every((lane) => { const [ats, recruiter] = pack.variants.filter((item) => item.laneId === lane.id); return ats.sectionOrder.join() !== recruiter.sectionOrder.join() && ats.template !== recruiter.template && ats.resume.summary !== recruiter.resume.summary; }));
const approvedIds = new Set(dossier.evidence.filter((item) => item.approved && !item.rejected).map((item) => item.id));
check("every shipped claim has relevant approved support",
  pack.variants.every((variant) => variant.evidenceReferences.every((ref) => ref.evidenceIds.length > 0 && ref.evidenceIds.every((id) => approvedIds.has(id)))) &&
  pack.variants.every((variant) => variant.evidenceReferences.every((ref) => ref.evidenceIds.length < approvedIds.size)));
check("claim references carry support type", pack.variants.every((variant) => variant.evidenceReferences.every((ref) => ["direct", "combined", "transferred"].includes(ref.supportType))));
check("lane-only Salesforce is refused", !pack.receipt.keywordsIncluded.includes("Salesforce"));

const profile = { ...emptyProfile(), transferableSkills: ["customer service"], experienceSummary: "Resolved customer disputes" };
const salesforce = analyzeJobPost("Requirements:\n- Experience with Salesforce is required", profile, lanes[0], dossier);
check("Salesforce lane keyword does not become proof", salesforce.requirements[0]?.status === "gap");
const degree = analyzeJobPost("Requirements:\n- Bachelor's degree required", profile, lanes[0], { ...dossier, evidence: dossier.evidence.filter((item) => item.kind !== "education") });
check("degree requirement remains gap without approved education", degree.requirements[0]?.status === "gap");
const policy = analyzeJobPost("Requirements:\n- Experience with policy enforcement and fraud investigation", profile, lanes[2], dossier);
check("sportsbook policy enforcement supports risk as direct or transferred", policy.requirements[0]?.status !== "gap" && policy.requirements[0]?.evidenceIds.length > 0);
const riskTransfer = analyzeJobPost("Requirements:\n- Experience with fraud investigation required", profile, lanes[2], dossier);
check("policy enforcement alone marks fraud investigation partial", riskTransfer.requirements[0]?.status === "partial" && riskTransfer.requirements[0]?.supportType === "transferred");
const saasTransfer = analyzeJobPost("Requirements:\n- Experience with SaaS support required", profile, lanes[0], dossier);
check("customer service marks SaaS support partial not covered", saasTransfer.requirements[0]?.status === "partial" && saasTransfer.requirements[0]?.supportType === "transferred");

const namedEvidence = (id, kind, detail) => ({ ...add(kind, detail), id });
function durationDossier(roleSpecs = [], extraEvidence = []) {
  const roleEvidence = roleSpecs.map((role, index) => namedEvidence(
    role.evidenceId ?? `duration-role-${index}`,
    "role",
    role.evidenceDetail ?? `${role.title} — ${role.startDate} to ${role.current ? "Present" : role.endDate}. ${role.responsibilities.join(" ")}`
  ));
  return {
    ...emptyDossier(NOW),
    evidence: [...roleEvidence, ...extraEvidence],
    roles: roleSpecs.map((role, index) => ({
      id: `role-${index}`,
      title: role.title,
      employer: role.employer ?? `Employer ${index + 1}`,
      startDate: role.startDate,
      endDate: role.endDate,
      current: Boolean(role.current),
      responsibilities: role.responsibilities,
      tools: role.tools ?? [],
      outcomes: role.outcomes ?? [],
      evidenceIds: [role.evidenceId ?? `duration-role-${index}`]
    })),
    approvedClaims: [...roleEvidence, ...extraEvidence].map((item) => item.detail),
    updatedAt: NOW
  };
}
const durationMatch = (requirement, candidateDossier, now = NOW, lane = lanes[0]) =>
  analyzeJobPost(`Requirements:\n- ${requirement}`, profile, lane, candidateDossier, now).requirements[0];

const undatedSaas = namedEvidence("undated-saas", "responsibility", "Provided SaaS support and resolved product escalations");
const undatedSaasMatch = durationMatch("5+ years of SaaS support experience required", durationDossier([], [undatedSaas]));
check("skill evidence without dates does not cover five years", undatedSaasMatch?.status === "partial" && /duration is not verified/i.test(undatedSaasMatch.evidence));

const twoYearFraud = durationDossier([{ title: "Fraud Investigator", startDate: "January 2024", endDate: "January 2026", responsibilities: ["Conducted fraud investigation casework"] }]);
const twoYearFraudMatch = durationMatch("5+ years of fraud investigation experience required", twoYearFraud);
check("two verified years do not cover five years", twoYearFraudMatch?.status === "partial" && /below the 5-year requirement/i.test(twoYearFraudMatch.evidence));

const fiveYearSupport = durationDossier([{ title: "Customer Support Specialist", startDate: "January 2021", endDate: "January 2026", responsibilities: ["Provided customer support and resolved escalations"] }]);
const fiveYearSupportMatch = durationMatch("3+ years of customer support experience required", fiveYearSupport);
check("five verified years cover a three-year requirement", fiveYearSupportMatch?.status === "covered" && fiveYearSupportMatch.supportType === "direct" && fiveYearSupportMatch.evidenceIds.length === 1);
const undatedCustomerSupport = namedEvidence("undated-customer-support", "responsibility", "Provided customer support and resolved escalations");
const mixedDurationSupport = { ...fiveYearSupport, evidence: [...fiveYearSupport.evidence, undatedCustomerSupport] };
check("covered duration cites only dated qualifying evidence", !durationMatch("3+ years of customer support experience required", mixedDurationSupport)?.evidenceIds.includes("undated-customer-support"));

const salesforceTool = namedEvidence("salesforce-tool", "tool", "Salesforce");
const salesforceAdminDuration = durationMatch("4+ years of Salesforce administration experience required", durationDossier([], [salesforceTool]));
check("tool familiarity does not cover years of administration", salesforceAdminDuration?.status !== "covered" && salesforceAdminDuration?.evidenceIds.includes("salesforce-tool"));

const vagueDuration = namedEvidence("vague-saas", "role", "SaaS support specialist with several years of experience");
const vagueDurationMatch = durationMatch("3+ years of SaaS support experience required", durationDossier([], [vagueDuration]));
check("vague several-years language does not satisfy numeric duration", vagueDurationMatch?.status === "partial" && /not verified/i.test(vagueDurationMatch.evidence));

const currentSupport = durationDossier([{ title: "Customer Support Specialist", startDate: "January 2023", endDate: "", current: true, responsibilities: ["Provided customer support"] }]);
const currentAtThreeYears = durationMatch("3+ years of customer support experience required", currentSupport, "2026-01-01T00:00:00.000Z");
const currentBeforeThreeYears = durationMatch("3+ years of customer support experience required", currentSupport, "2025-12-01T00:00:00.000Z");
check("present-role duration uses the passed deterministic date", currentAtThreeYears?.status === "covered" && currentBeforeThreeYears?.status === "partial");

const laneOnlyDuration = durationMatch("4+ years of Salesforce administration experience required", emptyDossier(NOW), NOW, lanes[0]);
check("lane keywords never count toward duration", laneOnlyDuration?.status === "gap" && laneOnlyDuration.evidenceIds.length === 0);

const combinedSupport = durationDossier([
  { title: "Customer Support Specialist", startDate: "January 2020", endDate: "January 2022", responsibilities: ["Provided customer support"] },
  { title: "Customer Support Lead", startDate: "January 2022", endDate: "January 2024", responsibilities: ["Led customer support escalations"] }
]);
check("relevant non-overlapping roles combine duration", durationMatch("3+ years of customer support experience required", combinedSupport)?.status === "covered");

const overlappingSupport = durationDossier([
  { title: "Customer Support Specialist", startDate: "January 2020", endDate: "January 2023", responsibilities: ["Provided customer support"] },
  { title: "Customer Support Contractor", startDate: "January 2021", endDate: "January 2024", responsibilities: ["Provided customer support"] }
]);
check("overlapping date ranges are not double-counted", durationMatch("5+ years of customer support experience required", overlappingSupport)?.status === "partial");

const ambiguousSupport = durationDossier([{ title: "SaaS Support Specialist", startDate: "Spring 2021", endDate: "Late 2024", responsibilities: ["Provided SaaS support"] }]);
check("ambiguous relevant date ranges remain partial", durationMatch("3+ years of SaaS support experience required", ambiguousSupport)?.status === "partial");

const compactYearRange = durationDossier([{ title: "Customer Support Specialist", startDate: "2021–2024", endDate: "", responsibilities: ["Provided customer support"] }]);
check("compact year ranges are parsed conservatively", durationMatch("3+ years of customer support experience required", compactYearRange)?.status === "covered");

const unrelatedLongRole = durationDossier(
  [{ title: "Warehouse Associate", startDate: "January 2010", endDate: "January 2020", responsibilities: ["Managed warehouse inventory"] }],
  [undatedSaas]
);
check("years from unrelated work never satisfy duration", durationMatch("5+ years of SaaS support experience required", unrelatedLongRole)?.status === "partial");

const question = draftApplicationQuestion("Describe a time you solved a difficult customer problem.", dossier, "question-1");
check("application answer is evidence backed", question.evidenceIds.length > 0 && question.evidenceIds.every((id) => approvedIds.has(id)));
check("application answer refuses when evidence is absent", draftApplicationQuestion("Why this role?", emptyDossier(NOW)).evidenceIds.length === 0);

const customerEvidence = namedEvidence("customer-resolution", "responsibility", "Resolved a difficult customer problem by de-escalating a dispute and documenting the outcome");
const customerDossier = durationDossier([], [customerEvidence]);
const customerConflict = draftApplicationQuestion("Describe a time you solved a difficult customer problem.", customerDossier, "customer-conflict");
check("customer-conflict evidence supports a behavioral question", customerConflict.evidenceIds.includes("customer-resolution") && /situation/i.test(customerConflict.draftAnswer));

const unsupportedSalesforce = draftApplicationQuestion("Describe your Salesforce administration experience.", customerDossier, "unsupported-salesforce");
check("customer evidence does not support Salesforce administration", unsupportedSalesforce.evidenceIds.length === 0 && /approved dossier evidence/i.test(unsupportedSalesforce.draftAnswer));

const salesforceAdminEvidence = namedEvidence("salesforce-admin", "responsibility", "Administered Salesforce workflows, permissions, and support queues");
const supportedSalesforce = draftApplicationQuestion("Describe your Salesforce administration experience.", durationDossier([], [salesforceAdminEvidence]), "supported-salesforce");
check("exact Salesforce administration evidence supports the technical question", supportedSalesforce.evidenceIds.includes("salesforce-admin"));

const securityWork = namedEvidence("security-work", "role", "Security officer responsible for facility access and incident documentation");
const clearanceQuestion = draftApplicationQuestion("Do you currently hold an active security clearance?", durationDossier([], [securityWork]), "clearance");
check("security employment does not imply security clearance", clearanceQuestion.evidenceIds.length === 0);

const employmentEvidence = namedEvidence("employment", "role", "Customer Support Specialist at Example Co");
const authorizationQuestion = draftApplicationQuestion("Are you legally authorized to work in the United States?", durationDossier([], [employmentEvidence]), "authorization");
check("employment evidence does not imply work authorization", authorizationQuestion.evidenceIds.length === 0);

const degreeEvidence = namedEvidence("degree-evidence", "education", "Bachelor's degree in Sociology from Earlham College");
const degreeQuestion = draftApplicationQuestion("Do you have a bachelor's degree?", durationDossier([], [degreeEvidence]), "degree");
check("approved degree evidence answers a degree question", degreeQuestion.evidenceIds.includes("degree-evidence"));
check("missing degree evidence refuses the degree question", draftApplicationQuestion("Do you have a bachelor's degree?", customerDossier, "degree-missing").evidenceIds.length === 0);

const compensationQuestion = draftApplicationQuestion("What are your salary expectations?", customerDossier, "compensation");
check("compensation requires explicit user input", compensationQuestion.evidenceIds.length === 0 && compensationQuestion.draftAnswer === "Add your preferred compensation range before submitting this answer.");

const weekendQuestion = draftApplicationQuestion("Can you work every weekend?", customerDossier, "weekends");
check("weekend availability requires explicit evidence", weekendQuestion.evidenceIds.length === 0);

const sponsorshipQuestion = draftApplicationQuestion("Will you require visa sponsorship?", customerDossier, "sponsorship");
check("sponsorship requires explicit work-authorization evidence", sponsorshipQuestion.evidenceIds.length === 0);

const unsupportedDurationQuestion = draftApplicationQuestion("Do you have 5+ years of SaaS support experience?", customerDossier, "duration-question", NOW);
check("application questions do not infer required duration from related work", unsupportedDurationQuestion.evidenceIds.length === 0);

const supportedDurationQuestion = draftApplicationQuestion("Do you have 3+ years of customer support experience?", fiveYearSupport, "duration-question-supported", NOW);
check("application questions can use exact verified duration evidence", supportedDurationQuestion.evidenceIds.length === 1 && supportedDurationQuestion.evidenceIds[0] === "duration-role-0");

const zeroScoreQuestion = draftApplicationQuestion("Do you manage 20 direct reports?", customerDossier, "zero-score");
check("zero-score evidence is never selected", zeroScoreQuestion.evidenceIds.length === 0);

const firstUnrelatedStory = namedEvidence("story-unrelated", "story", "Organized inventory during a seasonal reset");
const firstRankedResponsibility = namedEvidence("responsibility-ranked-first", "responsibility", "Resolved a difficult customer problem and documented the result");
const secondRankedStory = namedEvidence("story-ranked-second", "story", "Customer dispute resolution story with a verified outcome");
const rankedSelection = draftApplicationQuestion(
  "Describe a time you solved a difficult customer problem.",
  durationDossier([], [firstUnrelatedStory, firstRankedResponsibility, secondRankedStory]),
  "ranked-selection"
);
check("second evidence kind compares with the first ranked result", rankedSelection.evidenceIds.join(",") === "responsibility-ranked-first,story-ranked-second", rankedSelection.evidenceIds.join(","));

const unknownQuestion = draftApplicationQuestion("What is your favorite constellation?", customerDossier, "unknown");
check("unknown unrelated prompts select no evidence", unknownQuestion.evidenceIds.length === 0);

const motivationQuestion = draftApplicationQuestion("Why are you interested in this customer support role?", customerDossier, "motivation");
check("motivation answers use candidate evidence without inventing company facts", motivationQuestion.evidenceIds.includes("customer-resolution") && /researched reasons/i.test(motivationQuestion.draftAnswer) && !/innovative culture/i.test(motivationQuestion.draftAnswer));
check("generic company motivation questions require user-specific support", draftApplicationQuestion("Why do you want to work at this company?", customerDossier, "generic-motivation").evidenceIds.length === 0);

const explicitAuthorization = namedEvidence("explicit-authorization", "constraint", "Legally authorized to work in the United States and do not require visa sponsorship");
check("exact work-authorization evidence can answer authorization", draftApplicationQuestion("Are you legally authorized to work in the United States?", durationDossier([], [explicitAuthorization]), "authorization-supported").evidenceIds.includes("explicit-authorization"));

const explicitWeekend = namedEvidence("explicit-weekend", "constraint", "Available to work every weekend");
check("exact availability evidence can answer a weekend question", draftApplicationQuestion("Can you work every weekend?", durationDossier([], [explicitWeekend]), "weekend-supported").evidenceIds.includes("explicit-weekend"));

const explicitClearance = namedEvidence("explicit-clearance", "constraint", "Currently hold an active security clearance");
check("exact clearance evidence can answer a clearance question", draftApplicationQuestion("Do you currently hold an active security clearance?", durationDossier([], [explicitClearance]), "clearance-supported").evidenceIds.includes("explicit-clearance"));

const explicitCompensation = namedEvidence("explicit-compensation", "constraint", "Preferred compensation range is $90,000 to $105,000");
check("explicit compensation evidence can support a compensation answer", draftApplicationQuestion("What are your salary expectations?", durationDossier([], [explicitCompensation]), "compensation-supported").evidenceIds.includes("explicit-compensation"));

const editedQuestion = { ...customerConflict, draftAnswer: "User-edited truthful answer", userEdited: true };
const revivedQuestion = parseState(JSON.stringify({ version: 2, applications: [{ id: "question-app", company: "Example", roleTitle: "Support", applicationQuestions: [editedQuestion], createdAt: NOW }] })).applications[0]?.applicationQuestions[0];
check("application-question drafts remain editable and persist", revivedQuestion?.userEdited === true && revivedQuestion?.draftAnswer === "User-edited truthful answer");

check("existing evidence-backed behavioral answers still work", question.evidenceIds.length > 0 && question.userEdited === false);

const edited = updatePackVariant(pack, pack.variants[0].id, { ...pack.variants[0].resume, summary: "User-authored truthful summary" }, NOW, ["summary"]);
check("manual edits are marked and preserved", edited.variants[0].userEdited && edited.variants[0].userAuthoredPaths.includes("summary") && edited.variants[0].resume.summary === "User-authored truthful summary");

const legacyApp = parseState(JSON.stringify({ version: 2, profile, dossier, applications: [{ id: "legacy-app", company: "Acme", roleTitle: "Support", jobPostUrl: "https://linkedin.example/job", createdAt: NOW }] })).applications[0];
check("legacy jobPostUrl migrates to discoveryUrl", legacyApp.discoveryUrl === "https://linkedin.example/job" && legacyApp.source === "other" && Array.isArray(legacyApp.applicationQuestions));

const projectOnly = { ...emptyDossier(NOW), evidence: projectEvidence, projects: dossier.projects, approvedClaims: projectEvidence.map((item) => item.detail), updatedAt: NOW };
check("project-only candidates generate without fake employers", generateResumePack(projectOnly, [lanes[0]], NOW).variants.some((variant) => variant.resume.experience.some((item) => item.title === "Career Forge" && item.company === "Koinophobia Labs")));
const largeEvidence = Array.from({ length: 500 }, (_, index) => add("proof", `Verified support outcome ${index}`));
const largeDossier = { ...projectOnly, evidence: [...projectEvidence, ...largeEvidence], approvedClaims: [...projectOnly.approvedClaims, ...largeEvidence.map((item) => item.detail)] };
// Selection stays bounded on huge dossiers: 18 ranked picks plus the handful
// of structural records (education, role/project support) that always render.
check("large dossiers generate deterministically", generateResumePack(largeDossier, [lanes[0]], NOW).variants.length === 2 && generateResumePack(largeDossier, [lanes[0]], NOW).receipt.evidenceUsed.length <= 24);
check("corrupt localStorage payload revives safely", parseState("{not json").dossier.evidence.length === 0);

// --- Document-quality honesty (post-audit): what ships must be submittable ---

const auditFiles = [{
  filename: "history.txt",
  text: [
    "Operations Coordinator — Brightline Logistics | 2019–2026",
    "I managed vendor contracts worth $2M annually until I was laid off in June 2026",
    "Reduced onboarding time from 3 weeks to 9 days",
    "Tools: Workday, Kronos, and some Excel from a class",
    "City College — Associate degree in Business",
  ].join("\n")
}];
const auditProposals = parseResumePackToProposals(auditFiles).map((item) => ({ ...item, status: "approved" }));
const auditDossier = mergeImportProposals(emptyDossier(NOW), auditProposals, NOW);
const auditRole = auditDossier.roles.find((role) => /Operations Coordinator/i.test(role.title));
check("imported facts attach to their role", Boolean(auditRole) && auditRole.evidenceIds.length > 1, JSON.stringify(auditDossier.roles));

const auditLane = {
  id: "lane-audit", title: "Operations Manager", status: "active",
  whyFit: "", resumeAngle: "Frame yourself as a translator: turn ops experience into leadership stories.",
  proof: [], gaps: [], keywords: ["operations", "vendor", "onboarding"], source: "custom", createdAt: NOW
};
const auditPack = generateResumePack(auditDossier, [auditLane], NOW);
const auditAts = auditPack.variants.find((variant) => variant.kind === "ats");
const auditRoleEntry = auditAts.resume.experience.find((entry) => /Operations Coordinator/i.test(entry.title));
check("imported roles render with real bullets", Boolean(auditRoleEntry) && auditRoleEntry.bullets.length >= 1, JSON.stringify(auditAts.resume.experience));
const allDocText = [auditAts.resume.summary, ...auditAts.resume.coreSkills, ...auditAts.resume.experience.flatMap((entry) => [entry.title, ...entry.bullets]), auditAts.resume.education, auditAts.resume.linkedinHeadline, auditAts.resume.linkedinSummary, ...auditPack.masterProofBank, ...auditPack.lanePacks.map((lanePack) => lanePack.positioningPitch)].join("\n");
check("termination reasons never ship in documents", !/laid off|terminated|fired/i.test(allDocText), allDocText);
check("withheld termination reason is reported on the receipt", auditPack.receipt.unsupportedClaimsRefused.some((item) => /reason for leaving/i.test(item)));

// Separation-reason sanitizer: strip only the unsafe clause, keep the safe
// remainder from the same sentence when the reason has no comma to split on.
const noSeparatorCase = stripTerminationReasons("I managed vendor contracts worth $2M annually until I was laid off in June 2026");
check("separation-reason sanitizer preserves the safe remainder with no comma to split on", noSeparatorCase.text === "I managed vendor contracts worth $2M annually" && noSeparatorCase.withheld === true, JSON.stringify(noSeparatorCase));
const commaCase = stripTerminationReasons("Managed vendor contracts, until I was laid off in June 2026.");
check("separation-reason sanitizer still handles comma-separated clauses", commaCase.text === "Managed vendor contracts" && commaCase.withheld === true, JSON.stringify(commaCase));
const pureReasonCase = stripTerminationReasons("I was laid off in June 2026.");
check("separation-reason sanitizer drops a sentence with no safe remainder at all", pureReasonCase.text === "" && pureReasonCase.withheld === true, JSON.stringify(pureReasonCase));
const safeCase = stripTerminationReasons("Reduced onboarding time from 3 weeks to 9 days");
check("separation-reason sanitizer leaves safe sentences untouched", safeCase.text === "Reduced onboarding time from 3 weeks to 9 days" && safeCase.withheld === false, JSON.stringify(safeCase));
check("first-person framing is cleaned from summaries", !/\bI managed\b|\bmy\b/i.test(auditAts.resume.summary), auditAts.resume.summary);
check("tool lists atomize into individual skills", auditAts.resume.coreSkills.includes("Workday") && auditAts.resume.coreSkills.includes("Kronos"), JSON.stringify(auditAts.resume.coreSkills));
check("skill fragments never ship", auditAts.resume.coreSkills.every((skill) => !/^and\s|^some\s|from a class/i.test(skill)), JSON.stringify(auditAts.resume.coreSkills));
check("approved education renders on the document", /Associate degree|City College/i.test(auditAts.resume.education), auditAts.resume.education);
check("lane pitches carry no second-person coaching", auditPack.lanePacks.every((lanePack) => !/frame yourself|position verified/i.test(lanePack.positioningPitch)), JSON.stringify(auditPack.lanePacks.map((lanePack) => lanePack.positioningPitch)));
check("receipt framing uses the composed pitch, not coaching text", auditPack.receipt.laneFraming.every((framing) => !/frame yourself/i.test(framing.angle)));

// Uncertainty statements must not become proof-bank content.
const uncertainDossier = {
  ...auditDossier,
  evidence: [...auditDossier.evidence, add("metric", "I don't know my numbers")],
  proofPoints: [...auditDossier.proofPoints, "I don't know my numbers"]
};
const uncertainPack = generateResumePack(uncertainDossier, [auditLane], NOW);
check("uncertainty statements stay out of the proof bank", uncertainPack.masterProofBank.every((entry) => !/don'?t know/i.test(entry)), JSON.stringify(uncertainPack.masterProofBank));

// A role with no usable approved detail is omitted, not rendered hollow.
const hollowDossier = {
  ...emptyDossier(NOW),
  evidence: [add("role", "Shift Lead — Corner Cafe")],
  roles: [{ id: "role-hollow", title: "Shift Lead", employer: "Corner Cafe", startDate: "", endDate: "", current: false, responsibilities: [], tools: [], outcomes: [], evidenceIds: [] }],
  updatedAt: NOW
};
hollowDossier.roles[0].evidenceIds = [hollowDossier.evidence[0].id];
const hollowPack = generateResumePack(hollowDossier, [auditLane], NOW);
check("zero-bullet roles are omitted from documents", hollowPack.variants.every((variant) => variant.resume.experience.every((entry) => entry.bullets.length > 0)));
check("omitted roles are reported honestly", hollowPack.receipt.unsupportedClaimsRefused.some((item) => /Shift Lead/i.test(item)), JSON.stringify(hollowPack.receipt.unsupportedClaimsRefused));

// --- Release-candidate pack inspection fixes (2026-07-16 manual review) ------

// The user's own name must never become document content.
const namedImport = parseResumePackToProposals([{ filename: "n.txt", text: "Marcus Bell\nmarcus@example.com\nTicket Writer — BetRiver | 2021–2026\nTrained 6 new ticket writers on POS" }])
  .map((item) => ({ ...item, status: "approved" }));
const namedDossier = mergeImportProposals(emptyDossier(NOW), namedImport, NOW);
check("bare name lines classify as identity", namedDossier.identity.fullName === "Marcus Bell", JSON.stringify(namedDossier.identity));
const namedPack = generateResumePack(namedDossier, [auditLane], NOW);
const namedDocText = JSON.stringify(namedPack.variants.map((variant) => variant.resume)) + JSON.stringify(namedPack.masterProofBank);
check("the user's name is never a bullet or proof entry", !namedDocText.includes("Marcus Bell"), namedDocText.slice(0, 300));

// Heading-shaped evidence heads sections; it never reprints as bullet/summary.
check(
  "role headings never appear as bullets or summary facts",
  namedPack.variants.every((variant) =>
    !variant.resume.summary.includes("BetRiver |") &&
    variant.resume.experience.every((entry) => entry.bullets.every((bullet) => !/—.*\b(19|20)\d{2}\b|\|\s*(19|20)\d{2}/.test(bullet)))
  )
);

// Facts attach to the heading they followed in the source text.
const multiRole = parseResumePackToProposals([{
  filename: "m.txt",
  text: [
    "Casey Tran",
    "Substitute Teacher — Metro School District | 2023–2026",
    "Covered K-8 classrooms on short notice",
    "Line Cook — Pho Palace | 2021–2023",
    "Worked the wok station during 200-cover dinner rushes"
  ].join("\n")
}]).map((item) => ({ ...item, status: "approved" }));
const multiDossier = mergeImportProposals(emptyDossier(NOW), multiRole, NOW);
const multiPack = generateResumePack(multiDossier, [auditLane], NOW);
const teacherEntry = multiPack.variants[0].resume.experience.find((entry) => /Substitute Teacher/.test(entry.title));
const cookEntry = multiPack.variants[0].resume.experience.find((entry) => /Line Cook/.test(entry.title));
check(
  "facts attach to the role they followed in the source",
  Boolean(teacherEntry?.bullets.some((bullet) => /classrooms/.test(bullet))) &&
    Boolean(cookEntry?.bullets.some((bullet) => /wok station/.test(bullet))) &&
    !teacherEntry?.bullets.some((bullet) => /wok station/.test(bullet)),
  JSON.stringify(multiPack.variants[0].resume.experience)
);

// A dateless second role must not donate its facts to the first role.
const datelessSecond = parseResumePackToProposals([{
  filename: "d.txt",
  text: ["Warehouse Associate — Fulfillment Co | 2020–2022", "Picked and packed 300+ orders daily", "Delivery Driver — QuickShip", "Delivered 80-100 packages per route"].join("\n")
}]).map((item) => ({ ...item, status: "approved" }));
const datelessDossier = mergeImportProposals(emptyDossier(NOW), datelessSecond, NOW);
const datelessPack = generateResumePack(datelessDossier, [auditLane], NOW);
const warehouseEntry = datelessPack.variants[0].resume.experience.find((entry) => /Warehouse/.test(entry.title));
check(
  "a dateless second role keeps its own facts",
  Boolean(warehouseEntry) && !warehouseEntry.bullets.some((bullet) => /packages per route/.test(bullet)),
  JSON.stringify(datelessPack.variants[0].resume.experience)
);

// Education renders once, without a duplicated year.
const eduImport = parseResumePackToProposals([{ filename: "e.txt", text: "State University — BS in Communications | 2019" }]).map((item) => ({ ...item, status: "approved" }));
const eduDossier = mergeImportProposals(emptyDossier(NOW), eduImport, NOW);
const eduEntry = eduDossier.education[0];
check("education credential does not duplicate the year", Boolean(eduEntry) && !/(19|20)\d{2}/.test(eduEntry.credential) && eduEntry.dates === "2019", JSON.stringify(eduDossier.education));

// Founder/project headings collect the facts that follow them.
const founderImport = parseResumePackToProposals([{
  filename: "f.txt",
  text: ["Founder — Loomwork Studio | 2023–Present", "Built and shipped 4 client websites", "Set up automated intake workflows"].join("\n")
}]).map((item) => ({ ...item, status: "approved" }));
const founderDossier = mergeImportProposals(emptyDossier(NOW), founderImport, NOW);
const founderProject = founderDossier.projects[0];
check(
  "project facts attach to the project heading they followed",
  Boolean(founderProject) && founderProject.organization === "Loomwork Studio" && founderProject.evidenceIds.length >= 2,
  JSON.stringify(founderDossier.projects)
);

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
