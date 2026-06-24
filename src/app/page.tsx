"use client";

import { useMemo, useState } from "react";
import { ATSValidationPanel } from "@/components/ATSValidationPanel";
import { IntakeForm } from "@/components/IntakeForm";
import { LandingPage } from "@/components/LandingPage";
import { LinkedInPreview } from "@/components/LinkedInPreview";
import { ResumePreview } from "@/components/ResumePreview";
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
      <LandingPage onStart={() => jump("intake")} />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8" id="demo">
        <div className="grid gap-3 md:grid-cols-3">
          {["Landing", "Guided Intake", "Resume + LinkedIn"].map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => jump((["landing", "intake", "preview"] as Step[])[index])}
              className={`min-h-14 rounded-md border px-4 text-left text-sm font-bold transition ${
                workflowStep === index + 1
                  ? "border-spruce bg-mint text-ink"
                  : "border-ink/12 bg-white text-ink/72 hover:border-spruce"
              }`}
            >
              {index + 1}. {label}
            </button>
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

      <footer className="border-t border-ink/10 px-5 py-6 text-center text-sm text-ink/60">
        Career Forge Lite builds local, editable draft content. Exported resume text is unbranded.
      </footer>
    </main>
  );
}
