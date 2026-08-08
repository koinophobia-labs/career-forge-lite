// C1-09 — IDENTITY FIDELITY IN THE DELIVERED PDF.
//
//   A delivery format may transform presentation, but it may not erase or
//   substitute user-authored identity.
//
// The PDF export wrote every string with a standard-14 Type1 font fixed at
// WinAnsiEncoding, so any name containing a character outside that 8-bit
// repertoire was emitted as UTF-16BE and read back one byte at a time. The
// DOCX in the same archive was correct, which is how it survived so long.
//
// This suite is deliberately NOT "supports one Unicode example". It runs
// representative names across EVERY user-authored identity field — person,
// employer, job title, education institution — and inspects the DELIVERED PDF
// through a real reader (pdfjs), not the source model and not the string
// handed to the writer.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const moduleCache = new Map();

function load(filePath) {
  const absolute = path.resolve(filePath);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  const { outputText } = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: absolute
  });
  const mod = { exports: {} };
  moduleCache.set(absolute, mod);
  const dir = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return load(path.join(root, "src", `${request.slice(2)}.ts`));
    if (request.startsWith(".")) return load(path.resolve(dir, request.endsWith(".ts") ? request : `${request}.ts`));
    return require(request);
  };
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, mod, mod.exports, dir, absolute);
  return mod.exports;
}

const { emptyDossier } = load(path.join(root, "src/lib/dossier.ts"));
const { createVariantFile } = load(path.join(root, "src/lib/pack-export.ts"));
const { unrepresentableCharacters, needsUnicodeFont } = load(path.join(root, "src/lib/pdf-text-fidelity.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(`PASS ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

const NOW = "2026-08-07T09:00:00.000Z";

async function deliveredPdfText(dossier, resume) {
  const variant = {
    id: "v1", laneId: null, kind: "ats", sectionOrder: undefined, userEdited: false,
    userAuthoredPaths: [], status: "ready", evidenceReferences: [], createdAt: NOW, updatedAt: NOW, resume
  };
  const { blob, unrepresentable } = await createVariantFile(variant, dossier, "Retail", "pdf");
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data, useSystemFonts: false,
    standardFontDataUrl: path.join(root, "node_modules/pdfjs-dist/standard_fonts/")
  }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i += 1) {
    const content = await doc.getPage(i).then((page) => page.getTextContent());
    text += `${content.items.map((item) => item.str).join(" ")} `;
  }
  return { text, unrepresentable };
}

// Representative names, one per script family that WinAnsi cannot carry, placed
// in a DIFFERENT identity field each so no field is assumed safe by proxy.
const CASES = [
  { field: "person name (Polish + Turkish)", value: "Zofia Wiśniewska-Çağlayan", slot: "name" },
  { field: "employer (Polish)", value: "Żabka Polska", slot: "company" },
  { field: "employer (Cyrillic)", value: "Университет ИТМО", slot: "company2" },
  { field: "job title (Romanian)", value: "Șef de tură", slot: "title" },
  { field: "institution (Czech)", value: "Ošetřovatelská škola", slot: "education" },
  { field: "employer (Greek)", value: "Ελληνικά Ταχυδρομεία", slot: "company3" }
];

console.log("\n--- every identity field, decoded from the delivered PDF ---");
{
  const dossier = {
    ...emptyDossier(NOW),
    identity: { fullName: CASES[0].value, email: "z@example.com", phone: "", location: "Kraków", links: [] }
  };
  const resume = {
    summary: "", coreSkills: [], linkedinHeadline: "", linkedinSummary: "",
    education: CASES[4].value,
    experience: [
      { title: CASES[3].value, company: CASES[1].value, time: "2018 - 2024", bullets: ["Ran the night shift."], kind: "role" },
      { title: "Analyst", company: CASES[2].value, time: "2015 - 2018", bullets: ["Ran the intake desk."], kind: "role" },
      { title: "Courier", company: CASES[5].value, time: "2012 - 2015", bullets: ["Sorted the morning round."], kind: "role" }
    ]
  };
  const { text, unrepresentable } = await deliveredPdfText(dossier, resume);
  for (const c of CASES) {
    check(`${c.field}: "${c.value}" survives into the delivered PDF`, text.includes(c.value),
      JSON.stringify(text.replace(/\s+/g, " ").slice(0, 200)));
  }
  check("  nothing is reported as unrepresentable for these scripts",
    unrepresentable.length === 0, JSON.stringify(unrepresentable));
}

console.log("\n--- ASCII documents are unaffected ---");
{
  const dossier = { ...emptyDossier(NOW), identity: { fullName: "Sam Okafor", email: "sam@example.com", phone: "", location: "Leeds", links: [] } };
  const { text } = await deliveredPdfText(dossier, {
    summary: "", coreSkills: [], education: "BSc Business", linkedinHeadline: "", linkedinSummary: "",
    experience: [{ title: "Shop Assistant", company: "Marks & Spencer, Leeds", time: "2020 - 2024", bullets: ["Ran the daily stock count."], kind: "role" }]
  });
  check("an all-ASCII résumé still renders correctly", text.includes("Marks & Spencer, Leeds") && text.includes("Sam Okafor"),
    JSON.stringify(text.replace(/\s+/g, " ").slice(0, 160)));
}

console.log("\n--- the refusal half: scripts no embedded font covers ---");
{
  // Liberation Sans has no CJK or Arabic glyphs. The truthful outcome is a
  // REPORT the product can act on — never a substituted name.
  for (const value of ["株式会社ローソン", "مستشفى الملك فيصل", "北京字节跳动科技有限公司"]) {
    check(`"${value}" is reported as unrepresentable rather than corrupted`,
      unrepresentableCharacters(value).length > 0, JSON.stringify(unrepresentableCharacters(value)));
  }
  check("  and Latin/Cyrillic/Greek are NOT falsely reported",
    ["Żabka Polska", "Университет ИТМО", "Ελληνικά Ταχυδρομεία", "Ošetřovatelská škola"]
      .every((v) => unrepresentableCharacters(v).length === 0));
  check("  the encoder knows when it needs the Unicode font",
    needsUnicodeFont("Żabka Polska") && !needsUnicodeFont("Marks & Spencer, Leeds"));

  const dossier = { ...emptyDossier(NOW), identity: { fullName: "王小明", email: "w@example.com", phone: "", location: "", links: [] } };
  const { unrepresentable } = await deliveredPdfText(dossier, {
    summary: "", coreSkills: [], education: "", linkedinHeadline: "", linkedinSummary: "",
    experience: [{ title: "Analyst", company: "株式会社ローソン", time: "2019 - 2024", bullets: ["Ran the intake desk."], kind: "role" }]
  });
  check("the export REPORTS what it cannot represent instead of shipping mojibake silently",
    unrepresentable.length > 0, JSON.stringify(unrepresentable));
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
