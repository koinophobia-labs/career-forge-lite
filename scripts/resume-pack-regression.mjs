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
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
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
  const fn = new Function("require", "module", "exports", "__dirname", "__filename", outputText);
  fn(localRequire, cjsModule, cjsModule.exports, dirname, absolute);
  return cjsModule.exports;
}

const { resumePack, recommendResume, getPackResume } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { buildMatchBrief, renderMatchBrief } = loadTsModule(path.join(root, "src/lib/match-brief.ts"));
const { analyzeJobPost } = loadTsModule(path.join(root, "src/lib/job-post-analyzer.ts"));
const { emptyProfile, parseState, emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));

let failures = 0;
let passes = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passes += 1;
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// --- Metadata shape and privacy ---------------------------------------------

check("pack has exactly four resume lanes", resumePack.length === 4, `got ${resumePack.length}`);
check("pack ids are unique", new Set(resumePack.map((r) => r.id)).size === 4);
for (const resume of resumePack) {
  check(`${resume.id}: has laneTitle, headline, usageNote`, Boolean(resume.laneTitle && resume.headline && resume.usageNote));
  check(`${resume.id}: fileName is a pdf export name`, /^Blake-Taylor-Resume-[A-Za-z-]+\.pdf$/.test(resume.fileName), resume.fileName);
  check(`${resume.id}: has a usable keyword set`, resume.keywords.length >= 10);
}

const serializedPack = JSON.stringify(resumePack);
check("privacy: no email addresses in metadata", !/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(serializedPack));
check("privacy: no personal-account or social handles in metadata", !/gmail|outlook|hotmail|icloud\.com|linkedin\.com|instagram|tiktok/i.test(serializedPack));
check("privacy: no phone numbers in metadata", !/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(serializedPack));
check("privacy: no bracket placeholders in metadata", !/\[(VERIFY|PRIVATE|LINKEDIN)/.test(serializedPack));

check("getPackResume resolves ids and rejects unknowns", getPackResume("fraud-risk-ops")?.id === "fraud-risk-ops" && getPackResume("nope") === null && getPackResume(null) === null);

// --- Recommendation routing --------------------------------------------------

const posts = {
  fraud: `Fraud Analyst — Sportsbook Operations
We're looking for someone to investigate suspicious transactions, work chargeback and dispute cases,
run KYC and AML checks, and support responsible gaming compliance. You'll monitor payments risk in a
regulated gaming environment and escalate fraud patterns like account takeover.`,
  aiqa: `AI Support Specialist / QA
Join our technical support team for an AI product. You'll troubleshoot customer issues, write bug
reports, run test cases and regression testing, maintain documentation, and handle ticketing in Zendesk.
Experience with LLM products, prompt workflows, and SaaS product operations is a plus.`,
  cs: `Implementation Specialist — Customer Success
Own client onboarding end to end: discovery, requirements, CRM setup in Salesforce or HubSpot, training,
and adoption. You'll manage renewals, watch churn and health score signals, and build lasting client
relationships as part of the customer success team.`,
  community: `Community Manager — Trust & Safety
Run our Discord community: moderation, enforcing community guidelines, escalation of abuse reports,
content moderation, and policy enforcement. You'll drive engagement, work with creators, and partner
with the trust and safety team to keep users safe.`,
  unrelated: `Line Cook — Busy Downtown Kitchen
Prep stations, grill orders during rush, keep the kitchen clean, receive food deliveries, and help
close on weekends. Reliable, fast, and comfortable on your feet for full shifts.`
};

const fraudRec = recommendResume(posts.fraud);
check("fraud/RG post → Fraud/Risk resume", fraudRec.best?.resume.id === "fraud-risk-ops", `got ${fraudRec.best?.resume.id}`);
check("fraud rec includes matched-term reasons", fraudRec.best.matchedTerms.includes("fraud") && fraudRec.best.matchedTerms.length >= 5);
check("fraud rec is not weak-fit", fraudRec.weakFit === false);

const aiRec = recommendResume(posts.aiqa);
check("AI/QA post → AI Product Support resume", aiRec.best?.resume.id === "ai-product-support-qa", `got ${aiRec.best?.resume.id}`);
check("AI rec is not weak-fit", aiRec.weakFit === false);

const csRec = recommendResume(posts.cs);
check("implementation/onboarding post → Customer Success resume", csRec.best?.resume.id === "customer-success-implementation", `got ${csRec.best?.resume.id}`);
check("CS rec is not weak-fit", csRec.weakFit === false);

const communityRec = recommendResume(posts.community);
check("moderation/safety post → Community/T&S resume", communityRec.best?.resume.id === "community-trust-safety", `got ${communityRec.best?.resume.id}`);
check("community rec is not weak-fit", communityRec.weakFit === false);

const unrelatedRec = recommendResume(posts.unrelated);
check("unrelated post → weak-fit warning", unrelatedRec.weakFit === true, `score ${unrelatedRec.best?.score ?? 0}`);

check("ranked list always contains all four lanes", fraudRec.ranked.length === 4);
check("recommendation note frames it as a suggestion", /suggestion/i.test(fraudRec.note));

// --- Match Brief integration ---------------------------------------------------

const profile = {
  ...emptyProfile(),
  currentSituation: "sportsbook and product lab work",
  targetRoles: "Fraud Operations",
  transferableSkills: ["de-escalation", "fraud", "documentation"],
  experienceSummary: "Regulated gaming floor plus founder work.",
  strengths: ["calm under pressure"],
  proofPoints: "Handled high-volume regulated transactions with audited accuracy.",
  updatedAt: "2026-07-09T12:00:00.000Z"
};

{
  const analysis = analyzeJobPost(posts.fraud, profile, null);
  const brief = buildMatchBrief({ analysis, profile, lane: null, company: "BetCo", roleTitle: "Fraud Analyst", jobPost: posts.fraud });
  check("brief includes resume recommendation when jobPost provided", brief.resumeRecommendation?.best?.resume.id === "fraud-risk-ops");
  check("brief includes pre-apply checklist", brief.checklist.length >= 4);
  const rendered = renderMatchBrief(brief);
  check("render includes RECOMMENDED RESUME section", rendered.includes("RECOMMENDED RESUME") && rendered.includes("Blake-Taylor-Resume-Fraud-Risk-Operations.pdf"));
  check("render includes usage note", rendered.includes("Usage:"));
  check("render includes PRE-APPLY CHECKLIST", rendered.includes("PRE-APPLY CHECKLIST") && rendered.includes("[ ]"));

  const briefWithout = buildMatchBrief({ analysis, profile, lane: null, company: "BetCo", roleTitle: "Fraud Analyst" });
  check("brief without jobPost has null recommendation and still renders", briefWithout.resumeRecommendation === null && renderMatchBrief(briefWithout).includes("PRE-APPLY CHECKLIST"));
}

// --- Application record storage ------------------------------------------------

{
  const state = emptyState();
  state.applications.push({
    id: "app-test-1",
    company: "BetCo",
    roleTitle: "Fraud Analyst",
    laneId: null,
    status: "applied",
    jobPostUrl: "https://example-jobs.test/fraud-analyst",
    resumeVersionId: null,
    appliedAt: "2026-07-09T12:00:00.000Z",
    nextFollowUpAt: "2026-07-14T12:00:00.000Z",
    followUpsSent: [],
    interviewAt: null,
    notes: "",
    analysisKeywords: ["fraud"],
    analysisGaps: [],
    analysisWeakSpots: [],
    packResumeId: "fraud-risk-ops",
    briefText: "MATCH BRIEF — test",
    outreachMessage: "Hi [Name] — test message",
    createdAt: "2026-07-09T12:00:00.000Z"
  });

  const revived = parseState(JSON.stringify(state));
  const app = revived.applications[0];
  check("roundtrip preserves packResumeId", app.packResumeId === "fraud-risk-ops");
  check("roundtrip preserves briefText", app.briefText === "MATCH BRIEF — test");
  check("roundtrip preserves outreachMessage", app.outreachMessage === "Hi [Name] — test message");
  check("roundtrip preserves jobPostUrl", app.jobPostUrl === "https://example-jobs.test/fraud-analyst");

  // Legacy record without the new fields must revive with safe defaults.
  const legacy = JSON.parse(JSON.stringify(state));
  delete legacy.applications[0].packResumeId;
  delete legacy.applications[0].briefText;
  delete legacy.applications[0].outreachMessage;
  const migrated = parseState(JSON.stringify(legacy)).applications[0];
  check("legacy record migrates: packResumeId defaults to null", migrated.packResumeId === null);
  check("legacy record migrates: briefText defaults to empty", migrated.briefText === "");
  check("legacy record migrates: outreachMessage defaults to empty", migrated.outreachMessage === "");
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
