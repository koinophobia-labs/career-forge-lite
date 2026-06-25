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

type Step = "landing" | "intake" | "preview";

export default function Home() {
  const [step, setStep] = useState<Step>("landing");
  const [intake, setIntake] = useState<IntakeData>(initialIntake);
  const [errors, setErrors] = useState<IntakeErrors>({});
  const [template, setTemplate] = useState<TemplateStyle>("Modern ATS");
  const [resume, setResume] = useState<ResumePackage>(() => generateResumePackage(initialIntake));

  const workflowStep = useMemo(() => {
    const order: Step[] = ["landing", "intake", "preview"];
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
      <SiteHeader onStart={() => jump("intake")} />
      <LandingPage onStart={() => jump("intake")} />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8" id="demo">
        <div className="grid gap-3 rounded-md border border-white/10 bg-white/5 p-3 md:grid-cols-3">
          {["Choose Path", "Build Resume", "Review Resume"].map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => jump((["landing", "intake", "preview"] as Step[])[index])}
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
