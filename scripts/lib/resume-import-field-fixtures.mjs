import fs from "node:fs";
import path from "node:path";
import { Document, Packer, Paragraph } from "docx";
import { jsPDF } from "jspdf";

const lines = (...values) => values.flat().join("\n");

export const RESUME_IMPORT_FIELD_FIXTURES = {
  clean: {
    text: lines(
      "Morgan Lee",
      "morgan.lee@example.com",
      "(312) 555-0142",
      "Chicago, IL",
      "https://www.linkedin.com/in/morgan-lee",
      "https://morganlee.example",
      "PROFESSIONAL EXPERIENCE",
      "Support Lead — Northstar Software | Jan 2021 - Present",
      "Resolved customer escalations and documented support workflows.",
      "Customer Success Specialist — Harbor Health | 2018-2020",
      "Supported healthcare customers across implementation milestones.",
      "EDUCATION",
      "Lakeview University — BS Information Systems | 2018",
      "SELECTED PROJECTS",
      "Skills Matrix | 2023",
      "Built a skills inventory for cross-functional support teams.",
      "TECHNICAL SKILLS",
      "Zendesk, Jira, SQL"
    ),
    expected: {
      identity: ["Morgan Lee"], emails: ["morgan.lee@example.com"], phones: ["(312) 555-0142"], locations: ["Chicago, IL"],
      links: ["https://www.linkedin.com/in/morgan-lee", "https://morganlee.example"],
      roles: [
        { title: "Support Lead", employer: "Northstar Software", startDate: "Jan 2021", endDate: "", current: true },
        { title: "Customer Success Specialist", employer: "Harbor Health", startDate: "2018", endDate: "2020", current: false }
      ],
      education: [{ institution: "Lakeview University", credential: "BS", field: "Information Systems", dates: "2018" }],
      projects: [{ name: "Skills Matrix", dates: "2023" }], skills: ["Zendesk", "Jira", "SQL"]
    }
  },
  noisy: {
    text: lines(
      "Northstar Software / Support Lead / 2021-2024",
      "(312) 555-0142",
      "EXPERIENCE", "EXPERIENCE", "----------------",
      "Northstar Software / Support Lead / 2020-2024",
      "Harbor Health / Customer Success Specialist / 2018-2020",
      "Resolved duplicate billing escalations.", "Resolved duplicate billing escalations.",
      "https://www.linkedin.com/in/morgan-lee", "Page 1 of 1"
    )
  },
  conflictingIdentity: {
    files: [
      { filename: "contact-a.txt", text: lines("Morgan Lee", "morgan.lee@example.com", "(312) 555-0142", "Chicago, IL", "https://www.linkedin.com/in/morgan-lee") },
      { filename: "contact-b.txt", text: lines("Morgan Lee", "morgan.alt@example.com", "+1 773 555 0199", "Evanston, IL", "https://linkedin.com/in/morgan-lee") }
    ]
  },
  malformedStructure: {
    text: lines(
      "MORGAN LEE — RESUME", "experience:",
      "Program Manager — Education Works | 2020-2022",
      "Education Specialist — Civic Lab | 2018-2020",
      "selected projects:", "Skills Matrix | 2023",
      "Built a taxonomy for internal skills.", "MORGAN LEE — RESUME", "2 / 2"
    )
  },
  chronology: {
    text: lines(
      "EXPERIENCE",
      "Support Lead — Northstar Software | 2021-Present",
      "Consultant — Harbor Health | Jan 2022 - May 2023",
      "Advisor — Civic Lab | 2019-2021",
      "Advisor — Civic Lab | 2018-2021",
      "EDUCATION", "Lakeview University — BS Information Systems | 2018",
      "PROJECTS", "Launch Readiness | March 2024"
    )
  },
  noFormalEmployment: {
    text: lines(
      "Avery Jones", "avery@example.com",
      "VOLUNTEER EXPERIENCE", "Community Garden Volunteer — Neighborhood Alliance | 2022-Present",
      "Coordinated weekly volunteer schedules.",
      "Organized neighborhood planting events.",
      "EDUCATION", "City College — Certificate in Project Coordination | 2022",
      "SKILLS", "Scheduling, Facilitation, Community outreach"
    )
  },
  numericTraps: {
    text: lines(
      "CONTACT", "+1 312 555 0142", "Chicago, IL 60607",
      "EXPERIENCE", "2021-2024", "Delivered 10,000 hours of coverage.", "Improved retention by 28%.",
      "Migrated platform to Version 2.0.", "Supported a 123-person team.", "Employee ID 48392017"
    )
  }
};

function writePdf(target, text) {
  const pdf = new jsPDF({ unit: "pt", format: "letter", compress: false });
  pdf.setCreationDate(new Date("2026-08-11T00:00:00.000Z"));
  pdf.setFileId("C103C103C103C103C103C103C103C103");
  let y = 54;
  for (const line of text.split("\n")) {
    if (y > 750) { pdf.addPage(); y = 54; }
    pdf.text(line, 54, y); y += 24;
  }
  fs.writeFileSync(target, Buffer.from(pdf.output("arraybuffer")));
}

export async function generateResumeImportFieldFixtures(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const outputs = {};
  for (const [name, fixture] of Object.entries(RESUME_IMPORT_FIELD_FIXTURES)) {
    const fixtureFiles = fixture.files ?? [{ filename: `${name}.txt`, text: fixture.text }];
    outputs[name] = [];
    for (const source of fixtureFiles) {
      const target = path.join(outputDir, source.filename);
      fs.writeFileSync(target, source.text);
      outputs[name].push(target);
    }
  }
  const cleanText = RESUME_IMPORT_FIELD_FIXTURES.clean.text;
  const cleanPdf = path.join(outputDir, "clean.pdf");
  writePdf(cleanPdf, cleanText);
  const cleanDocx = path.join(outputDir, "clean.docx");
  const docx = new Document({ sections: [{ children: cleanText.split("\n").map((line) => new Paragraph(line)) }] });
  fs.writeFileSync(cleanDocx, await Packer.toBuffer(docx));
  outputs.clean.push(cleanPdf, cleanDocx);
  const manifest = path.join(outputDir, "expected-mapping-manifest.json");
  fs.writeFileSync(manifest, JSON.stringify(Object.fromEntries(Object.entries(RESUME_IMPORT_FIELD_FIXTURES).map(([name, fixture]) => [name, fixture.expected ?? {}])), null, 2));
  return { outputs, manifest };
}
