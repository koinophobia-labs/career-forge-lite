// Builds a blinded recruiter-review packet for the founding-user pilot.
//
// Usage:
//   node scripts/build-recruiter-packet.mjs <previous-resume.txt> <career-forge-output.txt> <generic-ai-baseline.txt> <output-dir>
//
// The three documents are copied under randomized labels (Document A/B/C).
// The packet the reviewer sees contains the labeled documents and a scoring
// sheet — never the mapping. The mapping is written to answer-key.json in the
// same output directory; keep it away from reviewers.
import fs from "node:fs";
import path from "node:path";
import { randomInt } from "node:crypto";

const [previousPath, forgePath, baselinePath, outDirArg] = process.argv.slice(2);
if (!previousPath || !forgePath || !baselinePath || !outDirArg) {
  console.error("Usage: node scripts/build-recruiter-packet.mjs <previous-resume.txt> <career-forge-output.txt> <generic-ai-baseline.txt> <output-dir>");
  process.exit(1);
}

const sources = [
  { kind: "previous-resume", path: previousPath },
  { kind: "career-forge-output", path: forgePath },
  { kind: "generic-ai-baseline", path: baselinePath }
];
for (const source of sources) {
  if (!fs.existsSync(source.path)) {
    console.error(`Missing input file: ${source.path}`);
    process.exit(1);
  }
}

// Fisher–Yates with crypto randomness so the labeling is genuinely blind.
const shuffled = [...sources];
for (let index = shuffled.length - 1; index > 0; index -= 1) {
  const swap = randomInt(index + 1);
  [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
}

const outDir = path.resolve(outDirArg);
const packetDir = path.join(outDir, "packet-for-reviewer");
fs.mkdirSync(packetDir, { recursive: true });

const labels = ["A", "B", "C"];
const key = {};
shuffled.forEach((source, index) => {
  const label = labels[index];
  key[`Document ${label}`] = source.kind;
  fs.writeFileSync(path.join(packetDir, `Document-${label}.txt`), fs.readFileSync(source.path, "utf8"));
});

const scoringSheet = `# Recruiter Review — Scoring Sheet

You are reviewing three résumés (Document A, Document B, Document C) for the SAME
candidate targeting the same role. You do not know how any of them was produced.
Score each document 1–5 on every dimension (5 is best). "Editing burden": 5 means
ready to send as-is, 1 means it needs a rewrite.

| Dimension | Document A | Document B | Document C |
| --- | --- | --- | --- |
| Credibility | | | |
| Clarity | | | |
| Target-role alignment | | | |
| Factual defensibility | | | |
| Likelihood of interview | | | |
| Editing burden | | | |

1. Which document would you actually submit for this candidate, and why?

2. Did anything in any document read as unbelievable or indefensible? Quote it.

3. Estimated minutes of editing each document needs before sending:
   A: ____  B: ____  C: ____
`;

fs.writeFileSync(path.join(packetDir, "SCORING-SHEET.md"), scoringSheet);
fs.writeFileSync(path.join(outDir, "answer-key.json"), JSON.stringify({ createdAt: new Date().toISOString(), key }, null, 2));

console.log(`Packet written to ${packetDir} (3 blinded documents + scoring sheet).`);
console.log(`Answer key written to ${path.join(outDir, "answer-key.json")} — do NOT give this to reviewers.`);
