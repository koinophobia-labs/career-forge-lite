import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { qualityRegressionPersonas } from "./quality-regression-dataset.mjs";

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

const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));
const { generateResumePackage, isGroundedClaim } = loadTsModule(path.join(root, "src/lib/generator.ts"));
const { buildCareerRecommendations } = loadTsModule(path.join(root, "src/lib/career-recommendations.ts"));
const { resumeToText } = loadTsModule(path.join(root, "src/lib/resume-export.ts"));
const { parseStoryToDossier } = loadTsModule(path.join(root, "src/lib/story-mode.ts"));

// Template-signature guard: these terms exist in role/occupation templates and
// may appear in output ONLY when the persona's own input evidences them
// (stem-matched). Any other appearance is a hallucination.
const templateSignatureStems = [
  "sanitation",
  "restock",
  "upsell",
  "prospect",
  "crm manag",
  "mobile qa",
  "workflow automation",
  "onboard",
  "lead generation",
  "pipeline",
  "access control",
  "visitor management",
  "emergency response",
  "forklift",
  "pallet",
  "route planning",
  "patient care",
  "care note",
  "calendar manag",
  "data entry",
  "timeline track",
  "status report",
  "troubleshoot",
  "ticket manag",
  "system maintenance",
  "surveillance",
  "de escalat"
];

const genericPhrases = [
  "Supported operations",
  "Worked in a fast-paced environment",
  "Responsible for",
  "Various duties",
  "Maintained service quality",
  "Supported customer requests in a client-facing environment",
  "Worked with team",
  "Dynamic",
  "Results-driven",
  "Proven track record"
];

const founderMisclassifications = [
  "Delivery Driver",
  "Warehouse Associate",
  "Forklift",
  "Pallet Jack",
  "Route Planning",
  "Package Handler"
];

const teacherMisclassifications = ["Warehouse Associate", "Delivery Driver", "Forklift", "Pallet Jack"];

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function textHas(text, value) {
  return normalize(text).includes(normalize(value));
}

function unique(items) {
  return Array.from(new Set(items));
}

function wordSet(value) {
  return new Set(normalize(value).split(/\s+/).filter((word) => word.length > 2));
}

function jaccard(a, b) {
  const left = wordSet(a);
  const right = wordSet(b);
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / new Set([...left, ...right]).size;
}

function hasThreeNearDuplicates(bullets) {
  let similarPairs = 0;
  for (let i = 0; i < bullets.length; i += 1) {
    for (let j = i + 1; j < bullets.length; j += 1) {
      if (jaccard(bullets[i], bullets[j]) >= 0.82) similarPairs += 1;
    }
  }
  return similarPairs >= 3;
}

function buildDirectIntake(persona) {
  return {
    ...initialIntake,
    fullName: `${persona.title} Regression Candidate`,
    email: `${persona.id}@example.com`,
    targetJobTitle: persona.targetRole || persona.title,
    roleFamily: persona.roleFamily,
    currentTitle: persona.title,
    currentCompany: persona.company,
    currentTime: "2022 to Present",
    responsibilities: persona.description,
    selectedResponsibilities: persona.skills,
    selectedActions: [],
    tools: persona.tools,
    selectedOutcomes: persona.description.length < 35 ? [] : ["Reliability"]
  };
}

function buildPersonaIntake(persona) {
  if (!persona.story) {
    return { intake: buildDirectIntake(persona), parsedRoleFamily: persona.roleFamily, detectedRoles: [] };
  }

  const dossier = parseStoryToDossier(persona.description);
  return {
    intake: {
      ...dossier.intake,
      targetJobTitle: dossier.intake.targetJobTitle || persona.targetRole || persona.title,
      roleFamily: dossier.intake.roleFamily || persona.roleFamily
    },
    parsedRoleFamily: dossier.extracted.roleFamily,
    detectedRoles: dossier.detectedRoles
  };
}

function validatePersona(persona) {
  const { intake, parsedRoleFamily, detectedRoles } = buildPersonaIntake(persona);
  const resume = generateResumePackage(intake);
  const recommendations = buildCareerRecommendations(intake);
  const exportText = resumeToText(intake, resume);
  const allText = [
    exportText,
    resume.linkedinHeadline,
    resume.summary,
    resume.linkedinSummary,
    resume.coreSkills.join(" "),
    recommendations.map((item) => item.title).join(" ")
  ].join("\n");
  const bullets = resume.experience.flatMap((role) => role.bullets.filter(Boolean));
  const normalizedBullets = bullets.map(normalize);
  const failures = [];
  const warnings = [];
  const hallucinations = [];
  const missingSkills = persona.skills.filter((skill) => !textHas(allText, skill));

  if (!resume.summary || resume.summary.length < 45) failures.push("summary missing or too thin");
  if (!resume.linkedinHeadline || resume.linkedinHeadline.length < 8) failures.push("LinkedIn headline missing");
  if (bullets.length < 3) failures.push("minimum bullet count not met");
  if (unique(normalizedBullets).length !== normalizedBullets.length) failures.push("duplicate bullet sentence");
  if (hasThreeNearDuplicates(bullets)) failures.push("three bullets are nearly identical");
  if (missingSkills.length === persona.skills.length) failures.push("no expected transferable skills detected");
  if (persona.story && parsedRoleFamily !== persona.roleFamily) failures.push(`story role family mismatch: expected ${persona.roleFamily}, got ${parsedRoleFamily}`);

  for (const forbidden of persona.forbidden) {
    if (textHas(allText, forbidden) && !textHas(persona.description, forbidden) && !textHas(persona.tools, forbidden)) {
      hallucinations.push(forbidden);
    }
  }

  // Stronger guard: template-taxonomy terms may only appear when the persona
  // input (description, expected skills, tools, titles) grounds them under the
  // same grounding gate the generator itself uses, so any template content
  // that bypasses the gate is flagged as a hallucination.
  const personaInput = [persona.description, persona.title, persona.company, persona.targetRole, persona.tools, ...persona.skills, ...persona.expectedRecommendations]
    .join(" ")
    .toLowerCase();
  for (const stem of templateSignatureStems) {
    if (normalize(allText).includes(normalize(stem)) && !isGroundedClaim(stem, personaInput)) {
      hallucinations.push(`template-term:${stem}`);
    }
  }

  if (/founder|web designer|ai builder|product/i.test(persona.title)) {
    for (const forbidden of founderMisclassifications) {
      if (textHas(allText, forbidden) && !textHas(persona.description, forbidden)) hallucinations.push(forbidden);
    }
  }

  if (/teacher|teaching assistant|tutor|student/i.test(persona.title)) {
    for (const forbidden of teacherMisclassifications) {
      if (textHas(allText, forbidden) && !textHas(persona.description, forbidden)) hallucinations.push(forbidden);
    }
  }

  const genericHits = genericPhrases.filter((phrase) => new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(allText));
  if (genericHits.length >= 2) failures.push(`generic language detected: ${genericHits.join(", ")}`);
  if (genericHits.length === 1) warnings.push(`generic phrase: ${genericHits[0]}`);

  if (persona.expectedRecommendations.length) {
    const titles = recommendations.map((item) => item.title).join(" ");
    if (!persona.expectedRecommendations.some((title) => textHas(titles, title))) {
      failures.push(`missing expected recommendation: ${persona.expectedRecommendations.join(" or ")}`);
    }
  }

  const inflatedRecommendation = recommendations.find((item) =>
    /director|executive|manager|software engineer|marketing director/i.test(item.title) &&
    !/assistant manager|junior software developer/i.test(`${persona.title} ${item.title}`)
  );
  if (inflatedRecommendation) failures.push(`inflated recommendation: ${inflatedRecommendation.title}`);

  if (!recommendations.length && !persona.targetRole) warnings.push("no recommendation and no explicit target role");
  if (missingSkills.length) warnings.push(`missing skills: ${missingSkills.join(", ")}`);

  return {
    id: persona.id,
    title: persona.title,
    roleFamily: persona.roleFamily,
    detectedRoles,
    failures,
    warnings,
    missingSkills,
    hallucinations: unique(hallucinations),
    weak: warnings.length > 0 || bullets.length < 4,
    sampleBullet: bullets[0] ?? "",
    headline: resume.linkedinHeadline
  };
}

const results = qualityRegressionPersonas.map(validatePersona);
const failures = results.filter((result) => result.failures.length);
const hallucinationResults = results.filter((result) => result.hallucinations.length);
const weakOutputs = results.filter((result) => result.weak && !result.failures.length);
const familyCoverage = results.reduce((coverage, result) => {
  coverage[result.roleFamily] = (coverage[result.roleFamily] ?? 0) + 1;
  return coverage;
}, {});
const missingSkillRows = results.filter((result) => result.missingSkills.length);
const totalPenalty = failures.length * 3 + hallucinationResults.length * 5 + Math.ceil(weakOutputs.length / 4);
const regressionScore = Math.max(0, Math.min(100, 100 - totalPenalty));

const report = {
  passes: results.length - failures.length,
  failures: failures.map((result) => ({ id: result.id, title: result.title, failures: result.failures })),
  missingSkills: missingSkillRows.map((result) => ({ id: result.id, missingSkills: result.missingSkills })),
  hallucinations: hallucinationResults.map((result) => ({ id: result.id, hallucinations: result.hallucinations })),
  weakOutputs: weakOutputs.map((result) => ({ id: result.id, warnings: result.warnings, sampleBullet: result.sampleBullet })),
  coverageByOccupationFamily: familyCoverage
};

console.log(JSON.stringify(report, null, 2));
console.log(`Regression Score:\n${regressionScore} / 100`);
console.log(`Coverage:\n${results.length} personas`);
console.log(`Hallucinations:\n${hallucinationResults.reduce((count, result) => count + result.hallucinations.length, 0)}`);
console.log(`Weak Outputs:\n${weakOutputs.length}`);

if (qualityRegressionPersonas.length < 75) {
  throw new Error(`Regression dataset must contain at least 75 personas; found ${qualityRegressionPersonas.length}.`);
}

if (failures.length || hallucinationResults.length) {
  throw new Error(`Quality regression failed: ${failures.length} failures, ${hallucinationResults.length} hallucination rows.`);
}
