"use client";

import { useMemo, useState } from "react";
import { ATSValidationPanel } from "@/components/ATSValidationPanel";
import { IntakeForm } from "@/components/IntakeForm";
import { LandingPage } from "@/components/LandingPage";
import { LinkedInPreview } from "@/components/LinkedInPreview";
import { ResumePreview } from "@/components/ResumePreview";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { initialIntake } from "@/lib/career-data";
import { generateResumePackage } from "@/lib/generator";
import type { IntakeData, IntakeErrors, ResumePackage, TemplateStyle } from "@/types/career";

type Step = "landing" | "mode" | "intake" | "preview";

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

  const workflowStep = useMemo(() => {
    const order: Step[] = ["mode", "intake", "preview"];
    return order.indexOf(step) + 1;
  }, [step]);

  function validateIntake(keys: Array<keyof IntakeData> = ["fullName", "email", "targetJobTitle", "currentTitle"]) {
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

    setStep(nextStep);
    window.setTimeout(() => document.getElementById(nextStep)?.scrollIntoView(), 0);
  }

  function generate() {
    if (!validateIntake()) {
      setStep("intake");
      window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
      return;
    }

    setResume(generateResumePackage(intake));
    setStep("preview");
    window.setTimeout(() => document.getElementById("resume")?.scrollIntoView(), 0);
  }

  return (
    <main>
      <SiteHeader onStart={() => jump("mode")} />
      <LandingPage onStart={() => jump("mode")} />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8" id="demo">
        <div className="grid gap-3 rounded-md border border-white/10 bg-white/5 p-3 md:grid-cols-3">
          {workflowSteps.map(({ label, step: targetStep }, index) => (
            <button
              key={label}
              type="button"
              onClick={() => jump(targetStep)}
              className={`min-h-14 rounded-md border px-4 text-left text-sm font-bold transition ${
                workflowStep === index + 1
                  ? "border-gold bg-gold text-ink"
                  : "border-white/12 bg-obsidian/40 text-paper/70 hover:border-cyan hover:text-cyan"
              }`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 rounded-md border border-white/10 bg-white/5 p-3 text-xs font-bold uppercase tracking-[0.12em] text-paper/64 md:grid-cols-4">
          {[
            ["No Login", "No saved account"],
            ["ATS-Safe", "Single-column output"],
            ["Editable", "Copy, revise, export"],
            ["No Fluff", "Real language only"]
          ].map(([label, detail]) => (
            <div key={label} className="rounded-md border border-white/10 bg-obsidian/35 p-3">
              <span className="block text-gold">{label}</span>
              <span className="mt-1 block text-[0.68rem] text-paper/50">{detail}</span>
            </div>
          ))}
        </div>
      </section>

      {step === "mode" && (
        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8" id="mode">
          <div className="trust-panel overflow-hidden rounded-md">
            <div className="border-b border-white/10 p-5 sm:p-7">
              <p className="trust-kicker text-sm font-bold uppercase">Product Lab Module 05</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
                <div>
                  <h2 className="text-3xl font-bold text-paper sm:text-4xl">Choose your build mode.</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-paper/68">
                    Pick the path that matches how you think. Both modes feed the same resume engine, LinkedIn preview,
                    and ATS-safe review.
                  </p>
                </div>
                <div className="rounded-md border border-cyan/20 bg-cyan/10 p-4 text-sm leading-6 text-paper/72">
                  <strong className="block text-cyan">Resume package mission</strong>
                  Career Forge turns real work into recruiter-ready language without inventing achievements or metrics.
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-2">
              <button
                type="button"
                onClick={() => jump("intake")}
                className="group rounded-md border border-gold/35 bg-gold/10 p-5 text-left transition hover:-translate-y-0.5 hover:border-gold hover:bg-gold/15 focus:outline-none focus:ring-2 focus:ring-gold/70"
              >
                <span className="rounded-sm border border-gold/40 bg-gold px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-ink">
                  Guided Interview
                </span>
                <h3 className="mt-5 text-2xl font-bold text-paper">Answer focused questions.</h3>
                <p className="mt-3 text-sm leading-6 text-paper/70">Best if you want structure.</p>
                <p className="mt-5 text-sm font-bold text-gold transition group-hover:text-cyan">Start guided build</p>
              </button>

              <a
                href="/story"
                className="group rounded-md border border-cyan/35 bg-cyan/10 p-5 transition hover:-translate-y-0.5 hover:border-cyan hover:bg-cyan/15 focus:outline-none focus:ring-2 focus:ring-cyan/70"
              >
                <span className="rounded-sm border border-cyan/40 bg-cyan/10 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-cyan">
                  Tell My Story
                </span>
                <h3 className="mt-5 text-2xl font-bold text-paper">Describe your work naturally.</h3>
                <p className="mt-3 text-sm leading-6 text-paper/70">
                  Career Forge organizes the details.
                </p>
                <p className="mt-5 text-sm font-bold text-cyan transition group-hover:text-gold">Open conversational mode</p>
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
          <ResumePreview data={intake} resume={resume} template={template} onChange={setResume} />
          <ATSValidationPanel data={intake} resume={resume} />
          <LinkedInPreview resume={resume} onChange={setResume} />
        </>
      )}

      <SiteFooter />
    </main>
  );
}
