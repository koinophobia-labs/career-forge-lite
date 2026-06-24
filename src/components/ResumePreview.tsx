"use client";

import { CopyButton } from "@/components/CopyButton";
import type { ExperienceRole, IntakeData, ResumePackage, TemplateStyle } from "@/types/career";

type ResumePreviewProps = {
  data: IntakeData;
  resume: ResumePackage;
  template: TemplateStyle;
  onChange: (resume: ResumePackage) => void;
};

const templateClasses: Record<TemplateStyle, string> = {
  Corporate: "border-t-[10px] border-t-ink",
  "Modern ATS": "border-t-[10px] border-t-gold",
  "Tech ATS": "border-t-[10px] border-t-cyan"
};

function updateRole(role: ExperienceRole, patch: Partial<ExperienceRole>) {
  return { ...role, ...patch };
}

function normalizeHeaderName(value: string) {
  return (
    value
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase()) || "Candidate Name"
  );
}

function roleHasContent(role: ExperienceRole) {
  return role.title.trim() || role.company.trim() || role.time.trim() || role.bullets.some((bullet) => bullet.trim());
}

function resumeToText(data: IntakeData, resume: ResumePackage) {
  const contact = [data.email, data.phone, data.website].filter(Boolean).join(" | ");
  const experience = resume.experience
    .filter(roleHasContent)
    .map(
      (role) =>
        `${role.title} | ${role.company} | ${role.time}\n${role.bullets
          .filter((bullet) => bullet.trim())
          .map((bullet) => `- ${bullet}`)
          .join("\n")}`
    )
    .join("\n\n");

  return `${normalizeHeaderName(data.fullName)}\n${contact}\n\nSUMMARY\n${resume.summary.trim()}\n\nCORE SKILLS\n${resume.coreSkills
    .filter((skill) => skill.trim())
    .join(", ")}\n\nEXPERIENCE\n${experience}\n\nEDUCATION\n${resume.education.trim()}`;
}

function experienceToText(resume: ResumePackage) {
  return resume.experience
    .filter(roleHasContent)
    .map(
      (role) =>
        `${role.title} | ${role.company} | ${role.time}\n${role.bullets
          .filter((bullet) => bullet.trim())
          .map((bullet) => `- ${bullet}`)
          .join("\n")}`
    )
    .join("\n\n");
}

export function ResumePreview({ data, resume, template, onChange }: ResumePreviewProps) {
  const printableSkills = resume.coreSkills.filter((skill) => skill.trim());

  function setExperience(index: number, role: ExperienceRole) {
    const next = resume.experience.map((item, itemIndex) => (itemIndex === index ? role : item));
    onChange({ ...resume, experience: next });
  }

  function setBullet(roleIndex: number, bulletIndex: number, value: string) {
    const role = resume.experience[roleIndex];
    const bullets = role.bullets.map((bullet, index) => (index === bulletIndex ? value : bullet));
    setExperience(roleIndex, updateRole(role, { bullets }));
  }

  return (
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8" id="resume">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="trust-kicker text-sm font-bold uppercase">resume://draft</p>
          <h2 className="mt-3 text-3xl font-bold text-paper">Review the package before it ships.</h2>
          <p className="mt-3 max-w-2xl text-paper/70">
            Edit the draft like a final pass. The resume content itself remains neutral, single-column, and ATS-safe.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <CopyButton getText={() => resumeToText(data, resume)} label="Copy Resume" />
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-cyan/30 bg-cyan/10 px-4 text-sm font-semibold text-cyan transition hover:border-cyan hover:bg-cyan hover:text-ink"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      <article
        className={`resume-paper rounded-md border border-white/18 bg-white p-5 shadow-glow sm:p-8 ${templateClasses[template]}`}
        id="print-resume"
      >
        <header className="border-b border-ink/18 pb-5">
          <input
            value={normalizeHeaderName(data.fullName)}
            readOnly
            className="w-full border-0 bg-transparent p-0 text-3xl font-bold uppercase tracking-0 text-ink outline-none"
          />
          <p className="mt-2 text-sm text-ink/70">
            {[data.email, data.phone, data.website].filter(Boolean).join(" | ") || "email | phone | portfolio"}
          </p>
        </header>

        <div className="mt-6 space-y-7">
          <section>
            <div className="mb-3 flex flex-col gap-3 border-b border-ink/16 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-bold uppercase text-ink">Summary</h2>
              <span className="screen-edit">
                <CopyButton getText={() => resume.summary} label="Copy Summary" />
              </span>
            </div>
            {resume.summary.trim() && <p className="print-only leading-6 text-ink">{resume.summary.trim()}</p>}
            <textarea
              value={resume.summary}
              onChange={(event) => onChange({ ...resume, summary: event.target.value })}
              rows={4}
              className="screen-edit w-full rounded-md border border-ink/12 bg-paper/60 p-3 leading-7 text-ink outline-none focus:border-gold focus:ring-4 focus:ring-gold/15"
            />
          </section>

          <section>
            <div className="mb-3 flex flex-col gap-3 border-b border-ink/16 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-bold uppercase text-ink">Core Skills</h2>
              <span className="screen-edit">
                <CopyButton getText={() => resume.coreSkills.join(", ")} label="Copy Skills" />
              </span>
            </div>
            {printableSkills.length > 0 && <p className="print-only leading-6 text-ink">{printableSkills.join(", ")}</p>}
            <textarea
              value={resume.coreSkills.join(", ")}
              onChange={(event) =>
                onChange({
                  ...resume,
                  coreSkills: event.target.value.split(",").map((item) => item.trim()).filter(Boolean)
                })
              }
              rows={3}
              className="screen-edit w-full rounded-md border border-ink/12 bg-paper/60 p-3 leading-7 text-ink outline-none focus:border-gold focus:ring-4 focus:ring-gold/15"
            />
          </section>

          <section>
            <div className="mb-3 flex flex-col gap-3 border-b border-ink/16 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-bold uppercase text-ink">Experience</h2>
              <span className="screen-edit">
                <CopyButton getText={() => experienceToText(resume)} label="Copy Experience" />
              </span>
            </div>
            <div className="space-y-6">
              {resume.experience.length === 0 && (
                <p className="rounded-md border border-ink/12 bg-paper/60 p-4 text-sm font-semibold text-ink/70">
                  Add at least a current role in the intake form to generate experience bullets.
                </p>
              )}
              {resume.experience.map((role, roleIndex) => {
                const hasPrintContent = Boolean(roleHasContent(role));
                return (
                  <div className={hasPrintContent ? "" : "resume-role-print-empty"} key={`${role.title}-${role.company}-${roleIndex}`}>
                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_12rem]">
                      {hasPrintContent && (
                        <p className="print-only font-bold text-ink">
                          {[role.title, role.company, role.time].filter((item) => item.trim()).join(" | ")}
                        </p>
                      )}
                      <input
                        value={role.title}
                        onChange={(event) => setExperience(roleIndex, updateRole(role, { title: event.target.value }))}
                        className="screen-edit rounded-md border border-ink/12 bg-paper/60 px-3 py-2 font-bold text-ink outline-none focus:border-gold focus:ring-4 focus:ring-gold/15"
                      />
                      <input
                        value={role.company}
                        onChange={(event) => setExperience(roleIndex, updateRole(role, { company: event.target.value }))}
                        className="screen-edit rounded-md border border-ink/12 bg-paper/60 px-3 py-2 text-ink outline-none focus:border-gold focus:ring-4 focus:ring-gold/15"
                      />
                      <input
                        value={role.time}
                        onChange={(event) => setExperience(roleIndex, updateRole(role, { time: event.target.value }))}
                        className="screen-edit rounded-md border border-ink/12 bg-paper/60 px-3 py-2 text-ink outline-none focus:border-gold focus:ring-4 focus:ring-gold/15"
                      />
                    </div>
                    <ul className="print-only mt-2 list-disc space-y-1 pl-5 text-ink">
                      {role.bullets.filter((bullet) => bullet.trim()).map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                    <div className="screen-edit mt-3 space-y-2">
                      {role.bullets.map((bullet, bulletIndex) => (
                        <div key={bulletIndex} className="grid grid-cols-[1rem_1fr] gap-2">
                          <span className="pt-3 text-ink">-</span>
                          <textarea
                            value={bullet}
                            onChange={(event) => setBullet(roleIndex, bulletIndex, event.target.value)}
                            rows={2}
                            className="w-full rounded-md border border-ink/12 bg-paper/60 p-3 leading-6 text-ink outline-none focus:border-gold focus:ring-4 focus:ring-gold/15"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-col gap-3 border-b border-ink/16 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-bold uppercase text-ink">Education</h2>
              <span className="screen-edit">
                <CopyButton getText={() => resume.education} label="Copy Education" />
              </span>
            </div>
            {resume.education.trim() && <p className="print-only text-ink">{resume.education.trim()}</p>}
            <input
              value={resume.education}
              onChange={(event) => onChange({ ...resume, education: event.target.value })}
              className="screen-edit w-full rounded-md border border-ink/12 bg-paper/60 px-3 py-2 text-ink outline-none focus:border-gold focus:ring-4 focus:ring-gold/15"
            />
          </section>
        </div>
      </article>
    </section>
  );
}
