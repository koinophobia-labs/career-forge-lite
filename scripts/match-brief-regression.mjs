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

const { buildMatchBrief, renderMatchBrief, MATCH_BRIEF_HONESTY_NOTE } = loadTsModule(
  path.join(root, "src/lib/match-brief.ts")
);
const { analyzeJobPost } = loadTsModule(path.join(root, "src/lib/job-post-analyzer.ts"));
const { emptyProfile } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));

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

const NOW = "2026-07-09T12:00:00.000Z";

const profile = {
  ...emptyProfile(),
  currentSituation: "operations and customer-facing work, building a software company on the side",
  targetRoles: "Product Support Specialist, Fraud Ops",
  transferableSkills: ["de-escalation", "troubleshooting", "written communication"],
  experienceSummary: "Six years of retail and operations work handling high customer volume.",
  strengths: ["calm under pressure", "fast learner"],
  proofPoints:
    "Handled 50+ customer support tickets a day with a 96% satisfaction score.\nWrote the onboarding doc still used to train new hires.\nBuilt and shipped a software product at Koinophobia Labs.",
  updatedAt: NOW
};

const lane = {
  id: "lane-1",
  title: "Product Support Specialist",
  status: "active",
  whyFit: "This is the most direct bridge from customer-facing work into a software company.",
  resumeAngle: "Position every service interaction as issue resolution.",
  proof: ["Support metrics: tickets per day, satisfaction"],
  gaps: ["Learn one ticketing system at a demo level"],
  keywords: ["product support", "tickets", "troubleshooting", "knowledge base", "escalation"],
  source: "library",
  createdAt: NOW
};

const strongPost = `Product Support Specialist — Acme

What you'll do:
- Own customer support tickets from first reply to resolution
- Handle escalation to engineering with clean documentation

What we're looking for:
- Experience with troubleshooting customer issues methodically
- Strong written communication and de-escalation skills
- Experience with escalation processes and ticketing workflows
- Bachelor's degree in computer science required`;

// --- Scenario 1: strong match with lane and full profile -------------------

{
  const analysis = analyzeJobPost(strongPost, profile, lane);
  const brief = buildMatchBrief({ analysis, profile, lane, company: "Acme", roleTitle: "Product Support Specialist" });

  check("strong scenario: strength is strong or moderate", brief.strength === "strong" || brief.strength === "moderate", `got ${brief.strength}`);
  check("strong scenario: lane whyFit leads the fit summary", brief.fitSummary[0] === lane.whyFit);
  check(
    "strong scenario: fit summary reports requirement coverage",
    brief.fitSummary.some((item) => /cover \d+ of \d+ stated requirements/.test(item))
  );
  check("strong scenario: proof points come from the profile", brief.proofPoints.length >= 2);
  check(
    "strong scenario: keyword-relevant proof point ranked first",
    brief.proofPoints[0].includes("customer support tickets"),
    `got "${brief.proofPoints[0]}"`
  );
  check(
    "strong scenario: degree gap surfaces as a weak spot",
    brief.weakSpots.some((item) => /degree/i.test(item))
  );
  check("strong scenario: keywords split present/missing", brief.keywordsPresent.length > 0 && Array.isArray(brief.keywordsMissing));
  check(
    "strong scenario: talking points include the transition opener",
    brief.talkingPoints[0].includes("Product Support Specialist") && brief.talkingPoints[0].toLowerCase().includes("opener")
  );
  check(
    "strong scenario: talking points claim a covered requirement via a real skill",
    brief.talkingPoints.some((item) => item.includes("They need") && /"(de-escalation|troubleshooting|written communication|product support|tickets|escalation|knowledge base)"/.test(item))
  );
  check(
    "strong scenario: gap probe talking point present",
    brief.talkingPoints.some((item) => item.includes("unsupported requirement"))
  );
  check("strong scenario: outreach names company and role", brief.outreachMessage.includes("Acme") && brief.outreachMessage.includes("Product Support Specialist"));
  check(
    "strong scenario: outreach cites a specific true match, not a placeholder",
    !brief.outreachMessage.includes("[one specific, true match"),
    brief.outreachMessage
  );
  check("strong scenario: outreach keeps [Name] for the user", brief.outreachMessage.includes("[Name]"));
  check("strong scenario: honesty note attached", brief.honestyNote === MATCH_BRIEF_HONESTY_NOTE);

  const rendered = renderMatchBrief(brief);
  for (const heading of [
    "MATCH BRIEF — Product Support Specialist at Acme",
    "Match strength:",
    "WHY YOU FIT",
    "PROOF POINTS TO LEAD WITH",
    "WEAK SPOTS TO PREPARE FOR",
    "RESUME KEYWORDS",
    "INTERVIEW TALKING POINTS",
    "OUTREACH MESSAGE DRAFT",
    "Honesty note:"
  ]) {
    check(`render includes "${heading}"`, rendered.includes(heading));
  }
  check("render mentions the lane", rendered.includes("(Product Support Specialist lane)"));
}

// --- Scenario 2: empty profile, no lane — must degrade honestly ------------

{
  const empty = emptyProfile();
  const analysis = analyzeJobPost(strongPost, empty, null);
  const brief = buildMatchBrief({ analysis, profile: empty, lane: null, company: "", roleTitle: "" });

  check("empty scenario: strength is stretch or unclear", brief.strength === "stretch" || brief.strength === "unclear", `got ${brief.strength}`);
  check("empty scenario: no proof points invented", brief.proofPoints.length === 0);
  check(
    "empty scenario: outreach falls back to bracket placeholder",
    brief.outreachMessage.includes("[one specific, true match") || brief.outreachMessage.includes("I bring real")
  );
  check("empty scenario: outreach keeps role/company placeholders", brief.outreachMessage.includes("[Role title]") && brief.outreachMessage.includes("[Company]"));
  check("empty scenario: fit summary is non-empty and honest", brief.fitSummary.length > 0);
  check("empty scenario: render does not crash and keeps sections", renderMatchBrief(brief).includes("WEAK SPOTS TO PREPARE FOR"));
  check(
    "empty scenario: render flags missing proof points",
    renderMatchBrief(brief).includes("None on file")
  );
}

// --- Scenario 3: vague post with no extractable requirements ---------------

{
  const vaguePost = "We are hiring! Great team. Come join us and make an impact every day. Apply today!";
  const analysis = analyzeJobPost(vaguePost, profile, lane);
  const brief = buildMatchBrief({ analysis, profile, lane, company: "Vague Co", roleTitle: "Mystery Role" });

  check("vague scenario: requirements extracted is zero", analysis.requirements.length === 0);
  check("vague scenario: strength is unclear", brief.strength === "unclear", `got ${brief.strength}`);
  check("vague scenario: strength detail explains why", /didn't yield extractable requirements/.test(brief.strengthDetail));
  check("vague scenario: still produces talking points", brief.talkingPoints.length > 0);
  check("vague scenario: render works", renderMatchBrief(brief).includes("MATCH BRIEF — Mystery Role at Vague Co"));
}

// --- Scenario 4: coherence — brief never fabricates skills -----------------

{
  const analysis = analyzeJobPost(strongPost, profile, lane);
  const brief = buildMatchBrief({ analysis, profile, lane, company: "Acme", roleTitle: "Product Support Specialist" });
  const claimedVocabulary = [
    ...profile.transferableSkills,
    ...lane.keywords
  ].map((item) => item.toLowerCase());

  const quotedSources = brief.talkingPoints
    .filter((item) => item.includes("claim it through your"))
    .map((item) => (item.match(/claim it through your "([^"]+)"/) ?? [])[1])
    .filter(Boolean);
  check(
    "coherence: every named skill source is actually claimed by the user",
    quotedSources.every((source) => claimedVocabulary.includes(source.toLowerCase())),
    `sources: ${quotedSources.join(" | ")}`
  );

  const messageMatch = brief.outreachMessage.match(/pile: my ([^\n]+?) experience maps directly/);
  if (messageMatch) {
    check(
      "coherence: outreach skill source is actually claimed by the user",
      claimedVocabulary.includes(messageMatch[1].toLowerCase()),
      `source: ${messageMatch[1]}`
    );
  } else {
    check("coherence: outreach uses keyword or placeholder fallback", /I bring real|\[one specific, true match/.test(brief.outreachMessage));
  }
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
