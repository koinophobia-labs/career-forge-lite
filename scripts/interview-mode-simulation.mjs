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

const { resumeToText } = loadTsModule(path.join(root, "src/lib/resume-export.ts"));
const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));
const { generateResumePackage } = loadTsModule(path.join(root, "src/lib/generator.ts"));
const {
  canGenerateResumeFromInterview,
  createInitialInterviewSession,
  createNextAssistantInterviewTurn,
  createUserInterviewMessage,
  generateResumePackageFromInterview,
  getInterviewCoachingMessages,
  getInterviewResumeReadinessSummary,
  getSmartInterviewSummary,
  updateInterviewDraftFromUserAnswer
} = loadTsModule(path.join(root, "src/lib/interview-mode.ts"));

const fixtures = [
  {
    id: "vague_user",
    targetRole: "Customer Success Associate",
    answers: [
      "Customer Success Associate",
      "I helped customers.",
      "I used software.",
      "I solved account questions and talked to people.",
      "I do not know numbers.",
      "I used Zendesk and Slack."
    ],
    expectedFacts: ["Customer Success Associate", "Zendesk"],
    expectedWeakAreas: ["Scope or metrics"],
    expectedReady: false
  },
  {
    id: "strong_user",
    targetRole: "Operations Associate",
    answers: [
      "Operations Associate in logistics",
      "I have three years of operations and customer support experience.",
      "I worked as an Operations Coordinator at Amazon from 2023 - 2026.",
      "I coordinated schedules, prepared reports, tracked task handoffs, and maintained SOP documentation.",
      "I improved shift handoff accuracy and reduced missed updates.",
      "I supported 5 weekly reports, 40+ daily orders, and a team of 8.",
      "I used Excel, Google Sheets, Slack, and SharePoint."
    ],
    expectedFacts: ["Operations Associate", "Amazon", "Excel", "40+ daily orders"],
    expectedWeakAreas: [],
    expectedReady: true
  },
  {
    id: "career_changer",
    targetRole: "Administrative Assistant",
    answers: [
      "Administrative Assistant in healthcare",
      "I am changing careers from retail into admin work.",
      "I worked as a Retail Associate at Target from 2022 - 2025.",
      "I handled customer communication, returns, schedule questions, records, cash handling, and store presentation.",
      "I improved customer follow-up and kept return records accurate.",
      "I used POS systems, Excel, Google Workspace, and inventory systems.",
      "I do not have direct admin experience yet, but I am learning office workflows."
    ],
    expectedFacts: ["Administrative Assistant", "Retail Associate", "Target", "Google Workspace"],
    expectedWeakAreas: ["Scope or metrics"],
    expectedReady: true,
    forbiddenOutput: ["still learning office workflows"]
  },
  {
    id: "no_metrics_user",
    targetRole: "Project Coordinator",
    answers: [
      "Project Coordinator in business operations",
      "I supported coordination work and documentation.",
      "I worked as an Administrative Coordinator at Northstar Services from 2024 - Present.",
      "I tracked timelines, coordinated meetings, prepared status notes, and maintained project documentation.",
      "I improved follow-through by creating clearer meeting notes and task lists.",
      "I used Asana, Google Sheets, Slack, and Notion.",
      "I do not have numbers yet."
    ],
    expectedFacts: ["Project Coordinator", "Asana", "Northstar Services"],
    expectedWeakAreas: ["Scope or metrics"],
    expectedReady: true
  },
  {
    id: "student_or_entry_level",
    targetRole: "Junior QA Analyst",
    answers: [
      "Junior QA Analyst in technology",
      "I am an entry-level student with coursework and part-time work.",
      "I do not have a full-time tech job yet.",
      "I tested class projects, documented bugs, wrote test cases, and helped classmates troubleshoot.",
      "I built a QA checklist project for a web app and found several broken form states.",
      "I used GitHub, VS Code, Google Sheets, and browser dev tools.",
      "I completed software testing coursework at community college."
    ],
    expectedFacts: ["Junior QA Analyst", "GitHub", "QA checklist"],
    expectedWeakAreas: ["Scope or metrics"],
    expectedReady: true
  },
  {
    id: "technical_founder",
    targetRole: "Technical Product Analyst",
    answers: [
      "Technical Product Analyst in software",
      "I founded Koinophobia Labs and built several web products.",
      "I built apps including Career Forge Lite, Creator Command Center, and internal workflow tools.",
      "I managed product requirements, wrote documentation, tested releases, and shipped features.",
      "I improved launch readiness by creating smoke tests, QA reports, and deployment checklists.",
      "I used Next.js, TypeScript, GitHub, Vercel, Tailwind CSS, and SQL.",
      "I shipped 3+ products and maintained public GitHub repos."
    ],
    expectedFacts: ["Technical Product Analyst", "Koinophobia Labs", "Next.js", "3+ products"],
    expectedWeakAreas: [],
    expectedReady: true
  },
  {
    id: "customer_service_worker",
    targetRole: "Customer Support Specialist",
    answers: [
      "Customer Support Specialist in retail technology",
      "I have frontline customer service experience.",
      "I worked as a Customer Service Associate at Walgreens from 2021 - 2024.",
      "I handled conflict resolution, returns, cash handling, policy enforcement, inventory questions, and teamwork during busy shifts.",
      "I improved customer satisfaction by resolving routine issues and escalating complex cases.",
      "I helped 60+ customers per shift and handled register transactions accurately.",
      "I used POS systems, inventory systems, phone support, and Microsoft Teams."
    ],
    expectedFacts: ["Customer Support Specialist", "Walgreens", "60+ customers", "POS systems"],
    expectedWeakAreas: [],
    expectedReady: true
  }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function questionTopic(question) {
  const normalized = normalize(question);
  if (/title company|job called|who was it|how long/.test(normalized)) return "recent_role_identity";
  if (/workplace|customer setting|work setting/.test(normalized)) return "work_setting";
  if (/what should i call|resume label|call that experience/.test(normalized)) return "resume_label";
  if (/paid work|school|volunteering|personal project/.test(normalized)) return "proof_type";
  if (/recent role|main recent experience/.test(normalized)) return "recent_role_identity";
  if (/target|job title|role should this resume|role are you targeting/.test(normalized)) return "target_role";
  if (/problems were you solving|problems did you solve|solving most often/.test(normalized)) return "problem_solving";
  if (/requests|workflows|customers|records|schedules|systems|issues/.test(normalized)) return "workflow_scope";
  if (/best prepared|prepared you/.test(normalized)) return "role_bridge";
  if (/responsibilities were you trusted|trusted with|most weeks|every shift|duties/.test(normalized)) return "responsibility_detail";
  if (/responsibil/.test(normalized)) return "responsibilities";
  if (/measurable|volume|how many|scale|customers|tickets|calls|reports/.test(normalized)) return "metrics";
  if (/tools|software|systems|platforms|skills|equipment|workflows/.test(normalized)) return "tools";
  if (/project|portfolio|proof|dashboard|launch/.test(normalized)) return "projects";
  if (/improved|result|win|outcome|changed|speed|accuracy/.test(normalized)) return "results";
  if (/education|certification|training|course|degree/.test(normalized)) return "education";
  return "general";
}

function assertNoDuplicateQuestions(session, profileId) {
  const questions = session.memory.followUpHistory.map((followUp) => followUp.question);
  const normalized = questions.map(normalize);
  assert(new Set(normalized).size === normalized.length, `${profileId}: no exact repeated questions`);
  const topics = session.memory.followUpHistory.map((followUp) => questionTopic(followUp.question)).filter((topic) => topic !== "general");
  const repeatedTopics = topics.filter((topic, index) => topics.indexOf(topic) !== index);
  assert(repeatedTopics.length === 0, `${profileId}: no near-duplicate question topics (${repeatedTopics.join(", ")})`);
}

function runProfile(profile) {
  let session = createInitialInterviewSession();
  const earlyReadiness = [];

  for (const [index, answer] of profile.answers.entries()) {
    session = updateInterviewDraftFromUserAnswer(session, createUserInterviewMessage(answer));
    earlyReadiness.push(canGenerateResumeFromInterview(session));
    session = createNextAssistantInterviewTurn(session);
    const lastAssistant = session.messages.at(-1)?.content ?? "";
    assert(/Great|helpful|Perfect|Excellent|That|Nice|Got it|start/i.test(lastAssistant), `${profile.id}: assistant acknowledges answer ${index + 1}`);
  }

  const ready = canGenerateResumeFromInterview(session);
  const readiness = getInterviewResumeReadinessSummary(session);
  const smartSummary = getSmartInterviewSummary(session);
  const allDraftText = JSON.stringify(session.resumeDraft).toLowerCase();
  const generated = ready ? generateResumePackageFromInterview(session) : null;
  const resumeText = generated ? resumeToText(generated.intake, generated.resume) : "";

  assertNoDuplicateQuestions(session, profile.id);
  assert(session.memory.conversationScore >= 0, `${profile.id}: conversation score exists`);
  assert(smartSummary.learned.length > 0, `${profile.id}: smart summary learned facts`);
  assert(earlyReadiness.slice(0, 3).every((value) => value === false), `${profile.id}: readiness does not unlock too early`);
  assert(ready === profile.expectedReady, `${profile.id}: readiness expected ${profile.expectedReady} got ${ready}`);

  for (const fact of profile.expectedFacts) {
    const factNeedle = fact.toLowerCase();
    assert(allDraftText.includes(factNeedle) || resumeText.toLowerCase().includes(factNeedle), `${profile.id}: expected fact ${fact}`);
  }

  for (const area of profile.expectedWeakAreas) {
    assert(readiness.weakAreas.some((weakArea) => weakArea.toLowerCase().includes(area.toLowerCase())), `${profile.id}: expected weak area ${area}`);
  }

  if (profile.forbiddenOutput) {
    for (const forbidden of profile.forbiddenOutput) {
      assert(!resumeText.toLowerCase().includes(forbidden.toLowerCase()), `${profile.id}: forbidden output ${forbidden}`);
    }
  }

  assert(!/fake metric|made up|invented number/i.test(resumeText), `${profile.id}: no fake metric language`);

  if (ready) {
    assert(generated.resume.summary.trim(), `${profile.id}: generated summary`);
    assert(generated.resume.experience.flatMap((role) => role.bullets).filter(Boolean).length >= 2, `${profile.id}: generated bullets`);
    assert(generated.resume.linkedinHeadline.includes(profile.targetRole), `${profile.id}: generated headline includes target`);
  } else {
    assert(getInterviewCoachingMessages(session).length > 0, `${profile.id}: receives coaching when not ready`);
  }

  return {
    id: profile.id,
    ready,
    strength: readiness.strengthLabel,
    conversationScore: session.memory.conversationScore,
    weakAreas: readiness.weakAreas,
    learned: smartSummary.learned,
    generated: Boolean(generated)
  };
}

const results = fixtures.map(runProfile);

const staticResume = generateResumePackage({
  ...initialIntake,
  fullName: "Static Builder Candidate",
  email: "static@example.com",
  targetJobTitle: "Customer Success Associate",
  roleFamily: "Customer Success",
  currentTitle: "Customer Service Associate",
  currentCompany: "Local Business",
  currentTime: "2024 - Present",
  selectedResponsibilities: ["Customer communication", "Support tickets"],
  tools: "Zendesk, Excel",
  selectedOutcomes: ["Customer satisfaction"]
});
assert(staticResume.summary.includes("Customer Success Associate"), "static builder remains unaffected");

console.log(JSON.stringify({ profiles: results }, null, 2));
