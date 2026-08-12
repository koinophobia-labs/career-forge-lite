import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
function load(file) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute });
  const mod = { exports: {} }; cache.set(absolute, mod);
  const localRequire = (request) => request.startsWith("@/") ? load(path.join(root, "src", `${request.slice(2)}.ts`)) : request.startsWith(".") ? load(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`)) : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, mod, mod.exports, path.dirname(absolute), absolute);
  return mod.exports;
}

const { emptyDossier } = load(path.join(root, "src/lib/dossier.ts"));
const { emptyState, parseState } = load(path.join(root, "src/lib/command-center-store.ts"));
const { generateResumePack } = load(path.join(root, "src/lib/resume-pack.ts"));
const { auditRoleDistinctness, buildTargetRoleContract } = load(path.join(root, "src/lib/role-targeting.ts"));
const { evidenceRevision } = load(path.join(root, "src/lib/evidence-integrity.ts"));
const { validateVariantEvidenceIntegrity } = load(path.join(root, "src/lib/evidence-integrity.ts"));
const { createVariantFile, createPackBundle, materialsText } = load(path.join(root, "src/lib/pack-export.ts"));

const NOW = "2026-08-12T12:00:00.000Z";
let passes = 0; let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(`PASS ${passes} ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
function evidence(id, kind, detail, roleId) {
  return { id, kind, label: detail.split(/\s+/).slice(0, 5).join(" "), detail, roleId, source: "manual", sourceText: detail, confidence: "high", approved: true, rejected: false, sourceFilenames: [], sourceExcerpts: [detail], createdAt: NOW, updatedAt: NOW };
}
function lane(id, title, description = "") {
  return { id, title, targetDescription: description, status: "active", whyFit: "Use only approved facts.", resumeAngle: `Prioritize approved evidence for ${title}.`, proof: [], gaps: [], keywords: [], source: "custom", createdAt: NOW };
}
function benchmarkDossier() {
  const dossier = emptyDossier(NOW);
  dossier.identity = { ...dossier.identity, fullName: "Taylor Morgan", email: "taylor@example.com", phone: "312-555-0142", location: "Chicago, IL", links: ["linkedin.com/in/taylor-morgan"] };
  const records = [
    evidence("support-triage", "responsibility", "Triaged customer tickets and routed urgent issues to the right team.", "role-main"),
    evidence("support-troubleshoot", "responsibility", "Troubleshot software issues and explained technical workarounds to customers.", "role-main"),
    evidence("support-escalation", "proof", "Handled issue escalations while keeping customers informed through resolution.", "role-main"),
    evidence("support-response", "metric", "Improved service response consistency by documenting recurring customer issue patterns.", "role-main"),
    evidence("ops-process", "responsibility", "Mapped an internal process and redesigned the workflow to reduce missed handoffs.", "role-main"),
    evidence("ops-reporting", "responsibility", "Built spreadsheet reporting that tracked operational status and exceptions.", "role-main"),
    evidence("ops-coordination", "proof", "Coordinated a cross-functional launch checklist and project timeline.", "role-main"),
    evidence("ops-automation", "metric", "Automated a repetitive tracking step and standardized the operating procedure.", "role-main"),
    evidence("shared-documentation", "responsibility", "Documented customer issue patterns in a shared guide that standardized an internal support workflow.", "role-main"),
    evidence("shared-collaboration", "responsibility", "Coordinated across customer support and operations teams to troubleshoot issues, track handoffs, and communicate next steps.", "role-main"),
    evidence("skill-troubleshooting", "skill", "Troubleshooting"),
    evidence("skill-customer", "skill", "Customer communication"),
    evidence("skill-ticket", "skill", "Ticket triage"),
    evidence("skill-kb", "skill", "Knowledge-base writing"),
    evidence("skill-escalation", "skill", "Issue escalation"),
    evidence("skill-process", "skill", "Process mapping"),
    evidence("skill-spreadsheet", "skill", "Spreadsheet analysis"),
    evidence("skill-workflow", "skill", "Workflow documentation"),
    evidence("skill-project", "skill", "Project coordination"),
    evidence("skill-reporting", "skill", "Operational reporting"),
    evidence("tool-zendesk", "tool", "Zendesk"),
    evidence("tool-sheets", "tool", "Google Sheets"),
    evidence("project-support", "project", "Created a customer troubleshooting guide and knowledge system."),
    evidence("project-ops", "project", "Built an operations workflow tracker and reporting dashboard."),
    evidence("project-shared", "project", "Created a cross-team launch checklist with shared documentation.")
  ];
  dossier.evidence = records;
  dossier.roles = [{ id: "role-main", title: "Customer Operations Associate", employer: "Northstar Software", startDate: "2021", endDate: "2025", current: false, responsibilities: records.filter((item) => item.roleId === "role-main" && ["responsibility", "proof", "metric"].includes(item.kind)).map((item) => item.detail), tools: [], outcomes: [], evidenceIds: records.filter((item) => item.roleId === "role-main").map((item) => item.id) }];
  dossier.projects = [
    { id: "p-support", name: "Customer Troubleshooting Guide", organization: "", dates: "2024", description: records.find((item) => item.id === "project-support").detail, responsibilities: [], tools: [], outcomes: [], metrics: [], links: [], defaultPlacement: "projects", evidenceIds: ["project-support"] },
    { id: "p-ops", name: "Operations Workflow Tracker", organization: "", dates: "2024", description: records.find((item) => item.id === "project-ops").detail, responsibilities: [], tools: [], outcomes: [], metrics: [], links: [], defaultPlacement: "projects", evidenceIds: ["project-ops"] },
    { id: "p-shared", name: "Cross-team Launch Checklist", organization: "", dates: "2024", description: records.find((item) => item.id === "project-shared").detail, responsibilities: [], tools: [], outcomes: [], metrics: [], links: [], defaultPlacement: "projects", evidenceIds: ["project-shared"] }
  ];
  dossier.transferableSkills = records.filter((item) => item.kind === "skill").map((item) => item.detail);
  dossier.tools = ["Zendesk", "Google Sheets"];
  dossier.proofPoints = records.filter((item) => item.kind === "proof" || item.kind === "metric").map((item) => item.detail);
  dossier.approvedClaims = records.filter((item) => ["responsibility", "proof", "metric", "project"].includes(item.kind)).map((item) => item.detail);
  dossier.updatedAt = NOW;
  return dossier;
}

const support = lane("support", "Product Support Specialist", "Must troubleshoot customer software issues, triage tickets, explain technical resolutions, handle escalations, and maintain knowledge-base documentation.");
const ops = lane("ops", "Junior Product Operations", "Must improve workflows, map processes, coordinate cross-functional projects, maintain operational trackers, and analyze spreadsheet reporting.");
const dossier = benchmarkDossier();
const pack = generateResumePack(dossier, [support, ops], NOW);
const supportLane = pack.lanePacks.find((item) => item.laneId === "support");
const opsLane = pack.lanePacks.find((item) => item.laneId === "ops");
const audit = pack.roleDistinctnessAudits[0];
const supportAts = pack.variants.find((item) => item.laneId === "support" && item.kind === "ats");
const supportRecruiter = pack.variants.find((item) => item.laneId === "support" && item.kind === "recruiter");
const opsAts = pack.variants.find((item) => item.laneId === "ops" && item.kind === "ats");
const opsRecruiter = pack.variants.find((item) => item.laneId === "ops" && item.kind === "recruiter");
const top = (lp, n) => lp.relevanceReceipts.filter((item) => item.selected).sort((a, b) => a.rank - b.rank).slice(0, n).map((item) => item.evidenceId);
const bulletIds = (variant) => variant.evidenceReferences.filter((ref) => ref.claimPath.includes(".bullets.")).slice(0, 4).flatMap((ref) => ref.evidenceIds);
const projects = (variant) => variant.resume.experience.filter((item) => item.kind === "project").map((item) => item.title);

check("A01 two lane packs generated", pack.lanePacks.length === 2);
check("A02 four style-role variants generated", pack.variants.length === 4);
check("A03 support contract is description backed", supportLane.targetContract.basis === "description-backed");
check("A04 operations contract is description backed", opsLane.targetContract.basis === "description-backed");
check("A05 support target signals trace to supplied text", supportLane.targetContract.signals.some((item) => item.source === "description" && item.sourceExcerpt.includes("troubleshoot")));
check("A06 operations target signals trace to supplied text", opsLane.targetContract.signals.some((item) => item.source === "description" && item.sourceExcerpt.includes("workflows")));
check("A07 required signal remains required", supportLane.targetContract.signals.some((item) => item.importance === "required"));
check("A08 title persisted", supportLane.targetContract.title === support.title);
check("A09 description persisted", supportLane.targetContract.description === support.targetDescription);
check("A10 support competencies include troubleshooting", supportLane.targetContract.competencies.includes("troubleshooting"));
check("A11 operations competencies include process improvement", opsLane.targetContract.competencies.includes("process-improvement"));
check("A12 no SQL requirement invented", !JSON.stringify(supportLane.targetContract).toLowerCase().includes("sql"));
check("A13 every eligible record has a relevance receipt", supportLane.relevanceReceipts.length === dossier.evidence.length);
check("A14 receipts bind current revision", supportLane.relevanceReceipts.every((item) => item.evidenceRevision === evidenceRevision(dossier.evidence.find((record) => record.id === item.evidenceId), dossier)));
check("A15 receipts identify lane", supportLane.relevanceReceipts.every((item) => item.laneId === "support"));
check("A16 ranks are stable and unique", new Set(supportLane.relevanceReceipts.map((item) => item.rank)).size === dossier.evidence.length);
check("A17 tie-break rationale exists", supportLane.relevanceReceipts.every((item) => item.tieBreakReason.length > 10));
check("A18 selected receipts carry claim paths", supportLane.relevanceReceipts.filter((item) => item.selected).every((item) => item.claimPaths.length > 0));
check("A19 excluded receipts explain exclusion", supportLane.relevanceReceipts.filter((item) => !item.selected).every((item) => item.exclusionReason));
check("A20 support troubleshooting outranks operations reporting", supportLane.relevanceReceipts.find((item) => item.evidenceId === "support-troubleshoot").rank < supportLane.relevanceReceipts.find((item) => item.evidenceId === "ops-reporting").rank);
check("A21 operations reporting outranks support troubleshooting", opsLane.relevanceReceipts.find((item) => item.evidenceId === "ops-reporting").rank < opsLane.relevanceReceipts.find((item) => item.evidenceId === "support-troubleshoot").rank);
check("A22 top 8 has three unique support IDs", audit.topEvidenceUniqueA.length >= 3, JSON.stringify(audit));
check("A23 top 8 has three unique operations IDs", audit.topEvidenceUniqueB.length >= 3, JSON.stringify(audit));
check("A24 top 5 has two unique support IDs", top(supportLane, 5).filter((id) => !top(opsLane, 5).includes(id)).length >= 2);
check("A25 top 5 has two unique operations IDs", top(opsLane, 5).filter((id) => !top(supportLane, 5).includes(id)).length >= 2);
check("A26 shared evidence is allowed", audit.evidenceOverlap.length >= 1);
check("A27 shared evidence changes rank when relevant", audit.evidenceRankChanges.length >= 2);
check("A28 support top skills contain troubleshooting", supportAts.resume.coreSkills.slice(0, 6).includes("Troubleshooting"));
check("A29 support top skills contain customer communication", supportAts.resume.coreSkills.slice(0, 6).includes("Customer communication"));
check("A30 operations top skills contain process mapping", opsAts.resume.coreSkills.slice(0, 6).includes("Process mapping"));
check("A31 operations top skills contain spreadsheet analysis", opsAts.resume.coreSkills.slice(0, 6).includes("Spreadsheet analysis"));
check("A32 support has two unique top skills", audit.uniqueSkillsA.length >= 2, JSON.stringify(audit.uniqueSkillsA));
check("A33 operations has two unique top skills", audit.uniqueSkillsB.length >= 2, JSON.stringify(audit.uniqueSkillsB));
check("A34 top skill overlap is bounded", audit.skillOverlap.length <= 4, JSON.stringify(audit.skillOverlap));
check("A35 unsupported SQL does not become skill", pack.variants.every((variant) => !variant.resume.coreSkills.some((skill) => /sql/i.test(skill))));
check("A36 first bullets differ by support evidence", bulletIds(supportAts).some((id) => !bulletIds(opsAts).includes(id)));
check("A37 first bullets differ by operations evidence", bulletIds(opsAts).some((id) => !bulletIds(supportAts).includes(id)));
check("A38 bullet component is nonzero", audit.components.bullets > 0);
check("A39 bullet references bind revisions", [supportAts, opsAts].every((variant) => variant.evidenceReferences.filter((ref) => ref.claimPath.includes(".bullets.")).every((ref) => ref.evidenceIds.every((id) => ref.evidenceRevisions[id] === evidenceRevision(dossier.evidence.find((record) => record.id === id), dossier)))));
check("A40 no filler duplicates in support bullets", new Set(supportAts.resume.experience.flatMap((item) => item.bullets)).size === supportAts.resume.experience.flatMap((item) => item.bullets).length);
check("A41 no filler duplicates in operations bullets", new Set(opsAts.resume.experience.flatMap((item) => item.bullets)).size === opsAts.resume.experience.flatMap((item) => item.bullets).length);
check("A42 support project ranks first", projects(supportAts)[0] === "Customer Troubleshooting Guide", JSON.stringify(projects(supportAts)));
check("A43 operations project ranks first", projects(opsAts)[0] === "Operations Workflow Tracker", JSON.stringify(projects(opsAts)));
check("A44 top project differs", audit.projectSelectionDifference);
check("A45 projects retain source names", projects(supportAts).every((name) => dossier.projects.some((project) => project.name === name)) && projects(opsAts).every((name) => dossier.projects.some((project) => project.name === name)));
check("A46 support summary uses support evidence", supportAts.evidenceReferences.find((ref) => ref.claimPath === "summary").evidenceIds.some((id) => id.startsWith("support")));
check("A47 operations summary uses operations evidence", opsAts.evidenceReferences.find((ref) => ref.claimPath === "summary").evidenceIds.some((id) => id.startsWith("ops")));
check("A48 summaries differ beyond role title", supportAts.resume.summary.replace(support.title, "") !== opsAts.resume.summary.replace(ops.title, ""));
check("A49 summary component is nonzero", audit.components.summary > 0);
check("A50 support ATS remains support prioritized", top(supportLane, 8).filter((id) => id.startsWith("support")).length >= 3);
check("A51 support recruiter remains support prioritized", bulletIds(supportRecruiter).some((id) => id.startsWith("support")));
check("A52 operations ATS remains operations prioritized", top(opsLane, 8).filter((id) => id.startsWith("ops")).length >= 3);
check("A53 operations recruiter remains operations prioritized", bulletIds(opsRecruiter).some((id) => id.startsWith("ops")));
check("A54 ATS and recruiter styles remain separate", supportAts.sectionOrder.join() !== supportRecruiter.sectionOrder.join());
check("A55 lane supporting material differs", audit.supportingMaterialDifference);
check("A56 support material binds evidence", supportLane.supportingMaterial.evidenceIds.length > 0);
check("A57 operations material binds evidence", opsLane.supportingMaterial.evidenceIds.length > 0);
check("A58 intentionally global proof bank remains pack global", Array.isArray(pack.masterProofBank) && !supportLane.masterProofBank);
check("A59 strong audit scores at least 70", audit.score >= 70, JSON.stringify(audit));
check("A60 strong audit decision is meaningful", audit.decision === "meaningfully-distinct", JSON.stringify(audit));
check("A61 evidence component nonzero", audit.components.evidence > 0);
check("A62 score deterministic", JSON.stringify(generateResumePack(dossier, [support, ops], NOW).roleDistinctnessAudits) === JSON.stringify(pack.roleDistinctnessAudits));
check("A63 all output claim IDs are approved", pack.variants.every((variant) => variant.evidenceReferences.every((ref) => ref.evidenceIds.every((id) => dossier.evidence.find((item) => item.id === id)?.approved))));
check("A64 all output claim IDs exist", pack.variants.every((variant) => variant.evidenceReferences.every((ref) => ref.evidenceIds.every((id) => dossier.evidence.some((item) => item.id === id)))));
check("A65 unsupported target words do not become claims", !JSON.stringify(pack.variants.map((variant) => variant.resume)).toLowerCase().includes("must troubleshoot"));

const sparse = benchmarkDossier(); sparse.evidence = sparse.evidence.filter((item) => ["shared-documentation", "shared-collaboration", "skill-customer"].includes(item.id)); sparse.roles[0].evidenceIds = sparse.evidence.map((item) => item.id); sparse.projects = [];
const sparsePack = generateResumePack(sparse, [support, ops], NOW); const sparseAudit = sparsePack.roleDistinctnessAudits[0];
check("E01 sparse audit is insufficient", sparseAudit.decision === "insufficient-evidence-for-distinctness");
check("E02 sparse audit has no misleading score", sparseAudit.score === null);
check("E03 sparse output invents no project", sparsePack.variants.every((variant) => !variant.resume.experience.some((item) => item.kind === "project")));
check("E04 sparse output uses only available evidence", sparsePack.variants.every((variant) => variant.evidenceReferences.every((ref) => ref.evidenceIds.every((id) => sparse.evidence.some((item) => item.id === id)))));
check("E05 sparse reason explains constraint", sparseAudit.reasons.join(" ").includes("approved dossier"));

const oneProject = benchmarkDossier(); oneProject.projects = oneProject.projects.filter((item) => item.id === "p-shared"); oneProject.evidence = oneProject.evidence.filter((item) => !item.id.startsWith("project-") || item.id === "project-shared"); oneProject.roles[0].evidenceIds = oneProject.roles[0].evidenceIds.filter((id) => oneProject.evidence.some((item) => item.id === id));
const oneProjectPack = generateResumePack(oneProject, [support, ops], NOW);
check("F01 one defensible project may appear in both", oneProjectPack.variants.filter((item) => item.kind === "ats").every((variant) => projects(variant).includes("Cross-team Launch Checklist")));
check("F02 shared project keeps its name", oneProjectPack.variants.every((variant) => projects(variant).every((name) => name === "Cross-team Launch Checklist")));

const aspiration = evidence("aspiration-sql", "goal", "I want to learn SQL for Product Operations."); dossier.evidence.push(aspiration);
const aspirationPack = generateResumePack(dossier, [ops], NOW);
check("G01 aspirational SQL is ineligible for candidate ranking", !aspirationPack.lanePacks[0].relevanceReceipts.some((item) => item.evidenceId === aspiration.id));
check("G02 aspirational SQL is absent from skills", !aspirationPack.variants[0].resume.coreSkills.some((item) => /sql/i.test(item)));

const rejected = benchmarkDossier(); rejected.evidence.find((item) => item.id === "support-troubleshoot").rejected = true;
const rejectedPack = generateResumePack(rejected, [support], NOW);
check("I01 rejected evidence is absent from ranking", !rejectedPack.lanePacks[0].relevanceReceipts.some((item) => item.evidenceId === "support-troubleshoot"));
check("I02 rejected evidence is absent from claims", rejectedPack.variants.every((variant) => variant.evidenceReferences.every((ref) => !ref.evidenceIds.includes("support-troubleshoot"))));

const sameA = lane("same-a", "Operations Coordinator", "Must manage customer onboarding, client training, and relationship communication.");
const sameB = lane("same-b", "Operations Coordinator", "Must analyze spreadsheet reporting, improve workflow tracking, and coordinate internal processes.");
const samePack = generateResumePack(benchmarkDossier(), [sameA, sameB], NOW);
check("J01 same title descriptions produce different signals", JSON.stringify(samePack.lanePacks[0].targetContract.signals.map((item) => item.concept)) !== JSON.stringify(samePack.lanePacks[1].targetContract.signals.map((item) => item.concept)));
check("J02 same title descriptions produce different top evidence", top(samePack.lanePacks[0], 5).join() !== top(samePack.lanePacks[1], 5).join());
check("J03 title-only remains distinguishable", buildTargetRoleContract(lane("title-only", "Product Support Specialist")).basis === "title-only");

const successLane = lane("success", "Customer Success", "Own customer onboarding, relationship communication, adoption, retention, and client success reporting.");
const coordinatorLane = lane("coordinator", "Operations Coordinator", "Own process tracking, internal coordination, spreadsheet reporting, documentation, and workflow improvement.");
const fixtureB = generateResumePack(benchmarkDossier(), [successLane, coordinatorLane], NOW);
check("B01 customer success prioritizes customer evidence", top(fixtureB.lanePacks[0], 8).filter((id) => id.startsWith("support") || id.includes("customer")).length >= 2);
check("B02 operations coordinator prioritizes process evidence", top(fixtureB.lanePacks[1], 8).filter((id) => id.startsWith("ops") || id.includes("process") || id.includes("reporting")).length >= 3);
check("B03 pair preserves eligible provenance", fixtureB.roleDistinctnessAudits[0].truthIntegrityFailures.length === 0);

const technicalLane = lane("technical", "Technical Support", "Troubleshoot technical software issues, explain workarounds, triage tickets, and document resolutions.");
const implementationLane = lane("implementation", "Implementation Coordinator", "Coordinate customer setup, gather requirements, deliver training, track projects, and document handoffs.");
const fixtureC = generateResumePack(benchmarkDossier(), [technicalLane, implementationLane], NOW);
check("C01 technical support ranks troubleshooting evidence", top(fixtureC.lanePacks[0], 5).some((id) => id.includes("troubleshoot")));
check("C02 implementation ranks coordination evidence", top(fixtureC.lanePacks[1], 8).some((id) => id.includes("coordination") || id.includes("project")));
check("C03 pair creates no unsupported training claim", !JSON.stringify(fixtureC.variants.map((variant) => variant.resume)).toLowerCase().includes("deliver training"));

const adjacentLane = lane("adjacent", "Customer Support Specialist", "Triage customer issues, communicate resolutions, and document recurring support questions.");
const fixtureD = generateResumePack(benchmarkDossier(), [support, adjacentLane], NOW);
check("D01 adjacent roles retain overlap", fixtureD.roleDistinctnessAudits[0].evidenceOverlap.length >= 3);
check("D02 adjacent roles do not hide relevant shared evidence", fixtureD.lanePacks.every((lp) => top(lp, 8).some((id) => id === "shared-documentation" || id === "shared-collaboration")));
check("D03 adjacent output remains truthful", fixtureD.roleDistinctnessAudits[0].truthIntegrityFailures.length === 0);

const staleDossier = benchmarkDossier();
const stalePack = generateResumePack(staleDossier, [support, ops], NOW);
staleDossier.evidence.find((item) => item.id === "support-troubleshoot").detail = "Corrected: Troubleshot account setup issues and documented only confirmed resolutions.";
check("H01 edited evidence invalidates dependent output", stalePack.variants.some((variant) => !validateVariantEvidenceIntegrity(variant, staleDossier).valid));
const regenerated = generateResumePack({ ...staleDossier, updatedAt: "2026-08-12T13:00:00.000Z" }, [support, ops], "2026-08-12T13:00:00.000Z");
check("H02 regeneration binds corrected evidence", regenerated.variants.every((variant) => validateVariantEvidenceIntegrity(variant, staleDossier).valid));
check("H03 regeneration recalculates ranking receipt", regenerated.lanePacks[0].relevanceReceipts.find((item) => item.evidenceId === "support-troubleshoot").evidenceRevision !== stalePack.lanePacks[0].relevanceReceipts.find((item) => item.evidenceId === "support-troubleshoot").evidenceRevision);

const unresolved = benchmarkDossier(); unresolved.evidence.find((item) => item.id === "ops-automation").disclosureReview = "needs_review";
const unresolvedPack = generateResumePack(unresolved, [ops], NOW);
check("cross-pass unresolved evidence is absent from ranking", !unresolvedPack.lanePacks[0].relevanceReceipts.some((item) => item.evidenceId === "ops-automation"));
check("cross-pass unresolved evidence is absent from claims", unresolvedPack.variants.every((variant) => variant.evidenceReferences.every((ref) => !ref.evidenceIds.includes("ops-automation"))));

const fakeSameLane = { ...supportLane, laneId: "fake", targetContract: { ...supportLane.targetContract, laneId: "fake" } };
const fakeVariants = pack.variants.filter((item) => item.laneId === "support").map((item) => ({ ...item, id: `${item.id}-fake`, laneId: "fake", title: item.title.replace("Product Support", "Junior Product Operations"), sectionOrder: [...item.sectionOrder].reverse() }));
const cosmeticAudit = auditRoleDistinctness(supportLane, fakeSameLane, [...pack.variants.filter((item) => item.laneId === "support"), ...fakeVariants]);
check("anti-gaming title-only difference fails", cosmeticAudit.decision !== "meaningfully-distinct");
check("anti-gaming section-order-only difference fails", cosmeticAudit.components.evidence === 0 && cosmeticAudit.components.bullets === 0);
check("anti-gaming same evidence cannot pass", cosmeticAudit.score === null || cosmeticAudit.score < 70);
const unsupportedVariants = fakeVariants.map((variant, index) => index === 0 ? { ...variant, resume: { ...variant.resume, coreSkills: ["SQL", ...variant.resume.coreSkills] } } : variant);
const unsupportedAudit = auditRoleDistinctness(supportLane, fakeSameLane, [...pack.variants.filter((item) => item.laneId === "support"), ...unsupportedVariants], dossier);
check("anti-gaming unsupported skill creates integrity failure", unsupportedAudit.truthIntegrityFailures.some((item) => item.includes("coreSkills.0")));
check("anti-gaming unsupported skill cannot pass", unsupportedAudit.decision !== "meaningfully-distinct");

const savedState = { ...emptyState(), dossier: benchmarkDossier(), lanes: [support, ops], resumePacks: [pack] };
const revived = parseState(JSON.stringify(savedState));
check("persistence retains descriptions", revived.lanes.every((item) => item.targetDescription));
check("persistence retains relevance receipts", revived.resumePacks[0].lanePacks.every((item) => item.relevanceReceipts.length > 0));
check("persistence retains distinctness audit", revived.resumePacks[0].roleDistinctnessAudits[0].decision === "meaningfully-distinct");
check("legacy lane without description remains readable", parseState(JSON.stringify({ ...emptyState(), lanes: [{ ...support, targetDescription: undefined }] })).lanes[0].targetDescription === undefined);

const artifactDir = process.env.ROLE_DISTINCTNESS_ARTIFACT_DIR;
if (artifactDir) {
  fs.mkdirSync(artifactDir, { recursive: true });
  const matrixEntry = (name, rolePair, candidateEvidenceStructure, expectedDifference, fixturePack) => ({
    name, rolePair, candidateEvidenceStructure, expectedDifference,
    audit: fixturePack.roleDistinctnessAudits?.[0] ?? null,
    lanes: fixturePack.lanePacks.map((lp) => {
      const variant = fixturePack.variants.find((item) => item.laneId === lp.laneId && item.kind === "ats");
      return {
        laneId: lp.laneId,
        topEvidence: top(lp, 8),
        skills: variant?.resume.coreSkills.slice(0, 6) ?? [],
        bulletEvidence: bulletIds(variant).slice(0, 8),
        projects: projects(variant),
        summary: variant?.resume.summary ?? "",
        truthIntegrity: variant ? variant.evidenceReferences.every((ref) => ref.evidenceIds.length > 0 && ref.evidenceIds.every((id) => Boolean(ref.evidenceRevisions?.[id]))) : false
      };
    })
  });
  const artifactManifest = {
    generatedAt: NOW, audit, variants: [],
    fixtureMatrix: [
      matrixEntry("A", [support.title, ops.title], "Support-specific, operations-specific, shared facts; ten role-specific skills; three projects.", "Distinct evidence, skills, bullets, top project, summary, and supporting material.", pack),
      matrixEntry("B", [successLane.title, coordinatorLane.title], "Customer/relationship and process/reporting evidence.", "Customer evidence rises for Success; process/reporting rises for Operations.", fixtureB),
      matrixEntry("C", [technicalLane.title, implementationLane.title], "Troubleshooting plus coordination/setup-adjacent evidence.", "Troubleshooting rises for Support; coordination evidence rises for Implementation without inventing training.", fixtureC),
      matrixEntry("D", [support.title, adjacentLane.title], "High-overlap support evidence with shared documentation/collaboration.", "Legitimate overlap remains; no artificial hiding.", fixtureD),
      matrixEntry("E", [support.title, ops.title], "Three shared transferable facts only.", "Insufficient-evidence result with no fabricated project or skill.", sparsePack),
      matrixEntry("F", [support.title, ops.title], "Diverse role evidence but one shared project.", "Shared project may remain in both while other dimensions differ.", oneProjectPack),
      matrixEntry("G", [ops.title], "Operations evidence plus an aspirational SQL goal.", "SQL remains a target gap, never a candidate skill.", aspirationPack),
      matrixEntry("H", [support.title, ops.title], "Strong fixture with corrected support evidence revision.", "Old output fails closed; regenerated rankings bind the current revision.", regenerated),
      matrixEntry("I", [support.title], "Strong fixture with the most relevant support fact rejected.", "Rejected fact disappears; next eligible evidence is used.", rejectedPack),
      matrixEntry("J", [sameA.title, sameB.title], "Same title, customer-onboarding description versus process-reporting description.", "Descriptions produce different signals and evidence priorities.", samePack)
    ]
  };
  const mammoth = await import("mammoth");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const extracted = new Map();
  for (const variant of pack.variants) {
    const laneTitle = variant.laneId === "support" ? support.title : ops.title;
    const lanePack = pack.lanePacks.find((item) => item.laneId === variant.laneId);
    const entry = {
      variant: variant.title,
      laneId: variant.laneId,
      kind: variant.kind,
      evidenceIds: [...new Set(variant.evidenceReferences.flatMap((ref) => ref.evidenceIds))],
      skills: variant.resume.coreSkills,
      bulletClaimIds: variant.evidenceReferences.filter((ref) => ref.claimPath.includes(".bullets.")).map((ref) => ({ claimPath: ref.claimPath, evidenceIds: ref.evidenceIds })),
      projectIds: lanePack.relevanceReceipts.filter((receipt) => receipt.selectedFor.includes("project")).map((receipt) => receipt.evidenceId),
      summaryTargetSignals: lanePack.relevanceReceipts.filter((receipt) => receipt.selectedFor.includes("summary")).flatMap((receipt) => receipt.targetSignalIds),
      supportingMaterialEvidenceIds: lanePack.supportingMaterial.evidenceIds,
      files: {}
    };
    for (const format of ["pdf", "docx"]) {
      const file = await createVariantFile(variant, dossier, laneTitle, format);
      const buffer = Buffer.from(await file.blob.arrayBuffer());
      const outputPath = path.join(artifactDir, file.filename);
      fs.writeFileSync(outputPath, buffer);
      let textContent = "";
      if (format === "docx") textContent = (await mammoth.extractRawText({ buffer })).value;
      else {
        const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;
        const pages = [];
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber); const content = await page.getTextContent();
          pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
        }
        textContent = pages.join("\n");
      }
      extracted.set(`${variant.id}-${format}`, textContent.replace(/\s+/g, " ").trim());
      entry.files[format] = file.filename;
      fs.writeFileSync(path.join(artifactDir, `${file.filename}.txt`), textContent);
    }
    artifactManifest.variants.push(entry);
  }
  const bundle = await createPackBundle(pack, dossier, [support, ops], ["pdf", "docx"]);
  fs.writeFileSync(path.join(artifactDir, bundle.filename), Buffer.from(await bundle.blob.arrayBuffer()));
  fs.writeFileSync(path.join(artifactDir, "LinkedIn-and-Career-Materials.txt"), materialsText(pack, [support, ops], dossier));
  fs.writeFileSync(path.join(artifactDir, "evidence-comparison-manifest.json"), JSON.stringify(artifactManifest, null, 2));
  for (const variant of pack.variants) {
    const pdf = extracted.get(`${variant.id}-pdf`).toLowerCase();
    const docx = extracted.get(`${variant.id}-docx`).toLowerCase();
    const semanticAnchors = [variant.resume.summary, ...variant.resume.coreSkills.slice(0, 4), ...variant.resume.experience.flatMap((item) => [item.title, ...item.bullets.slice(0, 2)])].map((item) => item.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
    check(`artifact ${variant.laneId}/${variant.kind} PDF and DOCX share semantic anchors`, semanticAnchors.filter((anchor) => pdf.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").includes(anchor) && docx.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").includes(anchor)).length >= Math.min(5, semanticAnchors.length));
    check(`artifact ${variant.laneId}/${variant.kind} has no unsupported SQL`, !pdf.includes("sql") && !docx.includes("sql"));
  }
  check("artifact bundle inventory contains all ten expected files", bundle.filenames.length === 10 && bundle.filenames.filter((name) => name.endsWith(".pdf")).length === 4 && bundle.filenames.filter((name) => name.endsWith(".docx")).length === 4);
  check("artifact supporting text contains both lane pitches", materialsText(pack, [support, ops], dossier).includes(support.title) && materialsText(pack, [support, ops], dossier).includes(ops.title));
  check("artifact support and operations PDFs differ semantically", extracted.get(`${supportAts.id}-pdf`) !== extracted.get(`${opsAts.id}-pdf`));
  check("artifact support and operations DOCX differ semantically", extracted.get(`${supportAts.id}-docx`) !== extracted.get(`${opsAts.id}-docx`));
}

if (failures) {
  console.error(`\nrole distinctness contract: ${passes} passed, ${failures} failed`);
  process.exit(1);
}
console.log(`\nrole distinctness contract: ${passes}/${passes} passed`);
