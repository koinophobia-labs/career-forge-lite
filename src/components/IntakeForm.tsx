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
  { key: "customersServed", label: "Customers served", placeholder: "Example: 40+ per week" },
  { key: "ticketsHandled", label: "Tickets handled", placeholder: "Example: 75 per month" },
  { key: "projectsSupported", label: "Projects supported", placeholder: "Example: 3 active projects" },
  { key: "teamSizeSupported", label: "Team size supported", placeholder: "Example: 8-person team" },
  { key: "callsHandled", label: "Calls handled", placeholder: "Example: 25 daily calls" },
  { key: "reportsCreated", label: "Reports created", placeholder: "Example: 5 weekly reports" }
];

const templateDescriptions: Record<TemplateStyle, string> = {
  Corporate: "Classic spacing and conservative headings for business-facing roles.",
  "Modern ATS": "Balanced whitespace with clean, readable section hierarchy.",
  "Tech ATS": "Compact and keyword-forward for tools, support workflows, and technical roles."
};

const steps = [
  {
    title: "Contact",
    microcopy: "Recruiters need clear contact details before they read anything else.",
    validate: ["fullName", "email"] as Array<keyof IntakeData>
  },
  {
    title: "Target",
    microcopy: "The target role shapes keywords, summary language, and LinkedIn positioning.",
    validate: ["targetJobTitle"] as Array<keyof IntakeData>
  },
  {
    title: "Experience",
    microcopy: "Add up to three roles. Short titles and date ranges are enough for a strong first draft.",
    validate: ["currentTitle"] as Array<keyof IntakeData>
  },
  {
    title: "Responsibilities",
    microcopy: "Choose guided chips and add anything specific. These become ATS-searchable skills and bullets.",
    validate: [] as Array<keyof IntakeData>
  },
  {
    title: "Scope + Outcomes",
    microcopy: "Numbers and outcomes turn duties into evidence. Estimates are fine.",
    validate: [] as Array<keyof IntakeData>
  },
  {
    title: "Template",
    microcopy: "All templates remain single-column and ATS-safe. Pick the style that fits the role.",
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
    return `min-h-12 w-full rounded-md border bg-white px-4 text-ink outline-none transition focus:border-spruce focus:ring-4 focus:ring-mint ${
      errors[key] ? "border-coral" : "border-ink/15"
    }`;
  }

  function renderField(
    fieldKey: keyof IntakeData,
    label: string,
    placeholder?: string,
    type = "text"
  ) {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-ink">
          {label}
          {requiredKeys.includes(fieldKey) && <span className="text-coral"> *</span>}
        </span>
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
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-coral">
          Step {stepIndex + 1} of {steps.length}
        </p>
        <h2 className="mt-3 text-3xl font-bold text-ink">{step.title}</h2>
        <p className="mt-3 max-w-3xl text-ink/70">{step.microcopy}</p>
        <div className="mt-5 h-2 rounded-full bg-ink/10">
          <div className="h-2 rounded-full bg-spruce transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <form
        className="rounded-md border border-ink/12 bg-white p-5 shadow-soft sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          continueStep();
        }}
      >
        {stepIndex === 0 && (
          <div className="grid gap-5 md:grid-cols-2">
            {renderField("fullName", "Full name", "Jordan Lee")}
            {renderField("email", "Email", "jordan@email.com", "email")}
            {renderField("phone", "Phone", "(555) 123-4567")}
            {renderField("website", "Website or portfolio URL", "jordanlee.com")}
          </div>
        )}

        {stepIndex === 1 && (
          <div className="grid gap-5 md:grid-cols-2">
            {renderField("targetJobTitle", "Target job title", "Customer Success Associate")}
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">Target role family</span>
              <select
                value={data.roleFamily}
                onChange={(event) => setRoleFamily(event.target.value as RoleFamily)}
                className="min-h-12 w-full rounded-md border border-ink/15 bg-white px-4 text-ink outline-none transition focus:border-spruce focus:ring-4 focus:ring-mint"
              >
                {roleFamilies.map((roleFamily) => (
                  <option key={roleFamily}>{roleFamily}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {stepIndex === 2 && (
          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-3">
              {renderField("currentTitle", "Current or most recent role", "Support Specialist")}
              {renderField("currentCompany", "Current/most recent company", "Northstar Co.")}
              {renderField("currentTime", "Time in role", "Jan 2024 - Present")}
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {renderField("previousTitle", "Previous role title", "Administrative Assistant")}
              {renderField("previousCompany", "Previous company", "Bright Office Group")}
              {renderField("previousTime", "Time in previous role", "Jun 2022 - Dec 2023")}
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {renderField("additionalTitle", "Optional third role", "Campus Assistant")}
              {renderField("additionalCompany", "Optional third company", "City College")}
              {renderField("additionalTime", "Time in third role", "Sep 2021 - May 2022")}
            </div>
          </div>
        )}

        {stepIndex === 3 && (
          <div className="space-y-5">
            <div>
              <span className="mb-2 block text-sm font-bold text-ink">Guided responsibilities</span>
              <p className="mb-4 text-sm leading-6 text-ink/68">
                These update from your role family and help the generator choose stronger ATS language.
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <label
                    key={item}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-semibold text-ink transition has-[:checked]:border-spruce has-[:checked]:bg-mint"
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
              <span className="mb-2 block text-sm font-bold text-ink">Tools/software used</span>
              <input
                type="text"
                value={data.tools}
                onChange={(event) => update("tools", event.target.value)}
                placeholder="Zendesk, Salesforce, Excel, Notion"
                className="min-h-12 w-full rounded-md border border-ink/15 bg-white px-4 text-ink outline-none transition focus:border-spruce focus:ring-4 focus:ring-mint"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">Custom responsibilities</span>
              <textarea
                value={data.responsibilities}
                onChange={(event) => update("responsibilities", event.target.value)}
                placeholder="Add anything else: weekly reports, inbox triage, QA checks, vendor follow-up..."
                rows={4}
                className="w-full rounded-md border border-ink/15 bg-white px-4 py-3 text-ink outline-none transition focus:border-spruce focus:ring-4 focus:ring-mint"
              />
            </label>
          </div>
        )}

        {stepIndex === 4 && (
          <div className="space-y-6">
            <div>
              <span className="mb-2 block text-sm font-bold text-ink">Scope handled</span>
              <p className="mb-4 text-sm leading-6 text-ink/68">
                Use numbers or estimates. Even rough scope helps bullets sound more credible.
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
                      className="min-h-12 w-full rounded-md border border-ink/15 bg-white px-4 text-ink outline-none transition focus:border-spruce focus:ring-4 focus:ring-mint"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-3 block text-sm font-bold text-ink">Outcomes improved</span>
              <div className="flex flex-wrap gap-2">
                {outcomeOptions.map((item) => (
                  <label
                    key={item}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-semibold text-ink transition has-[:checked]:border-spruce has-[:checked]:bg-mint"
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
              <span className="mb-2 block text-sm font-bold text-ink">Additional measurable outcomes</span>
              <textarea
                value={data.outcomes}
                onChange={(event) => update("outcomes", event.target.value)}
                placeholder="Example: improved response time, reduced repeat errors, kept records audit-ready"
                rows={4}
                className="w-full rounded-md border border-ink/15 bg-white px-4 py-3 text-ink outline-none transition focus:border-spruce focus:ring-4 focus:ring-mint"
              />
            </label>
          </div>
        )}

        {stepIndex === 5 && (
          <div>
            <div className="mb-4 rounded-md border border-ink/12 bg-paper/60 p-4 text-sm font-semibold text-ink/70">
              {selectedSummary}. Generated resume content stays neutral and unbranded.
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {templates.map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => onTemplateSelect(template)}
                  className={`min-h-40 rounded-md border bg-white p-5 text-left transition ${
                    selectedTemplate === template
                      ? "border-spruce shadow-soft ring-4 ring-mint"
                      : "border-ink/12 hover:border-spruce"
                  }`}
                >
                  <span className="text-lg font-bold text-ink">{template}</span>
                  <span className="mt-3 block text-sm leading-6 text-ink/68">{templateDescriptions[template]}</span>
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
            className="min-h-12 rounded-md border border-ink/15 bg-white px-6 font-bold text-ink transition hover:border-spruce disabled:cursor-not-allowed disabled:opacity-45"
          >
            Back
          </button>
          <button
            type="submit"
            className="min-h-12 rounded-md bg-ink px-6 font-bold text-white transition hover:bg-spruce"
          >
            {stepIndex === steps.length - 1 ? "Generate Resume Package" : "Continue"}
          </button>
        </div>
      </form>
    </section>
  );
}
