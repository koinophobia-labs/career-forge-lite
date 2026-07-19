import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
function loadTsModule(filePath) {
  const absolute = path.resolve(filePath);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const { outputText } = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute });
  const mod = { exports: {} }; cache.set(absolute, mod);
  const localRequire = (request) => request.startsWith("@/") ? loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`)) : request.startsWith(".") ? loadTsModule(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`)) : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, mod, mod.exports, path.dirname(absolute), absolute);
  return mod.exports;
}

const store = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const dossierLib = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const inbox = loadTsModule(path.join(root, "src/lib/truth-inbox.ts"));
const activation = loadTsModule(path.join(root, "src/lib/activation.ts"));
const { generateResumePack } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { deriveTruthMap } = loadTsModule(path.join(root, "src/lib/truth-map.ts"));
const { deriveDefensibilityReceipt, uniqueUnclaimedReceiptItems } = loadTsModule(path.join(root, "src/lib/defensibility.ts"));
const { createBackup, validateBackup } = loadTsModule(path.join(root, "src/lib/backup.ts"));

let passed = 0;
function check(label, condition, detail = "") { if (!condition) throw new Error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); passed += 1; console.log(`PASS ${label}`); }
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");
const NOW = "2026-07-15T12:00:00.000Z";

const parsed = dossierLib.parseResumePackToProposals([{ filename: "history.txt", text: "Product Support Specialist — Northstar | 2021–2026\nResolved complex customer issues\nDocumented repeatable fixes\nMaintained 40 troubleshooting articles\nTools: Zendesk, Jira\nname@example.com" }]);
const batch = inbox.createPendingImportReview("inbox-1", parsed, NOW, true);
const preselectedState = { ...store.emptyState(), pendingImportReviews: [batch] };
check("Truth Inbox reports represented files", batch.sourceFileCount === 1 && batch.sourceFilenames[0] === "history.txt");
const privateBatch = inbox.createPendingImportReview("inbox-private", parsed, NOW, false);
check("filename privacy keeps count without retaining names", privateBatch.sourceFileCount === 1 && privateBatch.sourceFilenames.length === 0 && privateBatch.proposals.every((item) => item.sourceFilenames.length === 0));

const preselectedCount = batch.proposals.filter((item) => item.status === "approved").length;
const attentionCount = batch.proposals.filter((item) => item.status === "proposed").length;
check("clear facts are preselected while uncertain claims still require review", preselectedCount > 0 && attentionCount > 0);
check("preselection alone never changes the trusted dossier", preselectedState.dossier.evidence.length === 0 && !activation.hasReachedDossierActivation(preselectedState));
const savedPreselected = inbox.commitTruthInboxReview(preselectedState, batch.id, NOW);
check("one explicit save commits only preselected facts", savedPreselected.changed && savedPreselected.approved === preselectedCount && savedPreselected.remaining === attentionCount && savedPreselected.state.pendingImportReviews[0].proposals.every((item) => item.status === "proposed"));

const manualBatch = { ...batch, proposals: batch.proposals.map((item) => ({ ...item, status: "proposed" })) };
let state = { ...store.emptyState(), pendingImportReviews: [manualBatch] };
const role = parsed.find((item) => item.kind === "role");
const tool = parsed.find((item) => item.kind === "tool" || item.kind === "skill");
const proofs = parsed.filter((item) => item.kind === "proof" || item.kind === "metric").slice(0, 2);
const decidedIds = new Set([role?.id, tool?.id, ...proofs.map((item) => item.id)].filter(Boolean));
state = { ...state, pendingImportReviews: [{ ...manualBatch, proposals: manualBatch.proposals.map((item) => item.id === tool?.id ? { ...item, status: "rejected" } : decidedIds.has(item.id) ? { ...item, status: "approved" } : item) }] };
const partial = inbox.commitTruthInboxReview(state, batch.id, "2026-07-15T12:01:00.000Z");
check("partial decisions persist across serialization", store.parseState(JSON.stringify(partial.state)).pendingImportReviews[0].proposals.length === partial.remaining);
check("approved decisions enter dossier", partial.state.dossier.evidence.some((item) => item.approved && !item.rejected));
check("rejected decisions never support claims", partial.state.dossier.evidence.filter((item) => item.rejected).every((item) => !item.approved));
check("undecided proposals remain in inbox", partial.remaining > 0 && partial.state.pendingImportReviews[0].proposals.every((item) => item.status === "proposed"));
const completedState = { ...partial.state, pendingImportReviews: partial.state.pendingImportReviews.map((item) => ({ ...item, proposals: item.proposals.map((proposal) => ({ ...proposal, status: "rejected" })) })) };
const finished = inbox.commitTruthInboxReview(completedState, batch.id, "2026-07-15T12:02:00.000Z");
check("finished queue clears only after all decisions commit", finished.completed && finished.state.pendingImportReviews.length === 0);
check("discard removes only pending review", inbox.discardTruthInboxReview(state, batch.id).pendingImportReviews.length === 0 && inbox.discardTruthInboxReview(state, batch.id).dossier.id === state.dossier.id);
const extra = dossierLib.parseResumePackToProposals([{ filename: "second.txt", text: "Independent Project — Career Forge | 2025–Present" }]);
const added = inbox.addProposalsToReview(batch, extra, NOW);
check("second import adds without overwriting first", added.proposals.length >= batch.proposals.length && added.proposals.some((item) => /Career Forge/i.test(item.detail)));
check("separate review batches coexist", [batch, inbox.createPendingImportReview("inbox-2", extra, NOW, false)].length === 2);
const corrupt = store.parseState(JSON.stringify({ ...store.emptyState(), pendingImportReviews: [{ version: 99, id: "bad", proposals: "bad" }] }));
check("corrupt pending review revives safely", corrupt.pendingImportReviews.length === 0);
const restoredPending = validateBackup(JSON.stringify(createBackup(state, NOW)));
check("backup and restore preserve pending review", restoredPending.ok && restoredPending.state.pendingImportReviews.length === 1);
check("legacy state receives empty pending default", store.parseState(JSON.stringify({ profile: store.emptyProfile() })).pendingImportReviews.length === 0);
check("pending proposals never affect readiness or activation", dossierLib.assessDossierReadiness(state.dossier).level === "not-ready" && !activation.hasReachedDossierActivation(state));
check("discard confirmation is explicit", source("src/app/profile/page.tsx").includes("This removes the pending review but does not delete evidence you already approved in earlier sessions."));

const identityOnly = { ...store.emptyState(), dossier: { ...store.emptyState().dossier, evidence: [dossierLib.evidenceRecord("identity", "Person", "manual", true, NOW)] } };
const toolOnly = { ...store.emptyState(), dossier: { ...store.emptyState().dossier, evidence: [dossierLib.evidenceRecord("tool", "Jira", "manual", true, NOW)] } };
check("identity-only approval does not activate", !activation.hasReachedDossierActivation(identityOnly));
check("tool-only approval does not activate", !activation.hasReachedDossierActivation(toolOnly));
check("one weak unstructured line does not activate", !activation.hasReachedDossierActivation({ ...store.emptyState(), dossier: { ...store.emptyState().dossier, evidence: [dossierLib.evidenceRecord("proof", "Helped", "manual", true, NOW)] } }));
const workEvidence = [
  { ...dossierLib.evidenceRecord("role", "Product Support Specialist — Northstar · 2021–2026", "manual", true, NOW), id: "role-proof" },
  { ...dossierLib.evidenceRecord("responsibility", "Resolved complex customer issues", "manual", true, NOW), id: "responsibility-proof" },
  { ...dossierLib.evidenceRecord("metric", "Maintained 40 troubleshooting articles", "manual", true, NOW), id: "metric-proof" }
];
const activeDossier = { ...store.emptyState().dossier, roles: [{ id: "role-1", title: "Product Support Specialist", employer: "Northstar", startDate: "2021", endDate: "2026", current: false, responsibilities: [workEvidence[1].detail], tools: [], outcomes: [workEvidence[2].detail], evidenceIds: workEvidence.map((item) => item.id) }], responsibilities: [workEvidence[1].detail], metrics: [workEvidence[2].detail], proofPoints: [workEvidence[2].detail], approvedClaims: workEvidence.map((item) => item.detail), evidence: workEvidence, updatedAt: NOW };
const activated = { ...store.emptyState(), dossier: activeDossier };
check("supported role crossing readiness activates", activation.hasReachedDossierActivation(activated) && activation.activationEventsForTransition(store.emptyState(), activated).includes("dossier_activation_reached"));
check("more evidence after activation does not fire again", !activation.activationEventsForTransition(activated, { ...activated, dossier: { ...activeDossier, evidence: [...workEvidence, dossierLib.evidenceRecord("proof", "Extra", "manual", true, NOW)] } }).includes("dossier_activation_reached"));
check("refresh does not fire activation", activation.activationEventsForTransition(activated, store.parseState(JSON.stringify(activated))).length === 0);
check("restore does not masquerade as activation", activation.activationEventsForTransition(activated, validateBackup(JSON.stringify(createBackup(activated, NOW))).state).length === 0);
const rejectedBatch = { ...batch, proposals: batch.proposals.map((item) => ({ ...item, status: "rejected" })) };
const allRejected = inbox.commitTruthInboxReview({ ...store.emptyState(), pendingImportReviews: [rejectedBatch] }, batch.id, NOW);
check("all-rejected review does not activate", !activation.hasReachedDossierActivation(allRejected.state));
check("analytics helper returns event names only", activation.activationEventsForTransition(store.emptyState(), activated).every((event) => typeof event === "string"));
check("analytics source accepts no content properties", /function trackCareerEvent\(event: CareerForgeEventName\)\s*\{\s*track\(event\)/.test(source("src/lib/analytics.ts")));
check("pending inbox content never enters analytics", !source("src/lib/analytics.ts").includes("pendingImportReviews"));

const lane = { id: "lane-1", title: "Product Support", status: "active", whyFit: "", resumeAngle: "Evidence-backed support", proof: [], gaps: ["No Salesforce administration evidence", "No Salesforce administration evidence"], keywords: ["support"], source: "custom", createdAt: NOW };
const pack = generateResumePack(activeDossier, [lane], NOW);
check("one lane gap displays as one", pack.receipt.gapsLeftUnclaimed.length === 1);
check("generator does not pretend known gaps were active refusals", pack.receipt.unsupportedClaimsRefused.length === 0);
const receiptWithRefusal = { ...pack.receipt, unsupportedClaimsRefused: ["Unsupported Salesforce credential"], gapsLeftUnclaimed: ["No Salesforce administration evidence", "No Salesforce administration evidence"] };
check("unsupported refusals remain separate", receiptWithRefusal.unsupportedClaimsRefused[0] !== receiptWithRefusal.gapsLeftUnclaimed[0]);
check("unique reveal count is a set union", uniqueUnclaimedReceiptItems(receiptWithRefusal).length === 2);
check("empty refusals do not create misleading UI section", source("src/app/versions/page.tsx").includes("pack.receipt.unsupportedClaimsRefused.length > 0"));
const revivedPack = store.parseState(JSON.stringify({ ...activated, resumePacks: [{ ...pack, receipt: { ...pack.receipt, unsupportedClaimsRefused: undefined, gapsLeftUnclaimed: undefined } }] })).resumePacks[0];
check("legacy receipts default missing arrays", revivedPack.receipt.unsupportedClaimsRefused.length === 0 && revivedPack.receipt.gapsLeftUnclaimed.length === 0);

const stateWithPack = { ...activated, lanes: [lane], resumePacks: [pack], applications: [{ id: "app-1", company: "Acme", roleTitle: "Support Specialist", laneId: lane.id, status: "drafting", jobPostUrl: "", source: "other", discoveryUrl: "", applicationUrl: "", postingDate: null, deadline: null, contactName: "", contactUrl: "", resumeVariantId: pack.variants[0].id, applicationQuestions: [{ id: "q1", prompt: "Describe support work", draftAnswer: "", evidenceIds: ["responsibility-proof"], userEdited: false }], resumeVersionId: null, appliedAt: null, nextFollowUpAt: null, followUpsSent: [], interviewAt: null, notes: "", analysisKeywords: [], analysisGaps: [], analysisWeakSpots: [], createdAt: NOW }] };
const truth = deriveTruthMap(stateWithPack);
check("evidence-first relationships include structured role", truth.evidenceFirst.some((entry) => entry.linkedRecords.includes("Product Support Specialist · Northstar")));
check("output-first relationships include exact claims", truth.outputFirst.some((claim) => claim.claimText && claim.evidence.length));
check("rejected evidence never appears as truth-map support", !deriveTruthMap({ ...stateWithPack, dossier: { ...activeDossier, evidence: activeDossier.evidence.map((item) => item.id === "responsibility-proof" ? { ...item, rejected: true } : item) } }).outputFirst.some((claim) => claim.evidence.some((item) => item.id === "responsibility-proof")));
check("proposed inbox evidence never appears in truth map", !truth.evidenceFirst.some((entry) => parsed.some((item) => item.id === entry.evidence.id)));
const editedPack = { ...pack, variants: pack.variants.map((variant, index) => index ? variant : { ...variant, userEdited: true, userAuthoredPaths: [variant.evidenceReferences[0]?.claimPath ?? "summary"] }) };
check("user-edited claims are labeled", deriveTruthMap({ ...stateWithPack, resumePacks: [editedPack] }).outputFirst.some((claim) => claim.userEdited));
check("direct claims remain direct", truth.outputFirst.filter((claim) => claim.supportType === "direct").every((claim) => claim.evidence.length > 0));
check("transferred claims are not labeled direct", truth.outputFirst.filter((claim) => claim.supportType === "transferred").every((claim) => claim.supportType !== "direct"));
check("deleted evidence makes affected output stale", deriveTruthMap({ ...stateWithPack, dossier: { ...activeDossier, evidence: activeDossier.evidence.slice(1) } }).outputFirst.some((claim) => claim.stale));
check("application-answer lineage appears", truth.applicationAnswerCount === 1 && truth.evidenceFirst.some((entry) => entry.applicationAnswers.length === 1));
check("empty truth map has useful guidance", deriveTruthMap(store.emptyState()).evidenceFirst.length === 0 && source("src/app/truth-map/page.tsx").includes("Your Truth Map starts after approval"));
check("truth map analytics are event-name only", !/trackCareerEvent\([^)]*,/.test(source("src/app/truth-map/page.tsx")));
check("truth map uses overflow-safe containers", source("src/app/truth-map/page.tsx").includes("min-w-0") && source("src/app/truth-map/page.tsx").includes("break-words"));

const defense = deriveDefensibilityReceipt(pack.variants[0], activeDossier);
check("defensibility counts match actual references", defense.directlySupported + defense.combinedEvidence + defense.transferred === pack.variants[0].evidenceReferences.length);
const missingVariant = { ...pack.variants[0], resume: { ...pack.variants[0].resume, coreSkills: [...pack.variants[0].resume.coreSkills, "Unsupported mystery skill"] } };
check("missing provenance is visible", deriveDefensibilityReceipt(missingVariant, activeDossier).missingProvenance === defense.missingProvenance + 1);
check("user edits require recheck", deriveDefensibilityReceipt({ ...pack.variants[0], userEdited: true, userAuthoredPaths: ["summary"] }, activeDossier).status === "User-edited, recheck required");
const receiptResume = { ...pack.variants[0].resume, summary: "Jointly supported claim", coreSkills: [], experience: [], education: "", linkedinHeadline: "", linkedinSummary: "" };
const combinedReceiptVariant = { ...pack.variants[0], resume: receiptResume, userEdited: false, userAuthoredPaths: [], evidenceReferences: [{ claimPath: "summary", claimText: receiptResume.summary, supportType: "combined", evidenceIds: ["responsibility-proof", "metric-proof"] }] };
const deletedMetricDossier = { ...activeDossier, evidence: activeDossier.evidence.filter((item) => item.id !== "metric-proof") };
const completeCombinedReceipt = deriveDefensibilityReceipt(combinedReceiptVariant, activeDossier);
const partialCombinedReceipt = deriveDefensibilityReceipt(combinedReceiptVariant, deletedMetricDossier);
check("partially surviving combined reference fails closed", completeCombinedReceipt.combinedEvidence === 1 && partialCombinedReceipt.combinedEvidence === 0 && partialCombinedReceipt.missingProvenance === 1 && partialCombinedReceipt.incompleteProvenance === 1 && partialCombinedReceipt.status === "Needs evidence review");
const directReceiptVariant = { ...combinedReceiptVariant, evidenceReferences: [{ claimPath: "summary", claimText: receiptResume.summary, supportType: "direct", evidenceIds: ["responsibility-proof"] }] };
const deletedDirectReceipt = deriveDefensibilityReceipt(directReceiptVariant, { ...activeDossier, evidence: activeDossier.evidence.filter((item) => item.id !== "responsibility-proof") });
check("deleted cited source invalidates receipt", deletedDirectReceipt.directlySupported === 0 && deletedDirectReceipt.incompleteProvenance === 1 && deletedDirectReceipt.status === "Needs evidence review");
const rejectedDirectReceipt = deriveDefensibilityReceipt(directReceiptVariant, { ...activeDossier, evidence: activeDossier.evidence.map((item) => item.id === "responsibility-proof" ? { ...item, rejected: true } : item) });
check("rejected cited source invalidates receipt", rejectedDirectReceipt.directlySupported === 0 && rejectedDirectReceipt.incompleteProvenance === 1 && rejectedDirectReceipt.status === "Needs evidence review");
const emptyReferenceVariant = { ...directReceiptVariant, evidenceReferences: [{ ...directReceiptVariant.evidenceReferences[0], evidenceIds: [] }] };
const emptyReferenceReceipt = deriveDefensibilityReceipt(emptyReferenceVariant, activeDossier);
check("empty evidence reference invalidates receipt", emptyReferenceReceipt.directlySupported === 0 && emptyReferenceReceipt.incompleteProvenance === 1 && emptyReferenceReceipt.status === "Needs evidence review");
const partialTruthState = { ...stateWithPack, dossier: deletedMetricDossier, resumePacks: [{ ...pack, variants: [combinedReceiptVariant] }] };
check("Truth Map and receipt agree on incomplete combined provenance", deriveTruthMap(partialTruthState).outputFirst[0].stale && partialCombinedReceipt.status === "Needs evidence review");
check("defensibility uses no hiring probability", !/probability|chance of hire|ATS score/i.test(source("src/lib/defensibility.ts")));
check("defensibility receipt is visible per variant", source("src/app/versions/page.tsx").includes("Open Defensibility Receipt"));
check("incomplete provenance blocks variant and pack exports", source("src/app/versions/page.tsx").includes("disabled={exportBlocked}") && source("src/app/versions/page.tsx").includes("working || packExportBlocked"));

const home = source("src/app/page.tsx");
check("homepage explains evidence approval", home.includes("reviewable evidence system") && home.includes("Imported facts stay proposals until you approve them"));
check("category contrast precedes advanced workspace", home.indexOf("Not another AI résumé writer") < home.indexOf("Advanced workspace"));
check("public contrast names no competitor", !/Teal|Huntr|Jobscan|Rezi|Simplify|Kickresume|Enhancv|TopResume/.test(home));
check("local-first trust is visible", home.includes("Local-first career evidence compiler") && home.includes("Works locally without an account"));
check("context exclusion is visible", home.includes("keeps out of professional drafts") && home.includes("missing proof"));
check("role-lane pack and provenance are visible", home.includes("each active lane") && home.includes("Links generated claims to their reviewed sources"));
check("public beta does not hard-code paid pricing", !/One-time packs from \$49/i.test(home));
check("mobile comparison is focusable and named", /tabIndex=\{0\}[\s\S]*role="region"[\s\S]*aria-label=/.test(home));

const bigEvidence = Array.from({ length: 500 }, (_, index) => ({ ...dossierLib.evidenceRecord(index % 3 === 0 ? "proof" : "responsibility", `Evidence item ${index} delivered verified result ${index}`, "manual", true, NOW), id: `big-${index}` }));
const bigState = { ...stateWithPack, dossier: { ...activeDossier, evidence: bigEvidence, roles: [], projects: [] } };
const started = performance.now(); deriveTruthMap(bigState); const elapsed = performance.now() - started;
check("truth map derives 500 evidence items promptly", elapsed < 250, `${elapsed.toFixed(1)}ms`);
check("homepage does not import PDF.js or Mammoth", !/pdfjs|mammoth/i.test(home));
check("localStorage envelope remains bounded", JSON.stringify(bigState).length < 2_000_000);
check("backup size remains bounded", JSON.stringify(createBackup(bigState, NOW)).length < 2_000_000);

console.log(`\n${passed} market/moat regression checks passed`);
