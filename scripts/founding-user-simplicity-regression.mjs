import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

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

const nav = read("src/components/CommandNav.tsx");
const intent = read("src/components/IntentRouter.tsx");
const home = read("src/app/page.tsx");
const tailor = read("src/app/tailor/page.tsx");
const sprint = read("src/app/role-sprint/page.tsx");

const primaryBlock = nav.match(/const primaryStations:[\s\S]*?= \[([\s\S]*?)\n\];/)?.[1] ?? "";
const primaryEntries = [...primaryBlock.matchAll(/\["[^"]+",\s*"[^"]+"\]/g)];
check("navigation: exactly four primary destinations", primaryEntries.length === 4);
check("navigation: primary labels use plain language", ["Today", "Résumé", "Jobs", "Applications"].every((label) => primaryBlock.includes(`\"${label}\"`)));
check("navigation: advanced machinery is not primary", !/Truth Map|Weekly Review|Founding Career Reset|Pricing|Data & Backup/.test(primaryBlock));
check("navigation: advanced destinations live under Workspace", nav.includes("Workspace") && nav.includes("Role Sprints") && nav.includes("Data & Backup"));

const firstRunBlock = intent.match(/const FIRST_RUN_GOALS:[\s\S]*?= \[([\s\S]*?)\n\];/)?.[1] ?? "";
const firstRunKinds = [...firstRunBlock.matchAll(/kind:\s*"([^"]+)"/g)].map((match) => match[1]);
check("first run: exactly three choices", firstRunKinds.length === 3);
check("first run: choices are job, resume, interview", ["new-job", "update-resume", "practice-interview"].every((kind) => firstRunKinds.includes(kind)));
check("first run: career change and first resume are not separate decisions", !firstRunKinds.includes("career-change") && !firstRunKinds.includes("first-resume"));
check("first run: one simple question", intent.includes("What are you trying to do?"));

check("home: no competing marketing landing page", !home.includes("Local-first career evidence compiler") && !home.includes("Your career is bigger than your last résumé."));
check("home: optional sample is collapsed after the main choice", home.includes("SampleExperience") && home.includes("See a finished sample first") && home.indexOf("<IntentRouter />") < home.indexOf("See a finished sample first"));
check("home: no seven-station workflow wall", !home.includes("Advanced workspace") && !home.includes("Career Lanes") && !home.includes("Truth Map"));
check("home: returning users still get one next step", home.includes("<IntentRouter />"));
check("home: full workspace is collapsed", home.includes("Open full workspace") && home.includes("<details"));

check("tailor: job post is the only required input", tailor.includes("disabled={!jobPost.trim()}") && !tailor.includes("if (!jobPost.trim() || !selectedBaseline)"));
check("tailor: application details are collapsed", tailor.includes("Add application details") && tailor.indexOf("Paste the full job posting") < tailor.indexOf("Add application details"));
check("tailor: analysis can run without a resume baseline", tailor.includes("setAnalysis(analyzeJobPost") && !tailor.includes("if (!jobPost.trim() || !effectiveBaseline)"));
check("tailor: one best next step is visually explicit", tailor.includes("Best next step"));
check("tailor: secondary analysis is collapsed", tailor.includes("More analysis") && tailor.includes("Other actions"));

check("role sprint: task is the first core panel", sprint.indexOf("Do this") < sprint.indexOf("Do the work here"));
check("role sprint: explanation is optional", sprint.includes("Why this task?") && sprint.includes("<details"));
check("role sprint: one dominant submit action", sprint.includes("Finish sprint →"));
check("role sprint: one recommended output appears first", sprint.indexOf("Best way to use this") < sprint.indexOf("Other ways to use this work"));
check("role sprint: provenance is collapsed", sprint.includes("Proof details"));
check("role sprint: practice is never presented as employment", sprint.includes("not employment experience") && sprint.includes("never under employment"));

console.log(`\nFounding-user simplicity regression: ${passes} passed, ${failures} failed.`);
if (failures > 0) process.exit(1);
