"use client";

import { useMemo, useState } from "react";
import { outcomeOptions, responsibilitySuggestions, roleFamilies, templates } from "@/lib/career-data";
import type { IntakeData, IntakeErrors, RoleFamily, TemplateStyle } from "@/types/career";

type IntakeFormProps = {
  data: IntakeData;
  errors: IntakeErrors;
  selectedTemplate: TemplateStyle;
  onTemplateSelect: (template: TemplateStyle) => void;
  onChange: (data: IntakeData) => void;
  onValidate: (keys: Array<keyof IntakeData>) => boolean;
  onGenerate: () => void;
};

const requiredKeys: Array<keyof IntakeData> = ["fullName", "email", "targetJobTitle", "currentTitle"];

const scopeFields: Array<{ key: keyof IntakeData; label: string; placeholder: string }> = [
  { key: "customersServed", label: "About how many customers did you support?", placeholder: "Example: 40+ per week" },
  { key: "ticketsHandled", label: "How many tickets or requests did you handle?", placeholder: "Example: 75 per month" },
  { key: "projectsSupported", label: "How many projects did you support?", placeholder: "Example: 3 active projects" },
  { key: "teamSizeSupported", label: "What team size did you support?", placeholder: "Example: 8-person team" },
  { key: "callsHandled", label: "How many calls did you handle?", placeholder: "Example: 25 daily calls" },
  { key: "reportsCreated", label: "How many reports did you create?", placeholder: "Example: 5 weekly reports" }
];

const templateDescriptions: Record<TemplateStyle, string> = {
  Corporate: "Classic spacing and conservative headings for business-facing roles.",
  "Modern ATS": "Balanced whitespace with clean, readable section hierarchy.",
  "Tech ATS": "Compact and keyword-forward for tools, support workflows, and technical roles."
};

const steps = [
  {
    title: "Set the contact line.",
    microcopy: "Start with the basics. This becomes the clean header employers see first.",
    validate: ["fullName", "email"] as Array<keyof IntakeData>
  },
  {
    title: "Name the target.",
    microcopy: "A rough target is enough. If it is too vague, Career Forge will normalize it into a stronger role title.",
    validate: ["targetJobTitle"] as Array<keyof IntakeData>
  },
  {
    title: "Log the experience.",
    microcopy: "Add your current role first. Short titles, companies, and date ranges are enough.",
    validate: ["currentTitle"] as Array<keyof IntakeData>
  },
  {
    title: "Translate the real work.",
    microcopy: "Choose what fits, then add your own words. We will turn this into resume language.",
    validate: [] as Array<keyof IntakeData>
  },
  {
    title: "Add the receipts.",
    microcopy: "Estimate if you are not sure. Numbers and outcomes make bullets more credible.",
    validate: [] as Array<keyof IntakeData>
  },
  {
    title: "Pick the resume shell.",
    microcopy: "All options stay single-column and ATS-safe. Choose the tone that fits the opportunity.",
    validate: [] as Array<keyof IntakeData>
  }
];

export function IntakeForm({
  data,
  errors,
  selectedTemplate,
  onTemplateSelect,
  onChange,
  onValidate,
  onGenerate
}: IntakeFormProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const suggestions = responsibilitySuggestions[data.roleFamily];
  const step = steps[stepIndex];
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  const selectedSummary = useMemo(() => {
    const selected = data.selectedResponsibilities.length + data.selectedOutcomes.length;
    return selected ? `${selected} guided signals selected` : "No guided signals selected yet";
  }, [data.selectedOutcomes.length, data.selectedResponsibilities.length]);

  function update<K extends keyof IntakeData>(key: K, value: IntakeData[K]) {
    onChange({ ...data, [key]: value });
  }

  function setRoleFamily(roleFamily: RoleFamily) {
    onChange({ ...data, roleFamily, selectedResponsibilities: [] });
  }

  function toggleResponsibility(item: string) {
    const selected = data.selectedResponsibilities.includes(item)
      ? data.selectedResponsibilities.filter((value) => value !== item)
      : [...data.selectedResponsibilities, item];
    update("selectedResponsibilities", selected);
  }

  function toggleOutcome(item: string) {
    const selected = data.selectedOutcomes.includes(item)
      ? data.selectedOutcomes.filter((value) => value !== item)
      : [...data.selectedOutcomes, item];
    update("selectedOutcomes", selected);
  }

  function continueStep() {
    if (!onValidate(step.validate)) return;
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
      window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
      return;
    }
    onGenerate();
  }

  function backStep() {
    setStepIndex(Math.max(0, stepIndex - 1));
    window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
  }

  function inputClass(key: keyof IntakeData) {
    return `trust-input min-h-12 w-full rounded-md border px-4 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15 ${
      errors[key] ? "border-coral" : "border-ink/15"
    }`;
  }

  function renderField(
    fieldKey: keyof IntakeData,
    label: string,
    placeholder?: string,
    type = "text",
    helper?: string
  ) {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-ink">
          {label}
          {requiredKeys.includes(fieldKey) && <span className="text-coral"> *</span>}
        </span>
        {helper && <span className="mb-2 block text-sm leading-5 text-ink/60">{helper}</span>}
        <input
          type={type}
          value={String(data[fieldKey])}
          onChange={(event) => update(fieldKey, event.target.value as never)}
          placeholder={placeholder}
          aria-invalid={Boolean(errors[fieldKey])}
          className={inputClass(fieldKey)}
        />
        {errors[fieldKey] && <span className="mt-2 block text-sm font-semibold text-coral">{errors[fieldKey]}</span>}
      </label>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8" id="intake">
      <div className="mb-6">
        <p className="trust-kicker text-sm font-bold uppercase">
          intake://step-{stepIndex + 1} / {steps.length}
        </p>
        <h2 className="mt-3 text-3xl font-bold text-paper">{step.title}</h2>
        <p className="mt-3 max-w-3xl text-paper/70">{step.microcopy}</p>
        <p className="mt-3 inline-flex rounded-md border border-cyan/20 bg-cyan/10 px-3 py-2 text-sm font-semibold text-cyan">
          No perfect wording needed. Bring rough notes. Career Forge cleans the language.
        </p>
        <div className="mt-5 h-2 rounded-full bg-white/10">
          <div className="h-2 rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <form
        className="dark-form-card rounded-md p-5 shadow-glow sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          continueStep();
        }}
      >
        {stepIndex === 0 && (
          <div className="rounded-md border border-ink/10 bg-paper p-4 sm:p-5">
            <div className="grid gap-5 md:grid-cols-2">
              {renderField("fullName", "What name should appear on your resume?", "Jordan Lee")}
              {renderField("email", "What email should employers use?", "jordan@email.com", "email")}
              {renderField("phone", "Phone number", "(555) 123-4567", "text", "Optional, but useful for a resume header.")}
              {renderField("website", "Portfolio, LinkedIn, or website", "jordanlee.com", "text", "Optional. Add one clean link if it helps your candidacy.")}
            </div>
          </div>
        )}

        {stepIndex === 1 && (
          <div className="space-y-5">
            <div className="rounded-md border border-ink/10 bg-paper p-4 sm:p-5">
              {renderField(
                "targetJobTitle",
                "What job title are you aiming for?",
                "Customer Success Associate",
                "text",
                "If you type something rough, like a shorthand or placeholder, we will clean it up."
              )}
            </div>
            <div className="rounded-md border border-ink/10 bg-paper p-4 sm:p-5">
              <span className="mb-2 block text-sm font-bold text-ink">Which lane fits the work?</span>
              <p className="mb-4 text-sm leading-6 text-ink/65">
                This loads the right responsibility set and keeps the draft role-aligned.
              </p>
              <div className="flex flex-wrap gap-2">
                {roleFamilies.map((roleFamily) => (
                  <button
                    key={roleFamily}
                    type="button"
                    onClick={() => setRoleFamily(roleFamily)}
                    className={`min-h-10 rounded-md border px-3 text-sm font-semibold transition ${
                      data.roleFamily === roleFamily
                        ? "border-gold bg-gold text-ink"
                        : "border-ink/15 bg-white text-ink hover:border-spruce"
                    }`}
                  >
                    {roleFamily}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {stepIndex === 2 && (
          <div className="space-y-5">
            <div className="rounded-md border border-ink/10 bg-paper p-4 sm:p-5">
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-spruce">Most recent role</p>
              <div className="grid gap-5 md:grid-cols-3">
                {renderField("currentTitle", "What was your role?", "Support Specialist")}
                {renderField("currentCompany", "Where was it?", "Northstar Co.")}
                {renderField("currentTime", "When were you there?", "Jan 2024 - Present")}
              </div>
            </div>
            <div className="rounded-md border border-ink/10 bg-paper p-4 sm:p-5">
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-spruce">Previous role</p>
              <div className="grid gap-5 md:grid-cols-3">
                {renderField("previousTitle", "What was the role before that?", "Administrative Assistant")}
                {renderField("previousCompany", "Where was it?", "Bright Office Group")}
                {renderField("previousTime", "When were you there?", "Jun 2022 - Dec 2023")}
              </div>
            </div>
            <div className="rounded-md border border-ink/10 bg-paper p-4 sm:p-5">
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-spruce">Optional third role</p>
              <div className="grid gap-5 md:grid-cols-3">
                {renderField("additionalTitle", "Any other role worth including?", "Campus Assistant")}
                {renderField("additionalCompany", "Where was it?", "City College")}
                {renderField("additionalTime", "When were you there?", "Sep 2021 - May 2022")}
              </div>
            </div>
          </div>
        )}

        {stepIndex === 3 && (
          <div className="space-y-5">
            <div>
              <span className="mb-2 block text-sm font-bold text-ink">Which receipts belong in the draft?</span>
              <p className="mb-4 text-sm leading-6 text-ink/70">
                Pick anything that fits. These become the raw material for cleaner resume bullets.
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <label
                    key={item}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-semibold text-ink transition has-[:checked]:border-gold has-[:checked]:bg-gold/20"
                  >
                    <input
                      type="checkbox"
                      checked={data.selectedResponsibilities.includes(item)}
                      onChange={() => toggleResponsibility(item)}
                      className="h-4 w-4 accent-spruce"
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">What tools or systems did you use?</span>
              <input
                type="text"
                value={data.tools}
                onChange={(event) => update("tools", event.target.value)}
                placeholder="Zendesk, Salesforce, Excel, Notion"
                className="trust-input min-h-12 w-full rounded-md border px-4 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">Anything else you handled?</span>
              <span className="mb-2 block text-sm leading-5 text-ink/60">Plain language is fine. We will turn this into resume language.</span>
              <textarea
                value={data.responsibilities}
                onChange={(event) => update("responsibilities", event.target.value)}
                placeholder="Add anything else: weekly reports, inbox triage, QA checks, vendor follow-up..."
                rows={4}
                className="trust-input w-full rounded-md border px-4 py-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
            </label>
          </div>
        )}

        {stepIndex === 4 && (
          <div className="space-y-6">
            <div>
              <span className="mb-2 block text-sm font-bold text-ink">Add any numbers you can defend</span>
              <p className="mb-4 text-sm leading-6 text-ink/70">
                Estimate if you are not sure. These details help the resume sound specific without inventing anything.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {scopeFields.map((field) => (
                  <label key={field.key} className="block">
                    <span className="mb-2 block text-sm font-semibold text-ink">{field.label}</span>
                    <input
                      type="text"
                      value={String(data[field.key])}
                      onChange={(event) => update(field.key, event.target.value as never)}
                      placeholder={field.placeholder}
                      className="trust-input min-h-12 w-full rounded-md border px-4 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-3 block text-sm font-bold text-ink">What did your work make better?</span>
              <div className="flex flex-wrap gap-2">
                {outcomeOptions.map((item) => (
                  <label
                    key={item}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-semibold text-ink transition has-[:checked]:border-gold has-[:checked]:bg-gold/20"
                  >
                    <input
                      type="checkbox"
                      checked={data.selectedOutcomes.includes(item)}
                      onChange={() => toggleOutcome(item)}
                      className="h-4 w-4 accent-spruce"
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">Any result you want reflected?</span>
              <span className="mb-2 block text-sm leading-5 text-ink/60">This can be informal: faster replies, fewer mistakes, happier customers, cleaner records.</span>
              <textarea
                value={data.outcomes}
                onChange={(event) => update("outcomes", event.target.value)}
                placeholder="Example: improved response time, reduced repeat errors, kept records audit-ready"
                rows={4}
                className="trust-input w-full rounded-md border px-4 py-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
            </label>
          </div>
        )}

        {stepIndex === 5 && (
          <div>
            <div className="mb-4 rounded-md border border-gold/25 bg-gold/10 p-4 text-sm font-semibold text-ink/75">
              {selectedSummary}. Generated resume content stays neutral, unbranded, and ATS-safe.
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {templates.map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => onTemplateSelect(template)}
                  className={`min-h-40 rounded-md border bg-white p-5 text-left transition ${
                    selectedTemplate === template
                      ? "border-gold shadow-soft ring-4 ring-gold/20"
                      : "border-ink/12 hover:border-gold"
                  }`}
                >
                  <span className="text-lg font-bold text-ink">{template}</span>
                  <span className="mt-3 block text-sm leading-6 text-ink/70">{templateDescriptions[template]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={backStep}
            disabled={stepIndex === 0}
            className="min-h-12 rounded-md border border-ink/15 bg-white px-6 font-bold text-ink transition hover:border-gold disabled:cursor-not-allowed disabled:opacity-45"
          >
            Back
          </button>
          <button
            type="submit"
            className="min-h-12 rounded-md bg-ink px-6 font-bold text-paper transition hover:bg-gold hover:text-ink"
          >
            {stepIndex === steps.length - 1 ? "Generate Resume Package" : "Continue"}
          </button>
        </div>
      </form>
    </section>
  );
}
