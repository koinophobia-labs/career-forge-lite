"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ATSValidationPanel } from "@/components/ATSValidationPanel";
import { LinkedInPreview } from "@/components/LinkedInPreview";
import { ResumePreview } from "@/components/ResumePreview";
import { initialIntake } from "@/lib/career-data";
import { trackCareerEvent, trackCareerForgeCompletion, trackCareerForgeStart, trackResumeGeneration } from "@/lib/analytics";
import { generateResumePackage } from "@/lib/generator";
import { hasEnoughResumeSignal } from "@/lib/interview-state";
import { parseStoryToDossier, type StoryDossier } from "@/lib/story-mode";
import { mergeIntakeIntoDossier, withUpdatedDossier } from "@/lib/dossier";
import { useCommandCenter } from "@/lib/use-command-center";
import type { IntakeData, ResumePackage } from "@/types/career";

type StoryModeState = "story" | "dossier" | "edit" | "review";

const sampleStories = [
  {
    title: "DoorDash to warehouse/logistics",
    story:
      "My name is Dana Smith and my email is dana@example.com. I worked as a DoorDash driver from 2021 to now. I checked order names, planned routes, used the delivery app, messaged customers about delays, handled time-sensitive deliveries, and made sure orders went to the right person. I want warehouse, stock, or logistics support work."
  },
  {
    title: "Retail to inventory/operations",
    story:
      "My name is Mia Carter and my email is mia@example.com. I was a cashier at Target from 2022 to 2024. I helped customers, handled returns, used the POS system, stocked shelves, checked inventory, kept the register area clean, and helped the team during busy shifts. I am trying to move into inventory or operations work."
  },
  {
    title: "Founder/project builder",
    story:
      "My name is Jordan Lee and my email is jordan@example.com. I built a few small websites and apps for local projects from 2023 to now. I planned features, wrote copy, built pages, tested forms, fixed bugs, used AI tools to speed up research and drafts, and shipped projects people could actually use. I want to explain this as product or operations experience."
  }
];

const sampleStory = sampleStories[0].story;

function DossierRow({ label, value }: { label: string; value: string | string[] }) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-paper/45">{label}</p>
      {values.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((item) => (
            <span key={item} className="rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1.5 text-sm font-semibold text-cyan">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-paper/48">Not found yet.</p>
      )}
    </div>
  );
}

export function TellMyStoryMode() {
  const { state, update } = useCommandCenter();
  const [story, setStory] = useState("");
  const [context, setContext] = useState("");
  const [mode, setMode] = useState<StoryModeState>("story");
  const [intake, setIntake] = useState<IntakeData>(initialIntake);
  const [dossier, setDossier] = useState<StoryDossier | null>(null);
  const [resume, setResume] = useState<ResumePackage>(() => generateResumePackage(initialIntake));
  const [approvedForDossier, setApprovedForDossier] = useState(false);

  const combinedStory = useMemo(() => [story, context].filter(Boolean).join(" "), [story, context]);
  const canGenerate = dossier ? hasEnoughResumeSignal(intake) && !dossier.needsRolePriority : false;
  const shouldShowFocusedFollowUp = dossier
    ? dossier.stillHelpfulFields.length > 0 && (!canGenerate || !dossier.focusedFollowUp.includes("enough signal"))
    : false;
  const contextPrompt =
    shouldShowFocusedFollowUp && dossier
      ? dossier.focusedFollowUp
      : "Optional: add one missing detail, example, tool, number, or outcome before generating.";

  useEffect(() => {
    trackCareerForgeStart("story");
  }, []);

  function parseStory(nextStory = combinedStory) {
    const nextDossier = parseStoryToDossier(nextStory, intake);
    setDossier(nextDossier);
    setIntake(nextDossier.intake);
    setMode("dossier");
    setApprovedForDossier(false);
  }

  function handleStorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!story.trim()) return;
    parseStory(story);
  }

  function handleAddContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context.trim()) return;
    const nextStory = combinedStory;
    setStory(nextStory);
    parseStory(nextStory);
    setContext("");
  }

  function handleGenerate() {
    if (!approvedForDossier) return;
    const nextResume = generateResumePackage(intake);
    setResume(nextResume);
    trackResumeGeneration("story");
    trackCareerForgeCompletion("story");
    setMode("review");
    window.setTimeout(() => document.getElementById("resume")?.scrollIntoView(), 0);
  }

  function approveAndSave() {
    const next = mergeIntakeIntoDossier(state.dossier, intake, "story", true, combinedStory || story);
    update((current) => withUpdatedDossier(current, next));
    trackCareerEvent("dossier_evidence_added");
    setApprovedForDossier(true);
  }

  function updateField<K extends keyof IntakeData>(key: K, value: IntakeData[K]) {
    setIntake((current) => ({ ...current, [key]: value }));
  }

  if (mode === "review") {
    return (
      <main className="min-h-screen px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
            <Link href="/" className="inline-flex items-center gap-3" aria-label="Back to Career Forge Lite">
              <span className="logo-mark" aria-hidden="true">
                CF
              </span>
              <span>
                <span className="block text-xs font-black uppercase tracking-[0.18em] text-gold">Career Forge Lite</span>
                <span className="block text-[0.68rem] font-bold uppercase tracking-[0.22em] text-paper/56">Tell My Story</span>
              </span>
            </Link>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode("dossier")}
                className="rounded-md border border-cyan/25 bg-cyan/10 px-4 py-2 text-sm font-bold text-cyan transition hover:border-gold hover:text-gold"
              >
                Back to dossier
              </button>
              <button
                type="button"
                onClick={() => setMode("story")}
                className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-paper/70 transition hover:border-cyan hover:text-cyan"
              >
                Start over
              </button>
            </div>
          </div>

          <section className="trust-panel rounded-md p-5 sm:p-7">
            <p className="trust-kicker text-xs font-black uppercase">Story converted</p>
            <h1 className="mt-3 text-3xl font-bold text-paper sm:text-5xl">Your story-built resume package</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-paper/70">
              Career Forge used the extracted dossier below to generate the same ATS-safe resume, LinkedIn headline,
              and review package as the guided builder.
            </p>
          </section>

          <ResumePreview data={intake} resume={resume} template="Modern ATS" onChange={setResume} />
          <ATSValidationPanel data={intake} resume={resume} />
          <LinkedInPreview resume={resume} onChange={setResume} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="Back to Career Forge Lite">
            <span className="logo-mark" aria-hidden="true">
              CF
            </span>
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.18em] text-gold">Koinophobia Labs</span>
              <span className="block text-[0.68rem] font-bold uppercase tracking-[0.22em] text-paper/56">
                Product Lab Module 05
              </span>
            </span>
          </Link>
          <Link
            href="/resume-builder#demo"
            className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-paper/70 transition hover:border-cyan hover:text-cyan"
          >
            Use Guided Builder
          </Link>
        </header>

        <section className="trust-panel rounded-md p-5 sm:p-7">
          <p className="trust-kicker text-xs font-black uppercase">Tell My Story</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <h1 className="text-3xl font-bold text-paper sm:text-5xl">Tell Career Forge about your work history.</h1>
              <p className="mt-4 text-base leading-7 text-paper/70">
                Write naturally. Career Forge will look for roles, companies, dates, responsibilities, tools, scope,
                and transferable signals, then show you what it understood.
              </p>
            </div>

            <form onSubmit={handleStorySubmit} className="rounded-md border border-white/10 bg-white/5 p-4">
              <label htmlFor="story" className="text-sm font-bold text-paper">
                Describe the work in plain language
              </label>
              <p className="mt-2 rounded-md border border-cyan/20 bg-cyan/10 px-3 py-2 text-xs font-semibold leading-5 text-cyan">
                Do not paste sensitive personal information. Career Forge is a drafting tool, not a final application review.
              </p>
              <div className="mt-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-paper/50">Load a sample story</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {sampleStories.map((sample) => (
                    <button
                      key={sample.title}
                      type="button"
                      onClick={() => setStory(sample.story)}
                      aria-label={`Load sample story: ${sample.title}`}
                      className="min-h-11 rounded-md border border-white/10 bg-obsidian/45 px-3 py-2 text-left text-xs font-bold leading-5 text-paper/72 transition hover:border-cyan hover:text-cyan"
                    >
                      {sample.title}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                id="story"
                value={story}
                onChange={(event) => setStory(event.target.value)}
                placeholder={sampleStory}
                className="mt-3 min-h-48 w-full rounded-md border border-white/10 bg-obsidian/70 p-4 text-sm leading-6 text-paper outline-none transition placeholder:text-paper/32 focus:border-cyan/70"
              />
              <p className="mt-3 text-xs leading-5 text-paper/55">
                Example: {sampleStory}
              </p>
              <button
                type="submit"
                className="mt-4 min-h-11 rounded-md bg-gold px-5 text-sm font-black text-ink transition hover:bg-cyan disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!story.trim()}
              >
                Extract dossier
              </button>
            </form>
          </div>
        </section>

        {dossier && mode !== "story" && (
          <section className="mt-6 trust-panel rounded-md p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="trust-kicker text-xs font-black uppercase">I read this as...</p>
                <h2 className="mt-3 text-2xl font-bold text-paper">
                  {dossier.extracted.role || "Role not found yet"}
                  {dossier.extracted.company ? ` at ${dossier.extracted.company}` : ""}
                  {dossier.extracted.dates ? `, ${dossier.extracted.dates}` : ""}
                </h2>
              </div>
              <span
                className={`rounded-md border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                  dossier.confidence === "strong"
                    ? "border-cyan/30 bg-cyan/10 text-cyan"
                    : dossier.confidence === "usable"
                      ? "border-gold/30 bg-gold/10 text-gold"
                      : "border-ember/30 bg-ember/10 text-ember"
                }`}
              >
                {dossier.confidence === "needs_follow_up" ? "Needs one signal" : dossier.confidence}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-cyan/20 bg-cyan/10 p-4">
                <p className="text-sm font-bold text-cyan">Captured</p>
                <div className="mt-3 space-y-2">
                  {dossier.capturedFields.length ? (
                    dossier.capturedFields.map((field) => (
                      <p key={field} className="text-sm font-semibold text-paper/75">
                        ✓ {field}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-paper/55">Nothing solid yet. Add one more sentence about your role.</p>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-gold/20 bg-gold/10 p-4">
                <p className="text-sm font-bold text-gold">Still helpful</p>
                <div className="mt-3 space-y-2">
                  {dossier.stillHelpfulFields.length ? (
                    dossier.stillHelpfulFields.slice(0, 6).map((field) => (
                      <p key={field} className="text-sm font-semibold text-paper/75">
                        • {field}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-paper/65">You gave Career Forge enough signal for a strong first draft.</p>
                  )}
                </div>
              </div>
              <DossierRow label="Target role" value={dossier.extracted.targetRole} />
              <DossierRow label="Role family" value={dossier.extracted.roleFamily} />
              <DossierRow label="Responsibilities" value={dossier.extracted.responsibilities} />
              <DossierRow label="Tools" value={dossier.extracted.tools} />
              <DossierRow label="AI workflows" value={dossier.extracted.aiWorkflows} />
              <DossierRow label="Scope" value={dossier.extracted.scope} />
              <DossierRow label="Transferable signals" value={dossier.extracted.transferableSignals} />
              <DossierRow label="Education" value={dossier.extracted.education} />
            </div>

            <div className="mt-5 rounded-md border border-white/12 bg-obsidian/50 p-4">
              <p className="lab-mono text-[0.68rem] font-bold uppercase text-gold">Source and assumption review</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-paper/68">{combinedStory || story}</p>
              <p className="mt-3 text-xs leading-5 text-paper/50">
                Possible unsupported assumptions: inferred role family, generalized skill labels, and any relationship between a responsibility and an outcome that you did not state directly. Edit those fields before approval. No extracted fact is saved until you approve it.
              </p>
            </div>

            {dossier.needsRolePriority && (
              <div className="mt-5 rounded-md border border-gold/30 bg-gold/10 p-4">
                <p className="text-sm font-bold text-gold">Multiple roles detected</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {dossier.detectedRoles.map((role) => (
                    <span key={role} className="rounded-full border border-gold/25 bg-obsidian/55 px-3 py-1.5 text-sm font-semibold text-paper/80">
                      {role}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-6 text-paper/70">
                  Add one sentence telling Career Forge which role or target job should lead this resume.
                </p>
              </div>
            )}

            {shouldShowFocusedFollowUp && (
              <div className="mt-5 rounded-md border border-ember/25 bg-ember/10 p-4">
                <p className="text-sm font-bold text-ember">
                  Focused follow-up{dossier.nextMissingField ? `: ${dossier.nextMissingField}` : ""}
                </p>
                <p className="mt-2 text-sm leading-6 text-paper/70">{dossier.focusedFollowUp}</p>
              </div>
            )}

            {canGenerate && (
              <div className="mt-5 rounded-md border border-cyan/25 bg-cyan/10 p-4">
                <p className="text-sm font-bold text-cyan">You gave Career Forge enough signal to build your first resume package.</p>
                <p className="mt-2 text-sm leading-6 text-paper/70">
                  Generate now, or use Edit details to add contact info, dates, or sharper proof before creating the draft.
                </p>
              </div>
            )}

            {mode === "edit" && (
              <div className="mt-5 grid gap-3 rounded-md border border-white/10 bg-white/5 p-4 md:grid-cols-3">
                {[
                  ["fullName", "Name"],
                  ["email", "Email"],
                  ["targetJobTitle", "Target role"],
                  ["currentTitle", "Role title"],
                  ["currentCompany", "Company"],
                  ["currentTime", "Dates"],
                  ["tools", "Tools"],
                  ["responsibilities", "Responsibilities"],
                  ["education", "Education"]
                ].map(([key, label]) => (
                  <label key={key} className="text-xs font-bold uppercase tracking-[0.12em] text-paper/50">
                    {label}
                    <input
                      value={String(intake[key as keyof IntakeData] ?? "")}
                      onChange={(event) => updateField(key as keyof IntakeData, event.target.value as IntakeData[keyof IntakeData])}
                      className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-obsidian/70 px-3 text-sm normal-case tracking-normal text-paper outline-none focus:border-cyan/70"
                    />
                  </label>
                ))}
              </div>
            )}

            <form onSubmit={handleAddContext} className="mt-5 rounded-md border border-white/10 bg-white/5 p-4">
              <label htmlFor="context" className="text-sm font-bold text-paper">
                {contextPrompt}
              </label>
              <textarea
                id="context"
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="Example: I supported 50+ customers per shift and used Excel, Slack, and internal payment systems."
                className="mt-3 min-h-24 w-full rounded-md border border-white/10 bg-obsidian/70 p-3 text-sm leading-6 text-paper outline-none placeholder:text-paper/32 focus:border-cyan/70"
              />
              <button
                type="submit"
                className="mt-3 rounded-md border border-cyan/25 bg-cyan/10 px-4 py-2 text-sm font-bold text-cyan transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-45"
                disabled={!context.trim()}
              >
                Add more context
              </button>
            </form>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={approveAndSave}
                className={`min-h-11 rounded-md px-5 text-sm font-black transition ${approvedForDossier ? "border border-mint/40 bg-mint/10 text-mint" : "bg-mint text-ink hover:bg-cyan"}`}
              >
                {approvedForDossier ? "Approved and saved to dossier" : "Approve facts and save to dossier"}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate || !approvedForDossier}
                className="min-h-11 rounded-md bg-gold px-5 text-sm font-black text-ink transition hover:bg-cyan disabled:cursor-not-allowed disabled:opacity-45"
              >
                Continue to résumé draft
              </button>
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="min-h-11 rounded-md border border-white/15 bg-white/5 px-5 text-sm font-bold text-paper/70 transition hover:border-cyan hover:text-cyan"
              >
                Edit details
              </button>
              <button
                type="button"
                onClick={() => setMode("story")}
                className="min-h-11 rounded-md border border-ember/25 bg-ember/10 px-5 text-sm font-bold text-ember transition hover:border-ember"
              >
                Start over
              </button>
            </div>
            {!canGenerate && (
              <p className="mt-3 text-sm leading-6 text-paper/55">
                Add the focused detail above before generating so the resume does not come out generic. You will not need to restart.
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
