import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const port = 3210;
const baseUrl = `http://127.0.0.1:${port}`;

function startServer() {
  const child = spawn(
    "npm",
    ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_COMMERCE_MODE: "off" },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return { child, getOutput: () => output };
}

async function waitForServer(getOutput) {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    if (getOutput().includes("Ready") || getOutput().includes("Local:")) {
      try {
        const response = await fetch(baseUrl);
        if (response.ok) return;
      } catch {
        // Next can print the local URL before the first request is ready.
      }
    }
    await delay(250);
  }
  throw new Error(`Next dev server did not become ready.\n${getOutput()}`);
}

async function clickContinue(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));

  if (dimensions.scrollWidth > dimensions.clientWidth + 1) {
    throw new Error(
      `${label}: horizontal overflow detected. clientWidth=${dimensions.clientWidth}, scrollWidth=${dimensions.scrollWidth}`
    );
  }
}

async function assertValue(locator, expected, label) {
  const value = await locator.inputValue();
  if (value !== expected) {
    throw new Error(`${label}: expected "${expected}", received "${value}"`);
  }
}

const sampleUsers = [
  {
    label: "DoorDash driver",
    target: "Warehouse Associate",
    role: "I drive for DoorDash and handle orders, routes, and customer messages.",
    expected: "Delivery Driver"
  },
  {
    label: "Retail cashier",
    target: "Inventory Associate",
    role: "Retail cashier",
    expected: "Retail Cashier"
  },
  {
    label: "Warehouse associate",
    target: "Logistics Support",
    role: "Warehouse associate",
    expected: "Warehouse Associate"
  },
  {
    label: "Food service worker",
    target: "Operations Associate",
    role: "Food service worker",
    expected: "Food Service Worker"
  },
  {
    label: "Barber",
    target: "Customer Success Associate",
    role: "Barber with regular clients, appointments, customer concerns, referrals, and service recommendations.",
    expected: "Barber",
    expectedEvidence: ["Built repeat clientele", "Appointment scheduling", "Retention and referrals"],
    expectedRecommendation: "Customer Experience Associate"
  },
  {
    label: "Software engineer",
    target: "Software Engineer",
    role: "Software engineer",
    expected: "Software Engineer"
  }
];

async function startGuidedFlow(page) {
  // The builder now lives inside the main product shell and lands directly on
  // the choose-your-path panel (the separate marketing landing was removed).
  await page.goto(`${baseUrl}/resume-builder`, { waitUntil: "load" });
  await assertNoHorizontalOverflow(page, "guided-setup");
  await page.getByText("Choose how you want to start.").waitFor();
  await page.getByText("Start guided build").click();
  await page.getByRole("heading", { name: "What do you need help with?" }).waitFor();
}

async function runFastRecommendationFlow(viewport, sample, verifyActions = false) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    permissions: ["clipboard-read", "clipboard-write"]
  });
  const page = await context.newPage();

  await startGuidedFlow(page);
  await clickContinue(page, "Start");

  const targetInput = page.getByPlaceholder("Example: Customer Support");
  await targetInput.fill(sample.target);
  await assertValue(targetInput, sample.target, `${sample.label}: target typing`);
  await targetInput.blur();
  await clickContinue(page, "Next");

  const currentRoleInput = page.getByLabel("What did you actually do in this role?");
  await currentRoleInput.fill(sample.role);
  await assertValue(currentRoleInput, sample.role, `${sample.label}: experience story typing`);
  await page.getByText("We heard:").waitFor();
  await page.getByText("Which of these are true?").waitFor();
  if (!/software|tech|engineer/i.test(sample.label) && await page.getByText("Troubleshot technical issues").isVisible().catch(() => false)) {
    throw new Error(`${sample.label}: unrelated technical chip appeared in adaptive experience step`);
  }
  await clickContinue(page, "See recommendations");

  await page.getByRole("heading", { name: "Ready to generate?" }).waitFor();
  await page.getByText(/Quick draft ready|Resume package ready/).waitFor();
  await page.getByRole("button", { name: "+ Add another experience" }).waitFor();
  await page.getByRole("button", { name: "+ Add tools used" }).waitFor();
  await page.getByRole("button", { name: "+ Add certifications" }).waitFor();
  await page.getByRole("button", { name: "+ Add projects" }).waitFor();
  await page.getByRole("button", { name: "+ Add more details" }).waitFor();
  if (sample.expectedRecommendation) {
    await page.getByText("Evidence-backed next moves").waitFor();
    await page.getByRole("heading", { name: "We found these strengths:" }).waitFor();
    for (const evidence of sample.expectedEvidence ?? []) {
      await page.getByText(evidence).waitFor();
    }
    await page.getByRole("heading", { name: sample.expectedRecommendation }).waitFor();
    await page.getByText("Why this fits:").first().waitFor();
    await page.getByText("Built repeat client relationships.").first().waitFor();
    await page.getByText("Managed scheduling, appointments, or expectations.").first().waitFor();
  }
  await assertNoHorizontalOverflow(page, `${sample.label}: review`);

  if (verifyActions) {
    await page.getByRole("button", { name: "+ Add tools used" }).click();
    await page.getByRole("heading", { name: "What tools did you use?" }).waitFor();
    await page.getByPlaceholder("Add another tool").fill("Excel");
    await page.getByRole("button", { name: "Excel" }).first().click();
    await clickContinue(page, "Save and review");
    await page.getByRole("heading", { name: "Ready to generate?" }).waitFor();
  }

  await clickContinue(page, "Generate draft");

  await page.getByRole("heading", { name: "Review your resume before you apply." }).waitFor({ timeout: 15_000 });
  await assertNoHorizontalOverflow(page, `${sample.label}: resume preview`);
  await page.locator(`input[value="${sample.expected}"]`).waitFor({ timeout: 15_000 });

  if (verifyActions) {
    await page.getByRole("button", { name: "Copy full resume" }).click();
    await page.getByRole("button", { name: "Copied" }).first().waitFor();
    const copiedResume = await page.evaluate(() => navigator.clipboard.readText());
    if (!copiedResume.includes(sample.expected) || !copiedResume.includes(sample.target)) {
      throw new Error("copy resume did not include the quick-flow career details");
    }

    await page.evaluate(() => {
      window.print = () => {
        window.__printCalled = true;
      };
    });
    await page.getByRole("button", { name: "Print resume" }).click();
    const printCalled = await page.evaluate(() => Boolean(window.__printCalled));
    if (!printCalled) {
      throw new Error("print/export button did not call window.print");
    }
  }

  await context.close();
  await browser.close();
}

async function runKnownCareerFlow(viewport) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  await startGuidedFlow(page);
  await clickContinue(page, "Start");

  const targetInput = page.getByPlaceholder("Example: Customer Support");
  await targetInput.fill("Help");
  await page.getByRole("button", { name: "Help Desk Technician IT" }).click();
  await assertValue(targetInput, "Help Desk Technician", "known career selection");
  await page.getByText("IT Support").first().waitFor();
  await assertNoHorizontalOverflow(page, "known career selected");

  await context.close();
  await browser.close();
}

const server = startServer();

try {
  await Promise.race([
    once(server.child, "exit").then(([code]) => {
      throw new Error(`Next dev server exited early with code ${code}.\n${server.getOutput()}`);
    }),
    waitForServer(server.getOutput)
  ]);

  await runKnownCareerFlow({ width: 1280, height: 900 });
  await runKnownCareerFlow({ width: 390, height: 844 });
  for (const [index, sample] of sampleUsers.entries()) {
    await runFastRecommendationFlow({ width: 1280, height: 900 }, sample, index === 0);
    await runFastRecommendationFlow({ width: 390, height: 844 }, sample, index === 0);
  }
  console.log("Career Forge usability regression passed on desktop and mobile.");
} finally {
  server.child.kill("SIGTERM");
}
