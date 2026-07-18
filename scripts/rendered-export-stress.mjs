// Rendered-export stress regression: generates real PDF and DOCX files through
// the production export path (createVariantFile), then inspects the RENDERED
// artifacts — PDF page geometry via pdfjs and rasterized page images via
// Chromium — rather than only extracted text. Covers long names, long contact
// lines, long titles, many roles, many projects, project-only candidates, long
// wrapped bullets, sparse evidence, long education, multi-page output, and
// career-changer histories with explicit gaps and separation reasons.
//
// Evidence artifacts (PDF, DOCX, page PNGs, extracted text) are written to
// docs/evidence/paid-beta-surge/export-stress/ for PR review.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium } from "playwright";

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
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
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

const { createVariantFile, resumeVariantFilename } = loadTsModule(path.join(root, "src/lib/pack-export.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(`PASS ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

const EVIDENCE_DIR = path.join(root, "docs/evidence/paid-beta-surge/export-stress");
fs.rmSync(EVIDENCE_DIR, { recursive: true, force: true });
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Stress personas. Each is a (dossier identity, variant) pair fed to the real
// production export entry point. Content is entirely synthetic.
// ---------------------------------------------------------------------------
function identity(fullName, overrides = {}) {
  return { identity: { fullName, email: "candidate@example.com", phone: "(555) 010-2000", location: "Portland, OR", links: [], ...overrides } };
}
function variant(resume, { kind = "ats", sectionOrder } = {}) {
  return {
    id: "stress-variant", laneId: "stress-lane", kind, title: "Stress", status: "current", canonical: true,
    userEdited: false, resume, template: "Modern ATS", evidenceReferences: [], userAuthoredPaths: [],
    sectionOrder: sectionOrder ?? ["summary", "skills", "experience", "projects", "education"],
    sourceDossierUpdatedAt: "2026-07-01T00:00:00.000Z", baselineVariantId: null, applicationId: null,
    createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z"
  };
}
function role(title, company, time, bullets) { return { title, company, time, bullets, kind: "role" }; }
function project(title, org, time, bullets) { return { title, company: org, time, bullets, kind: "project" }; }

const LONG_BULLET = "Coordinated a cross-functional accessibility remediation initiative spanning facilities, information technology, and academic affairs, documenting one hundred forty distinct barrier findings, prioritizing them by user impact and estimated remediation cost, and presenting a phased eighteen-month implementation roadmap to university leadership that was adopted without modification";

const personas = [
  {
    id: "long-name-contact",
    label: "Long candidate name + long contact line",
    dossier: identity("Alexandrina Konstantinopoulos-Vandenberghe y Fernández de la Cruz", {
      email: "alexandrina.konstantinopoulos.vandenberghe@example-university-alumni.org",
      phone: "+1 (555) 010-2000 ext. 44821",
      location: "Thousand Oaks, California, United States",
      links: ["linkedin.com/in/alexandrina-konstantinopoulos-vandenberghe", "portfolio.example-site-with-a-long-domain.dev/work"]
    }),
    resume: {
      summary: "Operations coordinator with six years of scheduling, vendor management, and reporting experience.",
      coreSkills: ["Scheduling", "Vendor Management", "Reporting", "Excel"],
      experience: [role("Operations Coordinator", "Meridian Logistics", "2020–2026", ["Scheduled 40 weekly deliveries across three regions", "Reduced invoice disputes 25% by standardizing vendor documentation"])],
      education: "B.A. Communications — State University | 2019",
      linkedinHeadline: "", linkedinSummary: ""
    },
    expect: { minPages: 1, maxPages: 2, headings: ["PROFESSIONAL SUMMARY", "CORE SKILLS", "EXPERIENCE", "EDUCATION"] }
  },
  {
    id: "long-titles",
    label: "Long role and project titles",
    dossier: identity("Sam Ito"),
    resume: {
      summary: "Program specialist focused on regulatory compliance and stakeholder communication.",
      coreSkills: ["Compliance", "Stakeholder Communication"],
      experience: [
        role("Senior Regulatory Compliance and Environmental Health Documentation Program Specialist", "Northwest Regional Water Quality Management District Authority", "2018–2026", ["Maintained permit documentation for 60 municipal facilities"]),
        project("Multi-County Stormwater Runoff Public Reporting Transparency Dashboard Initiative", "Civic Data Collaborative of the Greater Willamette Valley", "2024", ["Published quarterly runoff data for 11 counties in a public dashboard"])
      ],
      education: "", linkedinHeadline: "", linkedinSummary: ""
    },
    expect: { minPages: 1, maxPages: 2, headings: ["PROFESSIONAL SUMMARY", "CORE SKILLS", "EXPERIENCE", "SELECTED PROJECTS"] }
  },
  {
    id: "many-roles-two-page",
    label: "Many conventional roles (two-page output)",
    dossier: identity("Dana Okafor"),
    resume: {
      summary: "Retail and warehouse operations professional with a fifteen-year record across eight employers, consistently promoted into shift-lead and training responsibilities.",
      coreSkills: ["Inventory Control", "Team Training", "Forklift Operation", "Safety Compliance", "POS Systems", "Scheduling"],
      experience: [
        role("Warehouse Shift Lead", "Cascade Distribution", "2023–2026", ["Led a 12-person overnight crew across receiving and put-away", "Cut mis-picks 18% by introducing barcode double-verification", "Trained 9 new hires on powered equipment safety"]),
        role("Inventory Control Specialist", "Cascade Distribution", "2021–2023", ["Reconciled cycle counts across 14,000 SKUs weekly", "Reduced shrink variance from 2.1% to 0.9% in one year"]),
        role("Receiving Associate", "Pacific Freight", "2019–2021", ["Processed 30 inbound trailers weekly", "Maintained zero OSHA-recordable incidents across two years"]),
        role("Retail Department Supervisor", "HomeGoods Depot", "2016–2019", ["Supervised 8 associates across hardware and garden departments", "Raised department customer-satisfaction scores 12 points", "Managed weekend scheduling for a 22-person storewide roster"]),
        role("Sales Associate", "HomeGoods Depot", "2014–2016", ["Ranked top-3 in add-on sales for six consecutive quarters", "Handled 120 daily customer interactions across two departments"]),
        role("Stock Clerk", "Valley Grocers", "2012–2014", ["Rotated perishable stock across 6 aisles daily", "Earned employee-of-the-month four times", "Cut backroom overstock 15% through tighter order tracking"]),
        role("Cashier", "Valley Grocers", "2011–2012", ["Balanced tills within a $2 variance across 400+ shifts", "Trained 3 seasonal cashiers on register procedures"]),
        role("Crew Member", "QuickServe Restaurants", "2010–2011", ["Cross-trained on grill, register, and drive-through stations", "Maintained station cleanliness scores above 95% on every audit"]),
        role("Seasonal Warehouse Associate", "Harvest Fulfillment", "2009–2010", ["Picked 250 orders per shift during peak season", "Kept a 99.7% pick-accuracy rate across the full contract"]),
        role("Grounds Crew Member", "City Parks Department", "2008–2009", ["Maintained 6 neighborhood parks on a weekly rotation", "Logged equipment usage and fuel for a 5-person crew"])
      ],
      education: "High School Diploma — Jefferson High School | 2010",
      linkedinHeadline: "", linkedinSummary: ""
    },
    expect: { minPages: 2, maxPages: 3, headings: ["PROFESSIONAL SUMMARY", "CORE SKILLS", "EXPERIENCE", "EDUCATION"] }
  },
  {
    id: "many-projects",
    label: "Multiple projects alongside roles",
    dossier: identity("Priya Raman"),
    resume: {
      summary: "Community technologist pairing a day job in library services with six shipped civic-technology projects.",
      coreSkills: ["Python", "Data Cleaning", "Community Outreach", "Grant Writing"],
      experience: [
        role("Library Technology Assistant", "City Public Library", "2021–2026", ["Supported 200 weekly patrons across public computing and device-lending programs"]),
        project("Transit Desert Mapping", "Open Data Collective", "2025", ["Mapped bus-access gaps for 40 neighborhoods using GTFS feeds"]),
        project("Food Pantry Scheduler", "Neighborhood Aid Network", "2024", ["Built a volunteer-shift scheduler used by 11 pantries"]),
        project("Ballot Measure Explainer", "Civic Literacy Project", "2024", ["Wrote plain-language explainers read by 90,000 voters"]),
        project("Heat Map Sensor Network", "Climate Resilience Lab", "2023", ["Deployed 25 street-level temperature sensors and published weekly readings"]),
        project("Library of Things Catalog", "City Public Library", "2022", ["Cataloged 700 non-book lendable items into the discovery layer"]),
        project("Rental Inspection Tracker", "Tenant Rights Coalition", "2022", ["Digitized 5 years of paper inspection records into a searchable index"])
      ],
      education: "B.S. Information Science — State University | 2020",
      linkedinHeadline: "", linkedinSummary: ""
    },
    expect: { minPages: 1, maxPages: 3, headings: ["PROFESSIONAL SUMMARY", "CORE SKILLS", "EXPERIENCE", "SELECTED PROJECTS", "EDUCATION"] }
  },
  {
    id: "project-only",
    label: "Project-only candidate (no employers)",
    dossier: identity("Jordan Wu"),
    resume: {
      summary: "Accessibility advocate with three completed audit and documentation projects.",
      coreSkills: ["Accessibility Auditing", "Technical Writing"],
      experience: [
        project("Campus Accessibility Audit", "", "2025", ["Audited 12 campus buildings for accessibility barriers and documented required fixes"]),
        project("Screen Reader Testing Guide", "Volunteer Accessibility Circle", "2024", ["Wrote a 40-page testing guide adopted by three student organizations"]),
        project("Transit Announcement Review", "", "2024", ["Reviewed 300 stop announcements for audibility and accuracy"])
      ],
      education: "", linkedinHeadline: "", linkedinSummary: ""
    },
    expect: { minPages: 1, maxPages: 2, headings: ["PROFESSIONAL SUMMARY", "CORE SKILLS", "PROJECTS"], forbidHeadings: ["EXPERIENCE", "SELECTED EXPERIENCE"], forbidText: ["Independent project"] }
  },
  {
    id: "long-wrapped-bullets",
    label: "Long wrapped bullets",
    dossier: identity("Morgan Reyes"),
    resume: {
      summary: "Facilities coordinator specializing in accessibility remediation and long-form documentation.",
      coreSkills: ["Facilities Coordination", "Documentation"],
      experience: [
        role("Facilities Coordinator", "State University", "2019–2026", [LONG_BULLET, "Maintained elevator, ramp, and door-actuator service logs across 30 buildings with a 100% inspection-readiness record for seven consecutive years, coordinating with four external service vendors and two state inspection agencies", "Scheduled preventive maintenance"]),
        project("Barrier Reporting Portal", "State University", "2023", [LONG_BULLET])
      ],
      education: "A.A.S. Facilities Management — Community College | 2018",
      linkedinHeadline: "", linkedinSummary: ""
    },
    expect: { minPages: 1, maxPages: 2, headings: ["PROFESSIONAL SUMMARY", "EXPERIENCE", "SELECTED PROJECTS", "EDUCATION"] }
  },
  {
    id: "sparse-evidence",
    label: "Sparse evidence (minimal résumé)",
    dossier: identity("Ash Cole", { email: "", phone: "", location: "", links: [] }),
    resume: {
      summary: "Warehouse associate with one year of experience.",
      coreSkills: [],
      experience: [role("Warehouse Associate", "Regional Distribution", "2025–2026", ["Picked and packed 300 orders per shift"])],
      education: "", linkedinHeadline: "", linkedinSummary: ""
    },
    expect: { minPages: 1, maxPages: 1, headings: ["PROFESSIONAL SUMMARY", "EXPERIENCE"], forbidHeadings: ["CORE SKILLS", "EDUCATION", "PROJECTS"] }
  },
  {
    id: "long-education",
    label: "Long education entries",
    dossier: identity("Lena Park"),
    resume: {
      summary: "Early-childhood educator moving into instructional-design support roles.",
      coreSkills: ["Curriculum Planning", "Classroom Management"],
      experience: [role("Lead Preschool Teacher", "Sunrise Learning Center", "2017–2026", ["Planned daily curriculum for a class of 18 three-to-five-year-olds"])],
      education: "M.Ed. Curriculum and Instruction with a Concentration in Early Childhood Special Education — Pacific Northwest Graduate School of Education | 2021; B.A. Human Development and Family Sciences with Departmental Honors — State University College of Public Health and Human Sciences | 2016; Child Development Associate (CDA) Credential — Council for Professional Recognition | renewed 2024; Oregon Registry Step 10 — Oregon Center for Career Development | 2023",
      linkedinHeadline: "", linkedinSummary: ""
    },
    expect: { minPages: 1, maxPages: 2, headings: ["PROFESSIONAL SUMMARY", "EXPERIENCE", "EDUCATION"] }
  },
  {
    id: "three-page",
    label: "Very long history (three-page output)",
    dossier: identity("Robert Castellanos-Whitfield"),
    resume: {
      summary: "Manufacturing and quality professional with a twenty-five-year record spanning machining, inspection, supervision, and continuous-improvement leadership across five plants.",
      coreSkills: ["CNC Machining", "GD&T", "Lean Manufacturing", "Root Cause Analysis", "SPC", "Kaizen Facilitation", "ISO 9001", "Supplier Audits"],
      experience: Array.from({ length: 13 }, (_, index) => role(
        ["Continuous Improvement Manager", "Quality Engineering Supervisor", "Senior Quality Inspector", "Quality Inspector II", "CNC Cell Lead", "CNC Machinist III", "CNC Machinist II", "CNC Machinist I", "Machine Operator", "Production Associate", "Tool Crib Attendant", "Material Handler", "General Laborer"][index],
        ["Precision Aerostructures", "Precision Aerostructures", "Vector Machining", "Vector Machining", "Vector Machining", "Cascade Tool & Die", "Cascade Tool & Die", "Cascade Tool & Die", "Northwest Fabrication", "Northwest Fabrication", "Ironside Manufacturing", "Ironside Manufacturing", "Ironside Manufacturing"][index],
        `${2024 - index * 2}–${2026 - index * 2}`,
        [
          `Led ${3 + index} process-improvement events with documented annual savings`,
          `Maintained first-pass yield above ${99 - index}% across assigned work centers`,
          `Trained ${2 + index} operators on inspection and setup procedures`,
          `Reduced setup time ${10 + index}% through standardized tooling carts`,
          `Documented ${20 + index * 5} work instructions to current revision`
        ]
      )),
      education: "A.A.S. Machine Tool Technology — Community College | 1999; Lean Six Sigma Black Belt — ASQ | 2015",
      linkedinHeadline: "", linkedinSummary: ""
    },
    expect: { minPages: 3, maxPages: 5, headings: ["PROFESSIONAL SUMMARY", "CORE SKILLS", "EXPERIENCE", "EDUCATION"] }
  },
  {
    id: "career-changer-gaps",
    label: "Career changer with explicit gaps + separation reason in source",
    dossier: identity("Tasha Nguyen"),
    resume: {
      summary: "Customer operations professional transitioning into technical support. Resolved 4,000 support tickets across four years until the department reorganized in 2025.",
      coreSkills: ["Ticket Triage", "Customer Communication", "Knowledge Base Writing"],
      experience: [
        role("Customer Operations Specialist", "TelCom Services", "2021–2025", [
          "Resolved 4,000 tickets with a 96% satisfaction rating",
          "Wrote 60 knowledge-base articles adopted as team canon until I was laid off in June 2025",
          "Mentored 5 new agents through onboarding"
        ]),
        project("Home Lab Network Rebuild", "", "2025–2026", ["Rebuilt a segmented home network with documented firewall rules while retraining for technical-support roles"])
      ],
      education: "CompTIA A+ — 2026",
      linkedinHeadline: "", linkedinSummary: ""
    },
    expect: {
      minPages: 1, maxPages: 2,
      headings: ["PROFESSIONAL SUMMARY", "CORE SKILLS", "EXPERIENCE", "SELECTED PROJECTS", "EDUCATION"],
      forbidText: ["laid off", "reorganized", "termination"]
    }
  }
];

// ---------------------------------------------------------------------------
// Universal content bans: internal identifiers, debug language, context-only
// and separation-reason material. Applied to every extracted artifact text.
// ---------------------------------------------------------------------------
const UNIVERSAL_FORBIDDEN = [
  "stress-variant", "stress-lane", "pack-", "lane-", "ev-", "dossier", "needs-review", "needs review",
  "[specific reason]", "Target roles:", "laid off", "terminated", "[object Object]",
  "console.log", "lorem ipsum"
];
// Tokens that only indicate a defect as standalone words — substring matching
// would false-positive on "maintenance" (NaN), "annually" (null), etc.
const FORBIDDEN_WORDS = [/\bundefined\b/, /\bnull\b/, /\bNaN\b/, /\bTODO\b/];
function forbiddenHits(text, extra = []) {
  const lower = text.toLowerCase();
  const substrings = [...UNIVERSAL_FORBIDDEN, ...extra].filter((needle) => lower.includes(needle.toLowerCase()));
  const words = FORBIDDEN_WORDS.filter((pattern) => pattern.test(text)).map((pattern) => String(pattern));
  return [...substrings, ...words];
}

// ---------------------------------------------------------------------------
// PDF geometry analysis via pdfjs (rendered layout, not just text).
// ---------------------------------------------------------------------------
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

async function analyzePdf(buffer) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((item) => typeof item.str === "string" && item.str.trim())
      .map((item) => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height
      }));
    pages.push({ pageNumber, width: viewport.width, height: viewport.height, items });
  }
  const fullText = pages.map((page) => page.items.map((item) => item.text).join("\n")).join("\n");
  return { numPages: doc.numPages, pages, fullText, doc };
}

const HEADING_TEXTS = new Set([
  "PROFESSIONAL SUMMARY", "CORE SKILLS", "EXPERIENCE", "SELECTED EXPERIENCE", "PROJECTS", "SELECTED PROJECTS", "EDUCATION"
]);

function geometryFindings(analysis) {
  const findings = [];
  for (const page of analysis.pages) {
    // Clipping: nothing may extend past the physical page; nothing should
    // extend meaningfully past the right content margin either.
    for (const item of page.items) {
      if (item.x < 0 || item.y < 0 || item.y > page.height) findings.push(`p${page.pageNumber} text off page: "${item.text.slice(0, 40)}"`);
      if (item.x + item.width > page.width + 1) findings.push(`p${page.pageNumber} text clipped at right page edge: "${item.text.slice(0, 40)}"`);
      if (item.x + item.width > page.width - 54 + 8) findings.push(`p${page.pageNumber} text crosses right margin: "${item.text.slice(0, 40)}"`);
    }
    // Text-on-text collisions: two distinct items whose boxes substantially
    // overlap indicate a layout defect (double-print or bad y tracking).
    const sorted = [...page.items].sort((a, b) => b.y - a.y || a.x - b.x);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i]; const b = sorted[j];
        if (a.y - b.y > Math.max(a.height, b.height)) break;
        const verticalOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        const horizontalOverlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        if (verticalOverlap > 0.6 * Math.min(a.height, b.height) && horizontalOverlap > 3) {
          findings.push(`p${page.pageNumber} text collision: "${a.text.slice(0, 30)}" overlaps "${b.text.slice(0, 30)}"`);
        }
      }
    }
    // Orphan headings: a section heading must not be the last line on a page
    // when the document continues.
    if (page.items.length && page.pageNumber < analysis.numPages) {
      const last = [...page.items].sort((a, b) => a.y - b.y)[0];
      if (HEADING_TEXTS.has(last.text.trim().toUpperCase())) findings.push(`p${page.pageNumber} orphan heading at page bottom: "${last.text}"`);
    }
    // Heading→content gap: the horizontal rule sits between them; if a
    // following line starts too close to the heading baseline it collides
    // with the rule.
    for (const item of page.items) {
      if (!HEADING_TEXTS.has(item.text.trim().toUpperCase())) continue;
      const below = page.items.filter((other) => other !== item && other.y < item.y).sort((a, b) => b.y - a.y)[0];
      if (below && item.y - below.y < 11) findings.push(`p${page.pageNumber} content too close under heading "${item.text}" (${(item.y - below.y).toFixed(1)}pt)`);
    }
  }
  if (!analysis.pages[0] || analysis.pages[0].items.length === 0) findings.push("blank first page");
  const blankPages = analysis.pages.filter((page) => page.items.length === 0).map((page) => page.pageNumber);
  if (blankPages.length) findings.push(`blank page(s): ${blankPages.join(", ")}`);
  return findings;
}

// ---------------------------------------------------------------------------
// Rendered page rasterization: pdfjs inside Chromium, canvas → PNG. This is
// the "look at the actual pixels" pass, saved as PR evidence.
// ---------------------------------------------------------------------------
const HARNESS_DIR = path.join(root, "node_modules/pdfjs-dist/build");
const HARNESS_PATH = path.join(HARNESS_DIR, "career-forge-render-harness.html");
fs.writeFileSync(HARNESS_PATH, `<!doctype html><html><body><script type="module">
import * as pdfjsLib from "./pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdf.worker.min.mjs";
window.renderPdf = async (base64) => {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    pages.push(canvas.toDataURL("image/png"));
  }
  return pages;
};
window.harnessReady = true;
</script></body></html>`);

async function rasterizePdf(page, buffer, outDir, baseName) {
  const base64 = Buffer.from(buffer).toString("base64");
  const dataUrls = await page.evaluate((b64) => window.renderPdf(b64), base64);
  const files = [];
  dataUrls.forEach((dataUrl, index) => {
    const file = path.join(outDir, `${baseName}-page-${index + 1}.png`);
    fs.writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
    files.push(file);
  });
  return files;
}

// ---------------------------------------------------------------------------
// DOCX analysis: structural XML checks + rendered HTML screenshot via mammoth.
// ---------------------------------------------------------------------------
const JSZipLib = require("jszip");
const mammoth = require("mammoth");

async function analyzeDocx(buffer) {
  const zip = await JSZipLib.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml").async("string");
  const text = documentXml.replace(/<w:p[ >]/g, "\n<w:p ").replace(/<[^>]+>/g, "").replace(/[ \t]+/g, " ");
  const headingCount = (documentXml.match(/w:val="Heading1"/g) ?? []).length;
  return { documentXml, text, headingCount };
}

async function screenshotDocx(page, buffer, outFile) {
  const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) });
  await page.setContent(`<html><head><style>body{font-family:Arial;max-width:7.5in;margin:0.5in auto;font-size:10.5pt;line-height:1.35}h1{font-size:11pt;border-bottom:1px solid #444;text-transform:uppercase}</style></head><body>${html}</body></html>`);
  await page.screenshot({ path: outFile, fullPage: true });
}

// ---------------------------------------------------------------------------
// Run every persona through PDF + DOCX generation and inspection.
// ---------------------------------------------------------------------------
const browser = await chromium.launch({ headless: true, args: ["--allow-file-access-from-files"] });
const browserPage = await browser.newPage();
await browserPage.goto(`file://${HARNESS_PATH}`);
await browserPage.waitForFunction(() => window.harnessReady === true);

const summaryLines = ["# Rendered export stress evidence", "", `Generated by scripts/rendered-export-stress.mjs on a fixed persona set.`, ""];

try {
  for (const persona of personas) {
    const outDir = path.join(EVIDENCE_DIR, persona.id);
    fs.mkdirSync(outDir, { recursive: true });
    const personaVariant = variant(persona.resume);

    const pdfFile = await createVariantFile(personaVariant, persona.dossier, "Stress Lane", "pdf");
    const docxFile = await createVariantFile(personaVariant, persona.dossier, "Stress Lane", "docx");
    const pdfBuffer = Buffer.from(await pdfFile.blob.arrayBuffer());
    const docxBuffer = Buffer.from(await docxFile.blob.arrayBuffer());
    fs.writeFileSync(path.join(outDir, pdfFile.filename), pdfBuffer);
    fs.writeFileSync(path.join(outDir, docxFile.filename), docxBuffer);

    // Deterministic filenames: same inputs must yield the same name, and the
    // name must never contain raw spaces or unsafe characters.
    const again = resumeVariantFilename(persona.dossier.identity.fullName, "Stress Lane", "ats", "pdf");
    check(`${persona.id}: deterministic safe PDF filename`, again === pdfFile.filename && /^[A-Za-z0-9-]+\.pdf$/.test(pdfFile.filename), pdfFile.filename);

    const analysis = await analyzePdf(pdfBuffer);
    fs.writeFileSync(path.join(outDir, "extracted-text.txt"), analysis.fullText);

    check(`${persona.id}: PDF page count ${analysis.numPages} within [${persona.expect.minPages}, ${persona.expect.maxPages}]`,
      analysis.numPages >= persona.expect.minPages && analysis.numPages <= persona.expect.maxPages);
    check(`${persona.id}: PDF text is selectable (text layer present on every page)`,
      analysis.pages.every((page) => page.items.length > 0));

    const geometry = geometryFindings(analysis);
    check(`${persona.id}: PDF geometry clean (no clipping/collisions/orphans/blank pages)`, geometry.length === 0, geometry.join(" | "));

    for (const headingText of persona.expect.headings) {
      check(`${persona.id}: PDF has section "${headingText}"`, analysis.fullText.toUpperCase().includes(headingText));
    }
    for (const headingText of persona.expect.forbidHeadings ?? []) {
      const upper = analysis.pages.flatMap((page) => page.items.map((item) => item.text.trim().toUpperCase()));
      check(`${persona.id}: PDF has NO "${headingText}" heading`, !upper.includes(headingText));
    }
    const pdfLeaks = forbiddenHits(analysis.fullText, persona.expect.forbidText ?? []);
    check(`${persona.id}: PDF free of internal IDs, debug language, and context/separation leakage`, pdfLeaks.length === 0, pdfLeaks.join(", "));
    check(`${persona.id}: PDF header shows candidate name`, analysis.pages[0].items.some((item) => item.text.includes(persona.dossier.identity.fullName.split(" ")[0])));

    const pageImages = await rasterizePdf(browserPage, pdfBuffer, outDir, "pdf");
    check(`${persona.id}: rendered ${pageImages.length} PDF page image(s)`, pageImages.length === analysis.numPages);

    // DOCX: structural + rendered checks.
    const docx = await analyzeDocx(docxBuffer);
    fs.writeFileSync(path.join(outDir, "docx-text.txt"), docx.text);
    for (const headingText of persona.expect.headings) {
      check(`${persona.id}: DOCX has section "${headingText}"`, docx.text.toUpperCase().includes(headingText));
    }
    for (const headingText of persona.expect.forbidHeadings ?? []) {
      check(`${persona.id}: DOCX has NO "${headingText}" section`, !new RegExp(`^\\s*${headingText}\\s*$`, "im").test(docx.text.toUpperCase()));
    }
    const docxLeaks = forbiddenHits(docx.text, persona.expect.forbidText ?? []);
    check(`${persona.id}: DOCX free of internal IDs, debug language, and context/separation leakage`, docxLeaks.length === 0, docxLeaks.join(", "));
    check(`${persona.id}: DOCX heading styles applied`, docx.headingCount >= persona.expect.headings.length);
    await screenshotDocx(browserPage, docxBuffer, path.join(outDir, "docx-rendered.png"));

    summaryLines.push(`## ${persona.id} — ${persona.label}`, `- PDF: ${pdfFile.filename} (${analysis.numPages} page(s))`, `- DOCX: ${docxFile.filename}`, `- Rendered: ${pageImages.length} PDF page PNG(s) + docx-rendered.png`, "");
  }
} finally {
  await browser.close();
  fs.rmSync(HARNESS_PATH, { force: true });
}

fs.writeFileSync(path.join(EVIDENCE_DIR, "README.md"), summaryLines.join("\n"));

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
