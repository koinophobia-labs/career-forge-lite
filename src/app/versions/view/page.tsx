"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { isPlaceholderEducation, normalizeHeaderName, resumeToText, roleHasContent } from "@/lib/resume-export";
import { useCommandCenter } from "@/lib/use-command-center";
import type { TemplateStyle } from "@/types/career";

const templateClasses: Record<TemplateStyle, string> = {
  Corporate: "border-t-[10px] border-t-ink",
  "Modern ATS": "border-t-[10px] border-t-gold",
  "Tech ATS": "border-t-[10px] border-t-cyan"
};

const templateOptions: TemplateStyle[] = ["Corporate", "Modern ATS", "Tech ATS"];

function VersionView() {
  const searchParams = useSearchParams();
  const versionId = searchParams.get("id") ?? "";
  const { state, hydrated } = useCommandCenter();
  const [templateOverride, setTemplateOverride] = useState<TemplateStyle | null>(null);
  const [copied, setCopied] = useState(false);

  const version = state.resumeVersions.find((item) => item.id === versionId) ?? null;
  const application = version
    ? (state.applications.find((app) => app.id === version.applicationId) ??
      state.applications.find((app) => app.resumeVersionId === version.id) ??
      null)
    : null;
  const snapshot = version?.resumeSnapshot ?? null;
  const template = templateOverride ?? snapshot?.template ?? "Modern ATS";

  async function copyText() {
    // Prefer serializing the stored snapshot: the full document (name header,
    // summary, skills, experience bullets, education) in the same order the
    // page renders — never just the summary sentence.
    const text = snapshot ? resumeToText(snapshot, snapshot.resume) : version?.resumeText;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the text is on screen for manual copy.
    }
  }

  return (
    <main>
      <CommandNav active="/versions" />

      <section className="mx-auto max-w-4xl px-5 pt-10 sm:px-8">
        {!hydrated ? (
          <p className="text-sm text-paper/60">Loading…</p>
        ) : !version ? (
          <div className="rounded-xl border border-coral/30 bg-coral/10 p-5 text-sm leading-6 text-paper/75">
            <p>This resume version doesn&apos;t exist — it may have been deleted.</p>
            <Link href="/versions" className="mt-3 inline-block font-bold text-cyan transition hover:text-gold">
              ← Back to all versions
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="trust-kicker text-sm font-bold uppercase">Saved version</p>
                <h1 className="mt-2 text-2xl font-bold text-paper sm:text-3xl">{version.label}</h1>
                <p className="lab-mono mt-1 text-[0.68rem] font-bold uppercase text-paper/45">
                  {version.source === "tailor" ? "Tailored" : "Plain"} ·{" "}
                  {new Date(version.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                  {application ? ` · ${application.roleTitle} @ ${application.company}` : ""}
                </p>
                {version.influenceSummary && (
                  <p className="mt-2 max-w-2xl text-[0.8rem] leading-5 text-paper/60">{version.influenceSummary}</p>
                )}
              </div>
              <Link href="/versions" className="text-sm font-bold text-cyan transition hover:text-gold">
                ← All versions
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {snapshot && (
                <>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-md bg-gold px-5 py-2.5 text-sm font-black text-ink transition hover:bg-cyan"
                  >
                    Print / Save as PDF
                  </button>
                  <label className="flex items-center gap-2 text-xs font-bold text-paper/60">
                    Template
                    <select
                      value={template}
                      onChange={(event) => setTemplateOverride(event.target.value as TemplateStyle)}
                      className="trust-input border px-3 py-2 text-sm text-ink"
                    >
                      {templateOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {(snapshot || version.resumeText) && (
                <button
                  type="button"
                  onClick={copyText}
                  className="rounded-md border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-paper/70 transition hover:border-cyan hover:text-cyan"
                >
                  {copied ? "Copied" : "Copy plain text"}
                </button>
              )}
            </div>

            {snapshot && (
              <p className="mt-3 text-xs leading-5 text-paper/50">
                This is the exact document you generated — nothing is regenerated on export. In the print dialog, choose
                “Save as PDF” for a submission-ready file. The template picker only changes the accent, never the content.
              </p>
            )}

            {!snapshot && (
              <div className="mt-5 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-6 text-paper/75">
                Styled preview isn&apos;t available for this version — it was generated before Career Forge stored
                document snapshots. {version.resumeText ? "Its plain text is below and printable." : "Only its metadata was saved."} New
                versions generated from the builder include the full styled document.
              </div>
            )}
          </>
        )}
      </section>

      {hydrated && version && (snapshot || version.resumeText) && (
        <section className="mx-auto max-w-4xl px-5 py-8 sm:px-8" id="resume">
          {snapshot ? (
            <div className={`resume-paper rounded-md border border-white/18 bg-white p-5 shadow-glow sm:p-8 ${templateClasses[template]}`}>
              <header>
                <h2 className="text-2xl font-black tracking-tight">{normalizeHeaderName(snapshot.fullName)}</h2>
                {[snapshot.email, snapshot.phone, snapshot.website].filter((item) => item.trim()).length > 0 && (
                  <p className="mt-1 text-sm text-ink/70">
                    {[snapshot.email, snapshot.phone, snapshot.website].filter((item) => item.trim()).join(" | ")}
                  </p>
                )}
              </header>

              {snapshot.resume.summary.trim() && (
                <div className="mt-5">
                  <h3 className="border-b border-ink/20 pb-1 text-xs font-black uppercase tracking-[0.14em]">Summary</h3>
                  <p className="mt-2 text-sm leading-6">{snapshot.resume.summary.trim()}</p>
                </div>
              )}

              {snapshot.resume.coreSkills.filter((skill) => skill.trim()).length > 0 && (
                <div className="mt-5">
                  <h3 className="border-b border-ink/20 pb-1 text-xs font-black uppercase tracking-[0.14em]">Core Skills</h3>
                  <p className="mt-2 text-sm leading-6">
                    {snapshot.resume.coreSkills.filter((skill) => skill.trim()).join(", ")}
                  </p>
                </div>
              )}

              {snapshot.resume.experience.filter(roleHasContent).length > 0 && (
                <div className="mt-5">
                  <h3 className="border-b border-ink/20 pb-1 text-xs font-black uppercase tracking-[0.14em]">Experience</h3>
                  {snapshot.resume.experience.filter(roleHasContent).map((role, index) => (
                    <div key={`${role.title}-${role.company}-${index}`} className="mt-3">
                      <p className="text-sm font-bold">
                        {[role.title, role.company, role.time].filter((item) => item.trim()).join(" | ")}
                      </p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-6">
                        {role.bullets
                          .filter((bullet) => bullet.trim())
                          .map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {snapshot.resume.education.trim() && !isPlaceholderEducation(snapshot.resume.education) && (
                <div className="mt-5">
                  <h3 className="border-b border-ink/20 pb-1 text-xs font-black uppercase tracking-[0.14em]">Education</h3>
                  <p className="mt-2 text-sm leading-6">{snapshot.resume.education.trim()}</p>
                </div>
              )}
            </div>
          ) : (
            <pre className="resume-paper whitespace-pre-wrap rounded-md border border-white/18 bg-white p-5 text-sm leading-6 sm:p-8">
              {version.resumeText}
            </pre>
          )}
        </section>
      )}

      <SiteFooter />
    </main>
  );
}

export default function VersionViewPage() {
  return (
    <Suspense fallback={null}>
      <VersionView />
    </Suspense>
  );
}
