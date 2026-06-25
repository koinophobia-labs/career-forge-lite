"use client";

import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { experienceToText, isPlaceholderEducation, normalizeHeaderName, resumeToText, roleHasContent } from "@/lib/resume-export";
import { analyzeResumeQuality } from "@/lib/resume-intelligence";
import type { ExperienceRole, IntakeData, ResumePackage, TemplateStyle } from "@/types/career";

type ResumeViewMode = "ats" | "visual";
type VisualResumeStyle = "Executive Dark" | "Clean Modern" | "Product Lab";

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

const visualStyleClasses: Record<VisualResumeStyle, { shell: string; accent: string; badge: string; sidebar: string }> = {
  "Executive Dark": {
    shell: "bg-[#101318] text-paper",
    accent: "text-gold",
    badge: "border-gold/35 bg-gold/10 text-gold",
    sidebar: "border-white/10 bg-white/5"
  },
  "Clean Modern": {
    shell: "bg-white text-ink",
    accent: "text-[#0f6c7d]",
    badge: "border-[#0f6c7d]/25 bg-[#0f6c7d]/10 text-[#0f6c7d]",
    sidebar: "border-ink/10 bg-[#f4f7f8]"
  },
  "Product Lab": {
    shell: "bg-[#071014] text-paper",
    accent: "text-cyan",
    badge: "border-cyan/35 bg-cyan/10 text-cyan",
    sidebar: "border-cyan/20 bg-cyan/5"
  }
};

function updateRole(role: ExperienceRole, patch: Partial<ExperienceRole>) {
  return { ...role, ...patch };
}

export function ResumePreview({ data, resume, template, onChange }: ResumePreviewProps) {
  const [viewMode, setViewMode] = useState<ResumeViewMode>("ats");
  const [visualStyle, setVisualStyle] = useState<VisualResumeStyle>("Product Lab");
  const printableSkills = resume.coreSkills.filter((skill) => skill.trim());
  const quality = analyzeResumeQuality(data, resume);
  const contactItems = [data.email, data.phone, data.website].filter(Boolean);
  const visual = visualStyleClasses[visualStyle];
  const visualStrengths = printableSkills.slice(0, 6);
  const visualTools = printableSkills.slice(6, 14);
  const visualHighlights = resume.experience
    .flatMap((role) => role.bullets.filter((bullet) => bullet.trim()).map((bullet) => ({ role, bullet })))
    .slice(0, 5);

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
      <div className="resume-preview-chrome mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="trust-kicker text-sm font-bold uppercase">resume://draft</p>
          <h2 className="mt-3 text-3xl font-bold text-paper">Review your resume before you apply.</h2>
          <p className="mt-3 max-w-2xl text-paper/70">
            Check the language, confirm every detail is true, and add missing numbers if you have them.
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

      <div className="resume-preview-chrome mb-6 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <article className="trust-card rounded-md p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan">Resume Quality</p>
          <h3 className="mt-2 text-3xl font-bold text-paper">{quality.rating}</h3>
          <p className="mt-3 text-sm leading-6 text-paper/68">
            This is a writing-quality signal, not an ATS score. It checks clarity, specificity, formatting consistency, and missing proof.
          </p>
        </article>
        <article className="trust-card rounded-md p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold text-paper">Strongest sections</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {quality.strongestSections.map((item) => (
                  <span key={item} className="rounded-full border border-cyan/25 bg-cyan/10 px-3 py-2 text-sm font-semibold text-cyan">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-paper">Suggested improvements</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-paper/68">
                {quality.suggestedImprovements.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </div>

      <div className="resume-preview-chrome mb-6 grid gap-4 rounded-md border border-white/10 bg-white/5 p-4 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-gold">Export view</p>
          <h3 className="mt-2 text-xl font-bold text-paper">{viewMode === "ats" ? "ATS Resume" : "Visual Portfolio Resume"}</h3>
          <p className="mt-2 text-sm leading-6 text-paper/68">
            {viewMode === "ats"
              ? "Use ATS Resume for job applications. It stays single-column, scanner-safe, and compact."
              : "Use Visual Resume for networking, portfolios, and personal presentation. Use the ATS Resume when applying through job portals."}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:items-center">
          {(["ats", "visual"] as ResumeViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`min-h-11 rounded-md border px-4 text-sm font-bold transition ${
                viewMode === mode
                  ? "border-gold bg-gold text-ink"
                  : "border-white/12 bg-obsidian/45 text-paper/70 hover:border-cyan hover:text-cyan"
              }`}
            >
              {mode === "ats" ? "ATS Resume" : "Visual Portfolio Resume"}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "visual" && (
        <div className="resume-preview-chrome mb-6 flex flex-wrap gap-3">
          {(["Executive Dark", "Clean Modern", "Product Lab"] as VisualResumeStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setVisualStyle(style)}
              className={`min-h-10 rounded-md border px-4 text-sm font-bold transition ${
                visualStyle === style
                  ? "border-cyan bg-cyan text-ink"
                  : "border-white/12 bg-white/5 text-paper/70 hover:border-cyan hover:text-cyan"
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      )}

      {viewMode === "ats" ? (
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
            <p className="mt-2 text-sm text-ink/70">{contactItems.join(" | ") || "email | phone | portfolio"}</p>
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
              {resume.education.trim() && !isPlaceholderEducation(resume.education) && (
                <p className="print-only text-ink">{resume.education.trim()}</p>
              )}
              <input
                value={resume.education}
                onChange={(event) => onChange({ ...resume, education: event.target.value })}
                className="screen-edit w-full rounded-md border border-ink/12 bg-paper/60 px-3 py-2 text-ink outline-none focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
            </section>
          </div>
        </article>
      ) : (
        <article
          className={`visual-resume-paper overflow-hidden rounded-md border border-white/18 shadow-glow ${visual.shell}`}
          id="print-visual-resume"
        >
          <div className="grid gap-0 lg:grid-cols-[18rem_1fr]">
            <aside className={`p-6 sm:p-8 ${visual.sidebar}`}>
              <p className={`text-xs font-black uppercase tracking-[0.18em] ${visual.accent}`}>Visual Portfolio Resume</p>
              <h2 className="mt-4 text-3xl font-black uppercase leading-tight tracking-0">{normalizeHeaderName(data.fullName)}</h2>
              <div className="mt-5 space-y-2 text-sm leading-6 opacity-80">
                {contactItems.length ? contactItems.map((item) => <p key={item}>{item}</p>) : <p>email | phone | portfolio</p>}
              </div>
              {data.website.trim() && (
                <div className={`mt-6 rounded-md border p-3 text-sm font-bold ${visual.badge}`}>
                  Portfolio: {data.website.trim()}
                </div>
              )}
              <div className="mt-8">
                <h3 className={`text-xs font-black uppercase tracking-[0.14em] ${visual.accent}`}>Key Strengths</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visualStrengths.map((skill) => (
                    <span key={skill} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${visual.badge}`}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              {visualTools.length > 0 && (
                <div className="mt-8">
                  <h3 className={`text-xs font-black uppercase tracking-[0.14em] ${visual.accent}`}>Tools & Skills</h3>
                  <p className="mt-3 text-sm leading-6 opacity-80">{visualTools.join(", ")}</p>
                </div>
              )}
            </aside>
            <div className="p-6 sm:p-8">
              <div className={`inline-flex rounded-md border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] ${visual.badge}`}>
                {visualStyle}
              </div>
              <h3 className="mt-5 text-2xl font-black leading-tight sm:text-4xl">{resume.linkedinHeadline}</h3>
              {resume.summary.trim() && <p className="mt-5 max-w-3xl text-base leading-7 opacity-80">{resume.summary.trim()}</p>}

              <section className="mt-8">
                <h3 className={`text-sm font-black uppercase tracking-[0.14em] ${visual.accent}`}>Experience Highlights</h3>
                <div className="mt-4 grid gap-3">
                  {visualHighlights.map(({ role, bullet }) => (
                    <div key={`${role.title}-${bullet}`} className="rounded-md border border-current/12 p-4">
                      <p className="text-sm font-black">{[role.title, role.company].filter(Boolean).join(" | ")}</p>
                      <p className="mt-2 text-sm leading-6 opacity-80">{bullet}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <h3 className={`text-sm font-black uppercase tracking-[0.14em] ${visual.accent}`}>LinkedIn Positioning</h3>
                <p className="mt-3 rounded-md border border-current/12 p-4 text-sm leading-6 opacity-80">{resume.linkedinSummary}</p>
              </section>
            </div>
          </div>
        </article>
      )}

      <div className="resume-preview-chrome mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="trust-card rounded-md p-5">
          <h3 className="text-xl font-bold text-paper">Can I submit this?</h3>
          <p className="mt-3 text-sm leading-6 text-paper/70">
            Use the ATS Resume for applications. Use the Visual Portfolio Resume when you want a polished presentation for networking,
            portfolio pages, or personal brand conversations.
          </p>
        </article>
        <article className="trust-card rounded-md p-5">
          <h3 className="text-xl font-bold text-paper">Before you apply</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {["Tailor for each job", "Add missing metrics if possible", "Review every line for accuracy", "Save a clean copy"].map((item) => (
              <span key={item} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-paper/72">
                {item}
              </span>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
