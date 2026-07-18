import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const intakePath = path.join(root, "src/components/IntakeForm.tsx");
const packagePath = path.join(root, "package.json");
const regressionPath = path.join(root, "scripts/quick-choice-flow-regression.mjs");

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

let source = fs.readFileSync(intakePath, "utf8");

source = replaceOnce(
  source,
  '  outcomeSuggestionsByFamily,\n  roleFamilies,',
  '  outcomeSuggestionsByFamily,\n  roleFamilies,\n  roleIntelligence,',
  "import role intelligence"
);

source = replaceOnce(
  source,
  'const defaultQuestionIds: Question["id"][] = ["quick_start", "target", "current_role", "review"];',
  'const defaultQuestionIds: Question["id"][] = [\n  "quick_start",\n  "target",\n  "current_role",\n  "responsibilities",\n  "tools",\n  "outcomes",\n  "review"\n];',
  "surface quick-choice questions"
);

source = replaceOnce(
  source,
  'const optionalQuestionIds = new Set<Question["id"]>([\n  "name",\n  "email",\n  "contact",\n  "current_company",\n  "previous_role",\n  "additional_role",\n  "tools",\n  "responsibilities",\n  "scope",\n  "outcomes",\n  "education",\n  "template"\n]);',
  'const optionalQuestionIds = new Set<Question["id"]>([\n  "name",\n  "email",\n  "contact",\n  "current_company",\n  "previous_role",\n  "additional_role",\n  "scope",\n  "education",\n  "template"\n]);',
  "keep core choice screens in the default flow"
);

source = replaceOnce(
  source,
  '  {\n    id: "responsibilities",\n    title: "Add more details",\n    helper: "Optional.",\n    validate: []\n  },',
  '  {\n    id: "responsibilities",\n    title: "Which skills and responsibilities match your work?",\n    helper: "Pick what is true. Add your own only if needed.",\n    validate: []\n  },',
  "clarify skills question"
);

source = replaceOnce(
  source,
  '  {\n    id: "outcomes",\n    title: "Add results",\n    helper: "Optional.",\n    validate: []\n  },',
  '  {\n    id: "outcomes",\n    title: "What did your work improve?",\n    helper: "Pick any result that is true. Skip anything you cannot defend.",\n    validate: []\n  },',
  "clarify results question"
);

source = replaceOnce(
  source,
  '  const roleAwareToolOptions = toolSuggestionsByFamily[data.roleFamily];\n  const toolMatches = filterOptions(toolSearch.trim() ? allToolOptions : roleAwareToolOptions, toolSearch, 6);',
  '  const roleAwareToolOptions = toolSuggestionsByFamily[data.roleFamily];\n  const roleQuickResponsibilities = roleIntelligence[data.roleFamily].responsibilities;\n  const roleQuickSkills = roleIntelligence[data.roleFamily].skills;\n  const visibleToolChips = Array.from(new Set([...roleAwareToolOptions.slice(0, 6), ...commonToolChips])).slice(0, 10);\n  const toolMatches = filterOptions(toolSearch.trim() ? allToolOptions : roleAwareToolOptions, toolSearch, 6);',
  "derive role-aware choices"
);

source = replaceOnce(
  source,
  '  function toggleResponsibility(item: string) {\n    const selected = data.selectedResponsibilities.includes(item)\n      ? data.selectedResponsibilities.filter((value) => value !== item)\n      : [...data.selectedResponsibilities, item];\n    update("selectedResponsibilities", selected);\n  }',
  '  function toggleResponsibility(item: string) {\n    const selected = data.selectedResponsibilities.includes(item)\n      ? data.selectedResponsibilities.filter((value) => value !== item)\n      : [...data.selectedResponsibilities, item];\n    update("selectedResponsibilities", selected);\n  }\n\n  function toggleTransferableSkill(item: string) {\n    const selected = data.customRoleTransferableSkills.includes(item)\n      ? data.customRoleTransferableSkills.filter((value) => value !== item)\n      : [...data.customRoleTransferableSkills, item];\n    update("customRoleTransferableSkills", selected);\n  }',
  "add skill selection handler"
);

source = replaceOnce(
  source,
  '    if (question.id === "current_role") return "See recommendations";',
  '    if (question.id === "current_role") return "Next: skills";\n    if (question.id === "responsibilities") return "Next: tools";\n    if (question.id === "tools") return "Next: results";\n    if (question.id === "outcomes") return "Review choices";',
  "make the quick-choice sequence explicit"
);

source = replaceOnce(
  source,
  '              {commonToolChips.map((tool) => {',
  '              {visibleToolChips.map((tool) => {',
  "show role-aware tool chips"
);

source = replaceOnce(
  source,
  '      case "responsibilities":\n        return (\n          <div className="space-y-4">\n            <label className="block">',
  '      case "responsibilities":\n        return (\n          <div className="space-y-4">\n            <div className="rounded-md border border-cyan/20 bg-white p-3">\n              <p className="text-sm font-bold text-ink">Pick responsibilities that are true</p>\n              <div className="mt-3 flex flex-wrap gap-2">\n                {roleQuickResponsibilities.map((item) => {\n                  const selected = data.selectedResponsibilities.includes(item);\n                  return (\n                    <button\n                      key={item}\n                      type="button"\n                      onClick={() => toggleResponsibility(item)}\n                      className={selected\n                        ? "rounded-full border border-gold bg-gold/25 px-3 py-2 text-sm font-semibold text-ink"\n                        : "rounded-full border border-ink/10 bg-paper px-3 py-2 text-sm font-semibold text-ink/80 transition hover:border-spruce"}\n                    >\n                      {item}\n                    </button>\n                  );\n                })}\n              </div>\n            </div>\n\n            <div className="rounded-md border border-gold/20 bg-paper p-3">\n              <p className="text-sm font-bold text-ink">Pick skills you actually used</p>\n              <div className="mt-3 flex flex-wrap gap-2">\n                {roleQuickSkills.map((item) => {\n                  const selected = data.customRoleTransferableSkills.includes(item);\n                  return (\n                    <button\n                      key={item}\n                      type="button"\n                      onClick={() => toggleTransferableSkill(item)}\n                      className={selected\n                        ? "rounded-full border border-gold bg-gold/25 px-3 py-2 text-sm font-semibold text-ink"\n                        : "rounded-full border border-ink/10 bg-white px-3 py-2 text-sm font-semibold text-ink/80 transition hover:border-spruce"}\n                    >\n                      {item}\n                    </button>\n                  );\n                })}\n              </div>\n            </div>\n\n            <label className="block">',
  "put responsibilities and skills before the blank field"
);

source = replaceOnce(
  source,
  '<span className="sr-only">What else should Career Forge know?</span>',
  '<span className="mb-2 block text-sm font-bold text-ink">Add anything missing (optional)</span>',
  "label optional free text"
);

source = replaceOnce(
  source,
  '{data.outcomes.trim().length >= 4 && (',
  '{visibleOutcomes.length > 0 && (',
  "show result choices before typing"
);

source = replaceOnce(
  source,
  '<p className="text-sm font-bold text-ink">Possible outcome labels</p>',
  '<p className="text-sm font-bold text-ink">Pick any results that are true</p>',
  "clarify result chips"
);

fs.writeFileSync(intakePath, source);

const regression = `import fs from "node:fs";\nimport path from "node:path";\nimport { fileURLToPath } from "node:url";\n\nconst root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");\nconst source = fs.readFileSync(path.join(root, "src/components/IntakeForm.tsx"), "utf8");\nlet passes = 0;\nlet failures = 0;\nfunction check(label, condition) {\n  if (condition) {\n    passes += 1;\n    console.log(\`PASS \${label}\`);\n  } else {\n    failures += 1;\n    console.error(\`FAIL \${label}\`);\n  }\n}\n\nconst defaultFlow = source.match(/const defaultQuestionIds:[\\s\\S]*?];/)?.[0] ?? "";\nconst optionalFlow = source.match(/const optionalQuestionIds[\\s\\S]*?\\n]\\);/)?.[0] ?? "";\ncheck("default journey includes responsibilities, tools, and outcomes", /current_role[\\s\\S]*responsibilities[\\s\\S]*tools[\\s\\S]*outcomes[\\s\\S]*review/.test(defaultFlow));\ncheck("quick-choice screens are not optional detours", !/\\\"tools\\\"|\\\"responsibilities\\\"|\\\"outcomes\\\"/.test(optionalFlow));\ncheck("role-aware responsibilities are visible", source.includes("Pick responsibilities that are true") && source.includes("roleQuickResponsibilities.map"));\ncheck("role-aware skills are visible", source.includes("Pick skills you actually used") && source.includes("roleQuickSkills.map"));\ncheck("role-aware tools are the primary chips", source.includes("visibleToolChips.map"));\ncheck("results choices do not require typing first", source.includes("visibleOutcomes.length > 0 &&") && !source.includes("data.outcomes.trim().length >= 4 &&"));\ncheck("free text is explicitly optional", source.includes("Add anything missing (optional)"));\n\nconsole.log(\`\\n\${passes} passed, \${failures} failed\`);\nif (failures > 0) process.exit(1);\n`;
fs.writeFileSync(regressionPath, regression);

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const marker = "node scripts/intent-router-regression.mjs && ";
if (!packageJson.scripts["test:unit"].includes("quick-choice-flow-regression")) {
  if (!packageJson.scripts["test:unit"].includes(marker)) throw new Error("test:unit marker not found");
  packageJson.scripts["test:unit"] = packageJson.scripts["test:unit"].replace(
    marker,
    `${marker}node scripts/quick-choice-flow-regression.mjs && `
  );
}
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log("Applied quick-choice journey repair.");
