// Deterministically generates the redacted private-acceptance fixture. No
// real personal data is ever committed to the repository: fixtures/private/
// is gitignored (see .gitignore), so a fresh checkout has none of these
// files on disk. Every consumer of the fixture (scripts/private-workflow-
// acceptance.mjs) calls ensurePrivateFixture() first, which writes this
// exact synthetic content if the file is missing — making the acceptance
// suite self-sufficient with zero manual setup, from any clean checkout.
//
// Content is entirely synthetic: a placeholder name, and a professional
// history built only from public information about products the repo owner
// has actually shipped (visible in this same codebase and its sibling
// public repos). No email, phone, address, or other contact data appears
// anywhere in this fixture — the consuming script also asserts that as a
// runtime safety net (see the contact-data regex check).

import fs from "node:fs";
import path from "node:path";

export const PRIVATE_FIXTURE_RELATIVE_PATH = "fixtures/private/blake-redacted-resume-pack.json";

export function buildPrivateFixture() {
  return {
    documents: [
      {
        filename: "redacted-operations-history.txt",
        text: [
          "Blake Example",
          "Koinophobia Labs — Founder | 2024–Present",
          "Built Career Forge, a local-first career evidence and application workflow",
          "Created repeatable QA, release, and regression-testing systems for shipped web products",
          "Maintained evidence-linked product documentation and launch checklists",
          "Resolved customer issues and documented escalation paths",
          "Applied policy consistently in a regulated sportsbook environment",
          "Verified identity and reviewed risk signals during customer-facing operations",
          "Tools: TypeScript, Next.js, Playwright, GitHub Actions, spreadsheets"
        ].join("\n")
      },
      {
        filename: "redacted-product-projects.txt",
        text: [
          "Career Forge — Koinophobia Labs | 2025–Present",
          "Built a durable Career Dossier, role-lane résumé packs, job-post tailoring, and local backup workflows",
          "Trendi — Koinophobia Labs | 2025–Present",
          "Built a creator workflow that turns rough ideas into recordable scripts",
          "You Know Ball — Koinophobia Labs | 2025–Present",
          "Built and red-teamed a sports debate product with documented safety guardrails",
          "Website Teardown AI — Koinophobia Labs | 2025",
          "Built a website-analysis prototype with structured recommendations",
          "Koinophobia Labs — Independent product studio | 2024–Present"
        ].join("\n")
      }
    ]
  };
}

// Writes the fixture to disk only if it does not already exist, so a
// developer's own local override (still gitignored) is never clobbered.
export function ensurePrivateFixture(root) {
  const fixturePath = path.join(root, PRIVATE_FIXTURE_RELATIVE_PATH);
  if (fs.existsSync(fixturePath)) return fixturePath;
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  fs.writeFileSync(fixturePath, `${JSON.stringify(buildPrivateFixture(), null, 2)}\n`, "utf8");
  return fixturePath;
}
