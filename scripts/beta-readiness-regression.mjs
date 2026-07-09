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

const { resolveBetaCta, BETA_PRICE_LABEL } = loadTsModule(path.join(root, "src/lib/beta-config.ts"));
const { buildDemoState, isDemoState } = loadTsModule(path.join(root, "src/lib/demo-data.ts"));
const { buildWeeklyPlan } = loadTsModule(path.join(root, "src/lib/weekly-plan.ts"));
const { parseState, emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));

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

// --- Beta CTA resolution ------------------------------------------------------

{
  const checkout = resolveBetaCta({ checkoutUrl: "https://buy.stripe.com/test_abc", contactEmail: "x@example.com" });
  check("CTA prefers checkout when configured", checkout.mode === "checkout" && checkout.href.startsWith("https://buy.stripe.com/"));
  check("checkout CTA reads as a purchase", /join the paid beta/i.test(checkout.label));

  const email = resolveBetaCta({ contactEmail: "beta@example.com" });
  check("CTA falls back to email invite", email.mode === "email" && email.href.startsWith("mailto:beta@example.com"));

  const fallback = resolveBetaCta({});
  check("CTA never dead-ends: invite fallback exists", fallback.mode === "invite" && fallback.href.startsWith("https://github.com/koinophobia-labs/career-forge-lite"));
  check("every CTA mode has label, href, hint", [checkout, email, fallback].every((cta) => cta.label && cta.href && cta.hint));
  check("price label is set", typeof BETA_PRICE_LABEL === "string" && BETA_PRICE_LABEL.length > 3);
}

// --- Demo campaign ------------------------------------------------------------

{
  const demo = buildDemoState(NOW);
  check("demo has a started profile", demo.profile.currentSituation.length > 20);
  check("demo has 2 lanes from the library", demo.lanes.length === 2);
  check("demo has 3 applications in mixed statuses", demo.applications.length === 3 && new Set(demo.applications.map((a) => a.status)).size === 3);
  check("demo has an overdue application follow-up", demo.applications.some((a) => a.nextFollowUpAt && a.nextFollowUpAt < NOW));
  check("demo has outreach contacts", demo.outreach.length === 2);
  check("demo applications carry sample brief and message", demo.applications.some((a) => a.briefText.includes("MATCH BRIEF") && a.outreachMessage.length > 20));
  check("demo is detected as demo", isDemoState(demo) === true);
  check("empty state is not detected as demo", isDemoState(emptyState()) === false);

  const revived = parseState(JSON.stringify(demo));
  check("demo state survives a storage roundtrip", revived.applications.length === 3 && revived.lanes.length === 2 && isDemoState(revived));

  const serialized = JSON.stringify(demo);
  check("demo persona is fictional: no real-person identifiers", !/blake|taylor|draftkings|earlham/i.test(serialized));
  check("demo contact info is example-domain only", !/@(?!example\.com)[a-z0-9.-]+\.[a-z]{2,}/i.test(serialized.replace(/https?:\/\/[^"]+/g, "")));
}

// --- Weekly plan --------------------------------------------------------------

{
  const validHrefs = new Set(["/", "/profile", "/targets", "/tailor", "/applications", "/outreach", "/interview", "/weekly", "/beta"]);

  const onboarding = buildWeeklyPlan(emptyState(), NOW);
  check("empty state gets an onboarding-flavored plan", onboarding.length >= 3 && onboarding[0].href === "/profile");
  check("empty-state plan includes lane setup", onboarding.some((item) => item.href === "/targets"));

  const active = buildWeeklyPlan(buildDemoState(NOW), NOW);
  check("active state plan has 3–5 items", active.length >= 3 && active.length <= 5);
  check("active plan surfaces due follow-ups first-ish", active.some((item) => /follow-up/i.test(item.title)));
  check("active plan pushes remaining weekly applications", active.some((item) => /application/i.test(item.title) && item.href === "/tailor"));
  check("active plan includes interview prep when interviewing", active.some((item) => item.href === "/interview"));
  check("all plan hrefs are valid routes", [...onboarding, ...active].every((item) => validHrefs.has(item.href)));
  check("all plan items have title and detail", [...onboarding, ...active].every((item) => item.title.length > 5 && item.detail.length > 10));
}

// --- Beta page and positioning copy ------------------------------------------

{
  const betaPage = fs.readFileSync(path.join(root, "src/app/beta/page.tsx"), "utf8");
  check("/beta route exists", true);
  check("beta page positions Career Forge as a campaign system", /campaign/i.test(betaPage));
  check("beta page is honest about beta status", /beta means beta|rough edges/i.test(betaPage));
  check("beta page tracks offer visits and CTA clicks", betaPage.includes("trackBetaOfferVisit") && betaPage.includes("trackBetaCtaClick"));
  check("beta page includes feedback capture", betaPage.includes("FeedbackWidget"));
  check("beta page never claims AI generation", !/ai[- ]powered|powered by ai/i.test(betaPage));

  const landing = fs.readFileSync(path.join(root, "src/components/LandingPage.tsx"), "utf8");
  check("public landing links to the beta offer", landing.includes("/beta") && /campaign system/i.test(landing));

  const feedback = fs.readFileSync(path.join(root, "src/components/FeedbackWidget.tsx"), "utf8");
  check("feedback events avoid unbounded payloads", feedback.includes("FEEDBACK_MAX_LENGTH"));

  const privacyScan = [betaPage, landing].join("\n");
  check("no private contact info in beta surfaces", !/@gmail|@outlook|@hotmail|linkedin\.com\/in|\b\d{3}[-.]\d{3}[-.]\d{4}\b/i.test(privacyScan));
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
