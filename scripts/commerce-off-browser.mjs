import { once } from "node:events";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 3247;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_COMMERCE_MODE: "off", STRIPE_SECRET_KEY: "" },
  stdio: ["ignore", "pipe", "pipe"]
});
let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });
async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (server.exitCode !== null) throw new Error(output);
    try { if ((await fetch(baseUrl)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(output);
}
let passes = 0;
function check(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passes += 1;
  console.log(`PASS ${label}`);
}

let browser;
try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${output}`); })]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const externalPaymentRequests = [];
  page.on("request", (request) => {
    if (/stripe\.com|checkout\.stripe|buy\.stripe/i.test(request.url())) externalPaymentRequests.push(request.url());
  });
  await page.goto(`${baseUrl}/pricing`);
  await page.getByText("Public beta · No purchases enabled").waitFor();
  check("pricing states that purchases are disabled", await page.getByText("Is anything for sale during the public beta?").count() === 1);
  check("pricing exposes no automated checkout button", await page.getByRole("button", { name: /buy|purchase|checkout/i }).count() === 0);
  check("pricing displays no automated package price", await page.getByText(/^\$(?:49|99|149)$/).count() === 0);
  const direct = await page.evaluate(async () => {
    const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier: "reset" }) });
    return { status: response.status, body: await response.json() };
  });
  check("direct checkout POST fails closed while commerce is off", direct.status === 503 && direct.body.error === "Purchases are not enabled.");
  check("commerce-off UI and direct request create no Stripe request", externalPaymentRequests.length === 0);
  check("no checkout navigation occurred", page.url() === `${baseUrl}/pricing`);
  console.log(`\nCommerce-off browser acceptance: ${passes}/${passes} passed`);
  await context.close();
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill("SIGTERM");
}
