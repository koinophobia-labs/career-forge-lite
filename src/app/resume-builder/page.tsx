"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ATSValidationPanel } from "@/components/ATSValidationPanel";
import { IntakeForm } from "@/components/IntakeForm";
import { LandingPage } from "@/components/LandingPage";
import { LinkedInPreview } from "@/components/LinkedInPreview";
import { ResumePreview } from "@/components/ResumePreview";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { initialIntake } from "@/lib/career-data";
import { trackCareerForgeCompletion, trackCareerForgeStart, trackCtaClick, trackResumeGeneration } from "@/lib/analytics";
import { createId, loadState } from "@/lib/command-center-store";
import { resumeToText } from "@/lib/resume-export";
import { consumeHandoff, recordTailoredResumeVersion, type TailorHandoff } from "@/lib/tailor-handoff";
import { applyTailoredContext, contextFromHandoff, type TailoredInfluence } from "@/lib/tailored-resume";
import { updateCommandCenter } from "@/lib/use-command-center";
import { generateResumePackage } from "@/lib/generator";
import { intakeFromDossier, mergeIntakeIntoDossier, withUpdatedDossier } from "@/lib/dossier";
import type { IntakeData, IntakeErrors, ResumePackage, TemplateStyle } from "@/types/career";
import type { ResumeSnapshot } from "@/types/command-center";

type Step = "landing" | "mode" | "intake" | "preview";

// Log each generated resume as a version in the command center so the
// dashboard's "resume versions" count reflects real work. Tailored sessions
// carry their analysis metadata and link back to the source application.
function buildSnapshot(intake: IntakeData, resumePackage: ResumePackage, template: TemplateStyle): ResumeSnapshot {
  // Verbatim copy of exactly what the user generated — the export view
  // renders this without regeneration.
  return {
    fullName: intake.fullName,
    email: intake.email,
    phone: intake.phone,
    website: intake.website,
    template,
    resume: {
      summary: resumePackage.summary,
      coreSkills: [...resumePackage.coreSkills],
      experience: resumePackage.experience.map((role) => ({ ...role, bullets: [...role.bullets] })),
      education: resumePackage.education,
      linkedinHeadline: resumePackage.linkedinHeadline,
      linkedinSummary: resumePackage.linkedinSummary
    }
  };
}

function recordResumeVersion(
  targetJobTitle: string,
  tailorSession: TailorHandoff | null,
  influenceSummary: string,
  resumeText: string,
  snapshot: ResumeSnapshot
) {
  const nowIso = new Date().toISOString();

  if (tailorSession) {
    updateCommandCenter((state) =>
      recordTailoredResumeVersion(state, tailorSession, nowIso, influenceSummary, resumeText, snapshot)
    );
    return;
  }

  const label = targetJobTitle.trim() || "General resume";
  updateCommandCenter((state) => {
    const matchingLane = state.lanes.find((lane) => lane.title.toLowerCase() === label.toLowerCase()) ?? null;
    return {
      ...state,
      resumeVersions: [
        ...state.resumeVersions,
        {
          id: createId("resume"),
          label: `${label} — ${nowIso.slice(0, 10)}`,
          laneId: matchingLane ? matchingLane.id : null,
          notes: "Generated with the guided resume builder.",
          source: "builder" as const,
          applicationId: null,
          targetCompany: "",
          targetTitle: label,
          keywordsUsed: [],
          gapsAcknowledged: [],
          influenceSummary: "",
          resumeText,
          resumeSnapshot: snapshot,
          createdAt: nowIso
        }
      ]
    };
  });
}

const workflowSteps: Array<{ label: string; step: Step }> = [
  { label: "Choose Path", step: "mode" },
  { label: "Build Resume", step: "intake" },
  { label: "Review Resume", step: "preview" }
];

export default function Home() {
  const [step, setStep] = useState<Step>("landing");
  const [intake, setIntake] = useState<IntakeData>(initialIntake);
  const [errors, setErrors] = useState<IntakeErrors>({});
  const [template, setTemplate] = useState<TemplateStyle>("Modern ATS");
  const [resume, setResume] = useState<ResumePackage>(() => generateResumePackage(initialIntake));
  const hasTrackedGuidedStart = useRef(false);
  const hasTrackedGuidedCompletion = useRef(false);
  const [tailorSession, setTailorSession] = useState<TailorHandoff | null>(null);
  const [influence, setInfluence] = useState<TailoredInfluence | null>(null);

  // Pick up a tailoring session from /tailor, if one was started recently.
  // consumeHandoff removes the blob and returns null for stale or malformed
  // data, so a normal visit to the builder is unaffected. This must run in an
  // effect (not an initializer): the handoff lives in localStorage, which is
  // unavailable during prerender, and consuming it mutates external state.
  useEffect(() => {
    const stored = loadState();
    const handoff = consumeHandoff(new Date().toISOString());
    const dossierIntake = intakeFromDossier(stored.dossier, handoff?.roleTitle ?? "");
    if (stored.dossier.evidence.length || stored.dossier.roles.length || stored.dossier.projects.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from the canonical local dossier
      setIntake(dossierIntake);
    }
    if (!handoff) return;
    setTailorSession(handoff);
    setIntake((current) => ({ ...current, ...dossierIntake, targetJobTitle: handoff.roleTitle }));
    setStep("intake");
    if (!hasTrackedGuidedStart.current) {
      trackCareerForgeStart("guided");
      hasTrackedGuidedStart.current = true;
    }
    window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
  }, []);

  const workflowStep = useMemo(() => {
    const order: Step[] = ["mode", "intake", "preview"];
    return order.indexOf(step) + 1;
  }, [step]);

  function validateIntake(keys: Array<keyof IntakeData> = ["targetJobTitle", "currentTitle"]) {
    const nextErrors: IntakeErrors = {};

    if (keys.includes("fullName") && !intake.fullName.trim()) nextErrors.fullName = "Name is required.";
    if (keys.includes("email") && !intake.email.trim()) nextErrors.email = "Email is required.";
    if (keys.includes("targetJobTitle") && !intake.targetJobTitle.trim()) {
      nextErrors.targetJobTitle = "Target role is required.";
    }
    if (keys.includes("currentTitle") && !intake.currentTitle.trim()) {
      nextErrors.currentTitle = "Current or most recent role is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function updateIntake(nextIntake: IntakeData) {
    setIntake(nextIntake);
    if (Object.keys(errors).length) {
      setErrors({});
    }
  }

  function jump(nextStep: Step) {
    if (nextStep === "preview" && !validateIntake()) {
      setStep("intake");
      window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
      return;
    }

    if (nextStep === "intake" && !hasTrackedGuidedStart.current) {
      trackCareerForgeStart("guided");
      hasTrackedGuidedStart.current = true;
    }

    setStep(nextStep);
    window.setTimeout(() => document.getElementById(nextStep)?.scrollIntoView(), 0);
  }

  function generate() {
    if (!validateIntake()) {
      setStep("intake");
      window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
      return;
    }

    const nowIso = new Date().toISOString();
    updateCommandCenter((current) => withUpdatedDossier(
      current,
      mergeIntakeIntoDossier(current.dossier, intake, "guided", true, "Guided Career Dossier setup", nowIso)
    ));
    const basePackage = generateResumePackage(intake);
    if (tailorSession) {
      // The user's career profile counts as evidence too — it's their own
      // claimed history, written on /profile.
      const profile = loadState().profile;
      const extraEvidence = [
        profile.transferableSkills.join(" "),
        profile.experienceSummary,
        profile.proofPoints,
        profile.strengths.join(" ")
      ].join(" ");
      const tailored = applyTailoredContext(basePackage, contextFromHandoff(tailorSession), intake, extraEvidence);
      setResume(tailored.resume);
      setInfluence(tailored.influence);
      recordResumeVersion(
        intake.targetJobTitle,
        tailorSession,
        tailored.influence.summaryText,
        resumeToText(intake, tailored.resume),
        buildSnapshot(intake, tailored.resume, template)
      );
    } else {
      setResume(basePackage);
      setInfluence(null);
      recordResumeVersion(intake.targetJobTitle, null, "", resumeToText(intake, basePackage), buildSnapshot(intake, basePackage, template));
    }
    trackResumeGeneration("guided");
    if (!hasTrackedGuidedCompletion.current) {
      trackCareerForgeCompletion("guided");
      hasTrackedGuidedCompletion.current = true;
    }
    setStep("preview");
    window.setTimeout(() => document.getElementById("resume")?.scrollIntoView(), 0);
  }

  return (
    <main>
      <SiteHeader onStart={() => jump("mode")} />

      {tailorSession && (
        <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8">
          <div className="rounded-xl border border-cyan/30 bg-cyan/10 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="trust-kicker text-xs font-bold uppercase">Tailored resume session</p>
                <h2 className="mt-2 text-xl font-bold text-paper">
                  {tailorSession.roleTitle}
                  {tailorSession.company && <span className="font-normal text-paper/60"> at {tailorSession.company}</span>}
                </h2>
                <p className="mt-1 text-sm leading-6 text-paper/68">
                  You pasted this job. Here’s the honest angle — now build the resume version for this specific shot.
                  The target role is pre-filled below; answer the intake with this analysis in mind.
                  {tailorSession.applicationId
                    ? " When you generate, the version will be linked to your tracked application automatically."
                    : " This analysis wasn't saved as an application, so the version won't be linked to one."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTailorSession(null)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-paper/60 transition hover:border-coral hover:text-coral"
              >
                Exit tailored session
              </button>
            </div>

            <div className="mt-4 grid gap-4 border-t border-white/10 pt-4 lg:grid-cols-2">
              <div className="grid content-start gap-3">
                {tailorSession.laneTitle && tailorSession.resumeAngle && (
                  <div>
                    <p className="lab-mono text-[0.68rem] font-bold uppercase text-gold">
                      Positioning angle · {tailorSession.laneTitle}
                    </p>
                    <p className="mt-1 text-[0.8rem] leading-5 text-paper/72">{tailorSession.resumeAngle}</p>
                  </div>
                )}
                {tailorSession.keywords.length > 0 && (
                  <div>
                    <p className="lab-mono text-[0.68rem] font-bold uppercase text-gold">
                      Keywords the post uses — mirror the true ones
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {tailorSession.keywords.slice(0, 12).map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-xs font-bold text-gold"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {tailorSession.coveredRequirements.length > 0 && (
                  <div>
                    <p className="lab-mono text-[0.68rem] font-bold uppercase text-mint">Lead with — you cover these</p>
                    <ul className="mt-1 grid gap-1">
                      {tailorSession.coveredRequirements.slice(0, 4).map((item) => (
                        <li key={item} className="text-[0.78rem] leading-5 text-paper/68">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="grid content-start gap-3">
                {tailorSession.gaps.length > 0 && (
                  <div>
                    <p className="lab-mono text-[0.68rem] font-bold uppercase text-coral">
                      Gaps — do not overstate these
                    </p>
                    <ul className="mt-1 grid gap-1">
                      {tailorSession.gaps.slice(0, 4).map((item) => (
                        <li key={item} className="text-[0.78rem] leading-5 text-paper/68">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tailorSession.bulletPrompts.length > 0 && (
                  <div>
                    <p className="lab-mono text-[0.68rem] font-bold uppercase text-cyan">Bullet ideas from the analysis</p>
                    <ul className="mt-1 grid gap-1">
                      {tailorSession.bulletPrompts.slice(0, 3).map((item) => (
                        <li key={item} className="text-[0.78rem] leading-5 text-paper/68">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-[0.72rem] leading-5 text-paper/50">
                  Everything above comes from your own profile and the job post — keep the resume to what you can defend
                  in an interview.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <LandingPage onStart={() => jump("mode")} />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8" id="demo">
        <div className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-3 md:grid-cols-3">
          {workflowSteps.map(({ label, step: targetStep }, index) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                trackCtaClick(`workflow_${targetStep}`, `#${targetStep}`);
                jump(targetStep);
              }}
              className={`min-h-14 rounded-lg border px-4 text-left text-sm font-bold transition ${
                workflowStep === index + 1
                  ? "border-gold bg-gold text-ink"
                  : "border-white/12 bg-obsidian/40 text-paper/70 hover:border-cyan hover:text-cyan"
              }`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>
        <div className="lab-mono mt-4 grid gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-bold text-paper/64 md:grid-cols-4">
          {[
            ["No Login", "No saved account"],
            ["ATS-Safe", "Single-column output"],
            ["Editable", "Copy, revise, export"],
            ["No Fluff", "Real language only"]
          ].map(([label, detail]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-obsidian/35 p-3">
              <span className="block text-gold">{label}</span>
              <span className="mt-1 block text-[0.68rem] text-paper/50">{detail}</span>
            </div>
          ))}
        </div>
      </section>

      {step === "mode" && (
        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8" id="mode">
          <div className="trust-panel overflow-hidden">
            <div className="border-b border-white/10 p-5 sm:p-7">
              <p className="trust-kicker text-sm font-bold uppercase">Product Lab Module 05</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
                <div>
                  <h2 className="text-3xl font-bold text-paper sm:text-4xl">Choose how you want to start.</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-paper/68">
                    Most people should start with the guided builder. If you already have notes, job history, or a project story,
                    Tell My Story can organize it first.
                  </p>
                </div>
                <div className="rounded-xl border border-cyan/20 bg-cyan/10 p-4 text-sm leading-6 text-paper/72">
                  <strong className="block text-cyan">Resume package mission</strong>
                  Career Forge turns real work into recruiter-ready language without inventing achievements or metrics.
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  trackCtaClick("start_guided_build", "#intake");
                  jump("intake");
                }}
                className="group rounded-xl border border-gold/35 bg-gold/10 p-5 text-left transition hover:-translate-y-0.5 hover:border-gold hover:bg-gold/15 focus:outline-none focus:ring-2 focus:ring-gold/70"
              >
                <span className="rounded-sm border border-gold/40 bg-gold px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-ink">
                  Guided Builder
                </span>
                <h3 className="mt-5 text-2xl font-bold text-paper">Answer focused questions.</h3>
                <p className="mt-3 text-sm leading-6 text-paper/70">
                  Best for recent graduates, career switchers, and anyone who wants step-by-step structure.
                </p>
                <p className="mt-5 text-sm font-bold text-gold transition group-hover:text-cyan">Start guided build</p>
              </button>

              <a
                href="/story"
                onClick={() => trackCtaClick("open_story_mode", "/story")}
                className="group rounded-xl border border-cyan/35 bg-cyan/10 p-5 transition hover:-translate-y-0.5 hover:border-cyan hover:bg-cyan/15 focus:outline-none focus:ring-2 focus:ring-cyan/70"
              >
                <span className="rounded-sm border border-cyan/40 bg-cyan/10 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-cyan">
                  Tell My Story
                </span>
                <h3 className="mt-5 text-2xl font-bold text-paper">Describe your work naturally.</h3>
                <p className="mt-3 text-sm leading-6 text-paper/70">
                  Best for project-heavy backgrounds, founders, and people who already have a rough story.
                </p>
                <p className="mt-5 text-sm font-bold text-cyan transition group-hover:text-gold">Open story mode</p>
              </a>
            </div>
          </div>
        </section>
      )}
      {step === "intake" && (
        <IntakeForm
          data={intake}
          errors={errors}
          selectedTemplate={template}
          onTemplateSelect={setTemplate}
          onChange={updateIntake}
          onValidate={validateIntake}
          onGenerate={generate}
        />
      )}
      {step === "preview" && (
        <>
          {influence && (
            <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8">
              <div className="rounded-xl border border-gold/30 bg-gold/10 p-5 sm:p-6">
                <p className="trust-kicker text-xs font-bold uppercase">Why this version changed</p>
                <p className="mt-2 text-sm leading-6 text-paper/72">
                  This version was built for a specific posting. Here is exactly what the tailoring changed — and what it
                  refused to claim.
                </p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="grid content-start gap-3">
                    {influence.targetFraming && (
                      <div>
                        <p className="lab-mono text-[0.68rem] font-bold uppercase text-gold">Added target framing</p>
                        <p className="mt-1 text-[0.8rem] leading-5 text-paper/72">“{influence.targetFraming}”</p>
                      </div>
                    )}
                    {influence.keywordsWoven.length > 0 && (
                      <div>
                        <p className="lab-mono text-[0.68rem] font-bold uppercase text-mint">
                          Keywords woven in — each backed by your own answers
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {influence.keywordsWoven.map((term) => (
                            <span key={term} className="rounded-full border border-mint/40 bg-mint/10 px-2.5 py-0.5 text-xs font-bold text-mint">
                              {term}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {influence.angleUsed && (
                      <div>
                        <p className="lab-mono text-[0.68rem] font-bold uppercase text-cyan">Lane angle applied</p>
                        <p className="mt-1 text-[0.8rem] leading-5 text-paper/68">{influence.angleUsed}</p>
                      </div>
                    )}
                  </div>
                  <div className="grid content-start gap-3">
                    {influence.gapsAvoided.length > 0 && (
                      <div>
                        <p className="lab-mono text-[0.68rem] font-bold uppercase text-coral">
                          Not claimed — the posting wants these, you don&apos;t have them yet
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {influence.gapsAvoided.map((term) => (
                            <span key={term} className="rounded-full border border-coral/40 bg-coral/10 px-2.5 py-0.5 text-xs font-bold text-coral">
                              {term}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {influence.keywordsSkipped.filter((item) => !influence.gapsAvoided.includes(item.term)).length > 0 && (
                      <div>
                        <p className="lab-mono text-[0.68rem] font-bold uppercase text-paper/55">
                          Skipped — no evidence in your answers (add it to your profile if true)
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {influence.keywordsSkipped
                            .filter((item) => !influence.gapsAvoided.includes(item.term))
                            .map((item) => (
                              <span
                                key={item.term}
                                title={item.reason}
                                className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-xs font-bold text-paper/55"
                              >
                                {item.term}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[0.72rem] leading-5 text-paper/50">
                      Bullets mentioning matched keywords were moved to the top of each role. No text was invented — edit
                      anything below that doesn&apos;t sound like you.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
          <ResumePreview data={intake} resume={resume} template={template} onChange={setResume} />
          <ATSValidationPanel data={intake} resume={resume} />
          <LinkedInPreview resume={resume} onChange={setResume} />
        </>
      )}

      <SiteFooter />
    </main>
  );
}
