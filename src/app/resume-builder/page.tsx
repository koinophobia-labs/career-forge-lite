"use client";

import { useEffect, useRef, useState } from "react";
import { ATSValidationPanel } from "@/components/ATSValidationPanel";
import { CommandNav } from "@/components/CommandNav";
import { IntakeForm } from "@/components/IntakeForm";
import { LinkedInPreview } from "@/components/LinkedInPreview";
import { ResumePreview } from "@/components/ResumePreview";
import { SiteFooter } from "@/components/SiteFooter";
import { initialIntake } from "@/lib/career-data";
import { trackCareerEvent, trackCareerForgeCompletion, trackCareerForgeStart, trackCtaClick, trackResumeGeneration } from "@/lib/analytics";
import { createId, loadState } from "@/lib/command-center-store";
import { resumeToText } from "@/lib/resume-export";
import { consumeHandoff, recordTailoredResumeVersion, type TailorHandoff } from "@/lib/tailor-handoff";
import { applyTailoredContext, contextFromHandoff, type TailoredInfluence } from "@/lib/tailored-resume";
import { updateCommandCenter } from "@/lib/use-command-center";
import { generateResumePackage } from "@/lib/generator";
import { intakeFromDossier, mergeIntakeIntoDossier, withUpdatedDossier } from "@/lib/dossier";
import type { IntakeData, IntakeErrors, ResumePackage, TemplateStyle } from "@/types/career";
import type { ResumeSnapshot } from "@/types/command-center";

type Step = "intake" | "preview";

function buildSnapshot(intake: IntakeData, resumePackage: ResumePackage, template: TemplateStyle): ResumeSnapshot {
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
  { label: "Build Resume", step: "intake" },
  { label: "Review Resume", step: "preview" }
];

export default function Home() {
  const [step, setStep] = useState<Step>("intake");
  const [intakeReady, setIntakeReady] = useState(false);
  const [intake, setIntake] = useState<IntakeData>(initialIntake);
  const [errors, setErrors] = useState<IntakeErrors>({});
  const [template, setTemplate] = useState<TemplateStyle>("Modern ATS");
  const [resume, setResume] = useState<ResumePackage>(() => generateResumePackage(initialIntake));
  const hasTrackedGuidedStart = useRef(false);
  const hasTrackedGuidedCompletion = useRef(false);
  const [tailorSession, setTailorSession] = useState<TailorHandoff | null>(null);
  const [influence, setInfluence] = useState<TailoredInfluence | null>(null);

  useEffect(() => {
    const stored = loadState();
    const handoff = consumeHandoff(new Date().toISOString());
    const dossierIntake = intakeFromDossier(stored.dossier, handoff?.roleTitle ?? "");
    if (stored.dossier.evidence.length || stored.dossier.roles.length || stored.dossier.projects.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from the canonical local dossier
      setIntake(dossierIntake);
    }
    if (handoff) {
      setTailorSession(handoff);
      setIntake((current) => ({ ...current, ...dossierIntake, targetJobTitle: handoff.roleTitle }));
    }
    if (!hasTrackedGuidedStart.current) {
      trackCareerForgeStart("guided");
      hasTrackedGuidedStart.current = true;
    }
  }, []);

  // IntakeForm still supports its legacy standalone goal chooser for older
  // callers. This route already knows the user chose Guided Setup, so advance
  // that internal chooser before revealing the form. The user lands directly
  // on the first useful question instead of answering how to start twice.
  useEffect(() => {
    if (step !== "intake" || intakeReady) return;
    let cancelled = false;
    let attempts = 0;

    function advanceToTargetQuestion() {
      if (cancelled) return;
      const startButton = [...document.querySelectorAll<HTMLButtonElement>("#intake button")]
        .find((button) => button.textContent?.trim() === "Start");
      if (startButton) {
        startButton.click();
        window.requestAnimationFrame(() => {
          if (!cancelled) setIntakeReady(true);
        });
        return;
      }
      attempts += 1;
      if (attempts < 12) {
        window.requestAnimationFrame(advanceToTargetQuestion);
      } else {
        setIntakeReady(true);
      }
    }

    window.requestAnimationFrame(advanceToTargetQuestion);
    return () => {
      cancelled = true;
    };
  }, [intakeReady, step]);

  const workflowStep = step === "intake" ? 1 : 2;

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
    if (Object.keys(errors).length) setErrors({});
  }

  function jump(nextStep: Step) {
    if (nextStep === "preview" && !validateIntake()) {
      setStep("intake");
      window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
      return;
    }

    if (nextStep === "intake" && step !== "intake") setIntakeReady(false);
    setStep(nextStep);
    window.setTimeout(() => document.getElementById(nextStep === "preview" ? "resume" : "intake")?.scrollIntoView(), 0);
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
      trackCareerEvent("tailored_resume_completed");
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
      <CommandNav active="/resume-builder" />

      <section className="mx-auto max-w-6xl px-5 pt-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Guided setup</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Build a résumé one clear question at a time.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          Start with the job you want and your most recent work. Career Forge turns your answers into an editable,
          ATS-safe draft without inventing achievements or metrics.
        </p>
        <a
          href="/story"
          onClick={() => trackCtaClick("open_story_mode", "/story")}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-cyan transition hover:text-gold"
        >
          Prefer to describe your work naturally? Tell My Story →
        </a>
      </section>

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
                  You pasted this job. The target role is already filled in; answer the questions using only experience you can defend.
                  {tailorSession.applicationId
                    ? " The generated version will link to your tracked application automatically."
                    : " This analysis was not saved as an application, so the version will remain unlinked."}
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
                    <p className="lab-mono text-[0.68rem] font-bold uppercase text-gold">Positioning angle · {tailorSession.laneTitle}</p>
                    <p className="mt-1 text-[0.8rem] leading-5 text-paper/72">{tailorSession.resumeAngle}</p>
                  </div>
                )}
                {tailorSession.keywords.length > 0 && (
                  <div>
                    <p className="lab-mono text-[0.68rem] font-bold uppercase text-gold">Keywords the post uses — mirror the true ones</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {tailorSession.keywords.slice(0, 12).map((keyword) => (
                        <span key={keyword} className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-xs font-bold text-gold">{keyword}</span>
                      ))}
                    </div>
                  </div>
                )}
                {tailorSession.coveredRequirements.length > 0 && (
                  <div>
                    <p className="lab-mono text-[0.68rem] font-bold uppercase text-mint">Lead with — you cover these</p>
                    <ul className="mt-1 grid gap-1">
                      {tailorSession.coveredRequirements.slice(0, 4).map((item) => <li key={item} className="text-[0.78rem] leading-5 text-paper/68">· {item}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              <div className="grid content-start gap-3">
                {tailorSession.gaps.length > 0 && (
                  <div>
                    <p className="lab-mono text-[0.68rem] font-bold uppercase text-coral">Gaps — do not overstate these</p>
                    <ul className="mt-1 grid gap-1">
                      {tailorSession.gaps.slice(0, 4).map((item) => <li key={item} className="text-[0.78rem] leading-5 text-paper/68">· {item}</li>)}
                    </ul>
                  </div>
                )}
                {tailorSession.bulletPrompts.length > 0 && (
                  <div>
                    <p className="lab-mono text-[0.68rem] font-bold uppercase text-cyan">Bullet ideas from the analysis</p>
                    <ul className="mt-1 grid gap-1">
                      {tailorSession.bulletPrompts.slice(0, 3).map((item) => <li key={item} className="text-[0.78rem] leading-5 text-paper/68">· {item}</li>)}
                    </ul>
                  </div>
                )}
                <p className="text-[0.72rem] leading-5 text-paper/50">Everything above comes from your own profile and the job post. Keep the résumé to what you can defend in an interview.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8" id="demo">
        <div className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-3 md:grid-cols-2">
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

      {step === "intake" && (
        <div className={intakeReady ? "" : "invisible min-h-[32rem]"} aria-hidden={!intakeReady}>
          <IntakeForm
            data={intake}
            errors={errors}
            selectedTemplate={template}
            onTemplateSelect={setTemplate}
            onChange={updateIntake}
            onValidate={validateIntake}
            onGenerate={generate}
          />
        </div>
      )}

      {step === "preview" && (
        <>
          {influence && (
            <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8">
              <div className="rounded-xl border border-gold/30 bg-gold/10 p-5 sm:p-6">
                <p className="trust-kicker text-xs font-bold uppercase">Why this version changed</p>
                <p className="mt-2 text-sm leading-6 text-paper/72">This version was built for a specific posting. Here is what the tailoring changed and what it refused to claim.</p>
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
                        <p className="lab-mono text-[0.68rem] font-bold uppercase text-mint">Keywords woven in — each backed by your answers</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {influence.keywordsWoven.map((term) => <span key={term} className="rounded-full border border-mint/40 bg-mint/10 px-2.5 py-0.5 text-xs font-bold text-mint">{term}</span>)}
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
                        <p className="lab-mono text-[0.68rem] font-bold uppercase text-coral">Not claimed — the posting wants these, but your evidence does not support them yet</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {influence.gapsAvoided.map((term) => <span key={term} className="rounded-full border border-coral/40 bg-coral/10 px-2.5 py-0.5 text-xs font-bold text-coral">{term}</span>)}
                        </div>
                      </div>
                    )}
                    {influence.keywordsSkipped.filter((item) => !influence.gapsAvoided.includes(item.term)).length > 0 && (
                      <div>
                        <p className="lab-mono text-[0.68rem] font-bold uppercase text-paper/55">Skipped — no evidence in your answers</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {influence.keywordsSkipped
                            .filter((item) => !influence.gapsAvoided.includes(item.term))
                            .map((item) => (
                              <span key={item.term} title={item.reason} className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-xs font-bold text-paper/55">{item.term}</span>
                            ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[0.72rem] leading-5 text-paper/50">Matched evidence was prioritized. No text was invented; edit anything below that does not sound like you.</p>
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
