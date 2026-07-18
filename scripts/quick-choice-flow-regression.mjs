import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "src/components/IntakeForm.tsx"), "utf8");
let passes = 0;
let failures = 0;
function check(label, condition) {
  if (condition) {
    passes += 1;
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

const defaultFlow = source.match(/const defaultQuestionIds:[\s\S]*?];/)?.[0] ?? "";
const optionalFlow = source.match(/const optionalQuestionIds[\s\S]*?\n]\);/)?.[0] ?? "";
check("default journey includes responsibilities, tools, and outcomes", /current_role[\s\S]*responsibilities[\s\S]*tools[\s\S]*outcomes[\s\S]*review/.test(defaultFlow));
check("quick-choice screens are not optional detours", !/\"tools\"|\"responsibilities\"|\"outcomes\"/.test(optionalFlow));
check("role-aware responsibilities are visible", source.includes("Pick responsibilities that are true") && source.includes("roleQuickResponsibilities.map"));
check("role-aware skills are visible", source.includes("Pick skills you actually used") && source.includes("roleQuickSkills.map"));
check("role-aware tools are the primary chips", source.includes("visibleToolChips.map"));
check("results choices do not require typing first", source.includes("visibleOutcomes.length > 0 &&") && !source.includes("data.outcomes.trim().length >= 4 &&"));
check("free text is explicitly optional", source.includes("Add anything missing (optional)"));

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
