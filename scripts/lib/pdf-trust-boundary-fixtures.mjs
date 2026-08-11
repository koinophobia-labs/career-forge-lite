import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";

function bundledFont(relativePath) {
  const source = fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const match = source.match(/export const \w+ = "([A-Za-z0-9+/=]+)";/);
  if (!match) throw new Error(`Could not read bundled fixture font: ${relativePath}`);
  return match[1];
}

function pdfString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function stream(body, dictionary = "") {
  const bytes = Buffer.byteLength(body, "binary");
  return `<< /Length ${bytes}${dictionary ? ` ${dictionary}` : ""} >>\nstream\n${body}\nendstream`;
}

function assemblePdf(objects) {
  const sorted = [...objects].sort((a, b) => a[0] - b[0]);
  let output = "%PDF-1.7\n%CF02\n";
  const offsets = new Map();
  for (const [number, body] of sorted) {
    offsets.set(number, Buffer.byteLength(output, "binary"));
    output += `${number} 0 obj\n${body}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output, "binary");
  const size = Math.max(...sorted.map(([number]) => number)) + 1;
  output += `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let number = 1; number < size; number += 1) {
    output += `${String(offsets.get(number) ?? 0).padStart(10, "0")} 00000 ${offsets.has(number) ? "n" : "f"} \n`;
  }
  output += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, "binary");
}

function textPagePdf(text, { catalog = "", page = "", extra = [] } = {}) {
  const content = `BT /F1 12 Tf 72 720 Td (${pdfString(text)}) Tj ET`;
  return assemblePdf([
    [1, `<< /Type /Catalog /Pages 2 0 R ${catalog} >>`],
    [2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
    [3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R ${page} >>`],
    [4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"],
    [5, stream(content)],
    ...extra
  ]);
}

function repeatedTextPdf(characterCount) {
  const chunks = [];
  let remaining = characterCount;
  while (remaining > 0) {
    const size = Math.min(900, remaining);
    chunks.push(`1 0 0 1 10 700 Tm (${"A".repeat(size)}) Tj`);
    remaining -= size;
  }
  const content = `BT /F1 0.1 Tf ${chunks.join(" ")} ET`;
  return assemblePdf([
    [1, "<< /Type /Catalog /Pages 2 0 R >>"],
    [2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
    [3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"],
    [4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"],
    [5, stream(content)]
  ]);
}

function jspdfBytes(configure) {
  const document = new jsPDF({ unit: "pt", format: "letter", compress: false });
  document.setCreationDate(new Date("2026-08-11T00:00:00.000Z"));
  document.setFileId("00112233445566778899AABBCCDDEEFF");
  configure(document);
  return Buffer.from(document.output("arraybuffer"));
}

function manyPagePdf(count) {
  const objects = [];
  const kids = [];
  const fontNumber = 3 + count * 2;
  for (let index = 0; index < count; index += 1) {
    const pageNumber = 3 + index * 2;
    const contentNumber = pageNumber + 1;
    kids.push(`${pageNumber} 0 R`);
    objects.push([
      pageNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontNumber} 0 R >> >> /Contents ${contentNumber} 0 R >>`
    ]);
    objects.push([contentNumber, stream(`BT /F1 12 Tf 72 720 Td (Resume page ${index + 1}) Tj ET`)]);
  }
  return assemblePdf([
    [1, "<< /Type /Catalog /Pages 2 0 R >>"],
    [2, `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${count} >>`],
    ...objects,
    [fontNumber, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
  ]);
}

function write(outputDir, name, bytes) {
  const target = path.join(outputDir, name);
  fs.writeFileSync(target, bytes);
  return target;
}

export function generatePdfTrustBoundaryFixtures(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const files = {};
  files.simple = write(outputDir, "simple-resume.pdf", jspdfBytes((pdf) => {
    pdf.text("Jamie Rivera", 72, 80);
    pdf.text("Operations Specialist - Acme - 2021 to 2025", 72, 105);
    pdf.text("Reduced response time by 24 percent and trained six teammates.", 72, 130);
  }));
  files.multiPage = write(outputDir, "multi-page-resume.pdf", jspdfBytes((pdf) => {
    pdf.text("Jamie Rivera - Operations Specialist", 72, 80);
    pdf.text("Resolved customer escalations and documented procedures.", 72, 110);
    pdf.addPage();
    pdf.text("Earlier role - Support Coordinator - 2018 to 2021", 72, 80);
    pdf.text("Built weekly reports and trained four new hires.", 72, 110);
  }));
  files.unicode = write(outputDir, "unicode-resume.pdf", jspdfBytes((pdf) => {
    const font = bundledFont("../../src/lib/fonts/liberationSansRegular.ts");
    pdf.addFileToVFS("LiberationSans-Regular.ttf", font);
    pdf.addFont("LiberationSans-Regular.ttf", "LiberationSans", "normal");
    pdf.setFont("LiberationSans", "normal");
    pdf.text("Zofia Wiśniewska-Çağlayan — Żabka Polska", 72, 80);
    pdf.text("Coordinated teams • documented results • improved quality.", 72, 110);
  }));
  files.internalLink = write(outputDir, "internal-link.pdf", textPagePdf("Internal link remains inert", {
    page: "/Annots [6 0 R]",
    extra: [[6, "<< /Type /Annot /Subtype /Link /Rect [72 700 200 720] /A << /S /GoTo /D [3 0 R /Fit] >> >>"]]
  }));
  files.externalLink = write(outputDir, "external-link.pdf", textPagePdf("External sentinel link", {
    page: "/Annots [6 0 R]",
    extra: [[6, "<< /Type /Annot /Subtype /Link /Rect [72 700 200 720] /A << /S /URI /URI (https://pdf-action.invalid/sentinel) >> >>"]]
  }));
  files.linkedResume = write(outputDir, "linked-resume.pdf", assemblePdf([
    [1, "<< /Type /Catalog /Pages 2 0 R >>"],
    [2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
    [3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /Annots [6 0 R 7 0 R 8 0 R] >>"],
    [4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"],
    [5, stream([
      "BT /F1 16 Tf 72 740 Td (Jamie Rivera) Tj",
      "0 -24 Td /F1 11 Tf (jamie.rivera@example.com) Tj",
      "0 -18 Td (https://www.linkedin.com/in/jamie-rivera) Tj",
      "0 -18 Td (https://jamierivera.example/portfolio) Tj",
      "0 -28 Td (Operations Specialist - Acme - 2021 to 2025) Tj",
      "0 -18 Td (Reduced response time by 24 percent and trained six teammates.) Tj ET"
    ].join("\n"))],
    [6, "<< /Type /Annot /Subtype /Link /Rect [72 710 250 728] /A << /S /URI /URI (mailto:jamie.rivera@example.com) >> >>"],
    [7, "<< /Type /Annot /Subtype /Link /Rect [72 690 330 708] /A << /S /URI /URI (https://www.linkedin.com/in/jamie-rivera) >> >>"],
    [8, "<< /Type /Annot /Subtype /Link /Rect [72 670 310 688] /A << /S /URI /URI (https://jamierivera.example/portfolio) >> >>"]
  ]));
  files.formMetadata = write(outputDir, "metadata-form.pdf", textPagePdf("Metadata and form text", {
    catalog: "/Metadata 6 0 R /AcroForm << /Fields [7 0 R] >>",
    page: "/Annots [7 0 R]",
    extra: [
      [6, stream("<metadata>career forge inert fixture</metadata>", "/Type /Metadata /Subtype /XML")],
      [7, "<< /Type /Annot /Subtype /Widget /FT /Tx /T (Name) /V (Jamie Rivera) /Rect [72 650 220 675] /P 3 0 R >>"]
    ]
  }));
  files.imageOnly = write(outputDir, "image-only.pdf", jspdfBytes(() => {}));
  files.invalidHeader = write(outputDir, "invalid-header.pdf", Buffer.from("NOT_A_PDF\n", "utf8"));
  files.truncated = write(outputDir, "truncated.pdf", Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog", "binary"));
  files.brokenXref = write(outputDir, "broken-xref.pdf", Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n999999\n%%EOF", "binary"));
  files.corruptObjectStream = write(outputDir, "corrupt-object-stream.pdf", Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /ObjStm /N 9 /First 1 /Length 4 >>\nstream\nxxxx\nendstream\nendobj\n%%EOF", "binary"));
  files.corruptCompression = write(outputDir, "corrupt-compression.pdf", Buffer.from("%PDF-1.7\n1 0 obj\n<< /Length 8 /Filter /FlateDecode >>\nstream\nBADZIP!!\nendstream\nendobj\n%%EOF", "binary"));
  files.encrypted = write(outputDir, "password-protected.pdf", Buffer.from(new jsPDF({
    encryption: { userPassword: "sentinel", ownerPassword: "sentinel-owner", userPermissions: ["print"] }
  }).text("Password protected resume", 72, 80).output("arraybuffer")));
  files.overPageLimit = write(outputDir, "over-page-limit.pdf", manyPagePdf(41));
  files.excessiveText = write(outputDir, "excessive-text.pdf", repeatedTextPdf(250_100));
  files.slow = write(outputDir, "bounded-slow.pdf", jspdfBytes((pdf) => {
    for (let page = 1; page <= 40; page += 1) {
      if (page > 1) pdf.addPage();
      for (let line = 0; line < 60; line += 1) pdf.text(`Page ${page} resume detail line ${line} with bounded inert text`, 40, 40 + line * 11);
    }
  }));
  files.javascriptAction = write(outputDir, "javascript-action.pdf", textPagePdf("JavaScript sentinel remains inert", {
    catalog: "/Names << /JavaScript << /Names [(sentinel) 6 0 R] >> >>",
    extra: [[6, "<< /S /JavaScript /JS (app.alert\\(career-forge-inert-sentinel\\)) >>"]]
  }));
  files.openAction = write(outputDir, "open-action.pdf", textPagePdf("OpenAction sentinel remains inert", {
    catalog: "/OpenAction 6 0 R",
    extra: [[6, "<< /S /JavaScript /JS (app.alert\\(career-forge-inert-open-action\\)) >>"]]
  }));
  files.additionalAction = write(outputDir, "additional-action.pdf", textPagePdf("Additional action sentinel remains inert", {
    page: "/AA << /O 6 0 R >>",
    extra: [[6, "<< /S /JavaScript /JS (app.alert\\(career-forge-inert-additional-action\\)) >>"]]
  }));
  files.uriAction = files.externalLink;
  files.launchAction = write(outputDir, "launch-action.pdf", textPagePdf("Launch action sentinel remains inert", {
    page: "/Annots [6 0 R]",
    extra: [[6, "<< /Type /Annot /Subtype /Link /Rect [72 700 200 720] /A << /S /Launch /F (inert-sentinel.txt) >> >>"]]
  }));
  files.attachment = write(outputDir, "attachment.pdf", textPagePdf("Attachment sentinel remains inert", {
    catalog: "/Names << /EmbeddedFiles << /Names [(inert-sentinel.txt) 6 0 R] >> >>",
    extra: [
      [6, "<< /Type /Filespec /F (inert-sentinel.txt) /EF << /F 7 0 R >> >>"],
      [7, stream("inert attachment marker", "/Type /EmbeddedFile")]
    ]
  }));
  files.multipleActions = write(outputDir, "multiple-actions.pdf", textPagePdf("Multiple active markers remain inert", {
    catalog: "/OpenAction 6 0 R",
    page: "/Annots [7 0 R] /AA << /O 6 0 R >>",
    extra: [
      [6, "<< /S /JavaScript /JS (app.alert\\(career-forge-inert-multiple\\)) >>"],
      [7, "<< /Type /Annot /Subtype /Link /Rect [72 700 200 720] /A << /S /URI /URI (https://pdf-action.invalid/multiple) >> >>"]
    ]
  }));
  return files;
}
