"use client";

import { useMemo, useState } from "react";
import {
  careerTargets,
  type CareerTarget,
  outcomeOptions,
  outcomeSuggestionsByFamily,
  responsibilitySuggestions,
  roleFamilies,
  scopePromptSets,
  templates
} from "@/lib/career-data";
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

type Question = {
  title: string;
  helper: string;
  validate: Array<keyof IntakeData>;
};

const requiredKeys: Array<keyof IntakeData> = ["fullName", "email", "targetJobTitle", "currentTitle"];

const questions: Question[] = [
  {
    title: "What's your full name?",
    helper: "This becomes the name line at the top of the resume dossier.",
    validate: ["fullName"]
  },
  {
    title: "What email should recruiters use?",
    helper: "Use the address you want on the final resume header.",
    validate: ["email"]
  },
  {
    title: "Want to add phone or portfolio?",
    helper: "Skip anything that does not apply. One clean link is enough.",
    validate: []
  },
  {
    title: "What role are you aiming for?",
    helper: "Search a specific title or type your own. Known titles map to the right role family automatically.",
    validate: ["targetJobTitle"]
  },
  {
    title: "Does this career lane look right?",
    helper: "This controls the responsibility chips, scope prompts, outcome suggestions, and ATS keyword logic.",
    validate: []
  },
  {
    title: "What's your current or most recent role?",
    helper: "Start with the role that should carry the most weight.",
    validate: ["currentTitle"]
  },
  {
    title: "Where did you do that work?",
    helper: "Company and dates help the resume read like a real work history.",
    validate: []
  },
  {
    title: "Add a previous role?",
    helper: "Skip if this does not apply. A short title, company, and date range is enough.",
    validate: []
  },
  {
    title: "Add one more role?",
    helper: "Optional. Use this for one extra job, campus role, internship, or relevant work experience.",
    validate: []
  },
  {
    title: "What tools or platforms did you use?",
    helper: "Plain language is fine. These become ATS-searchable skills when useful.",
    validate: []
  },
  {
    title: "What responsibilities did you actually handle?",
    helper: "Pick what fits, then add your own words. Career Forge will translate it.",
    validate: []
  },
  {
    title: "What kind of volume did you handle?",
    helper: "Estimate if you are not sure. Numbers help create stronger resume bullets.",
    validate: []
  },
  {
    title: "What did your work improve?",
    helper: "Select outcomes you can honestly stand behind.",
    validate: []
  },
  {
    title: "Pick your resume module style.",
    helper: "All three are single-column, ATS-safe, and neutral in exported resume content.",
    validate: []
  },
  {
    title: "Review the dossier.",
    helper: "Check the captured signals before generating the resume package.",
    validate: []
  }
];

const allScopeFields: Array<{ key: keyof IntakeData; label: string }> = [
  { key: "customersServed", label: "Customers/users" },
  { key: "ticketsHandled", label: "Tickets/requests" },
  { key: "projectsSupported", label: "Projects" },
  { key: "teamSizeSupported", label: "Team size" },
  { key: "callsHandled", label: "Calls/follow-ups" },
  { key: "reportsCreated", label: "Reports/docs" },
  { key: "revenueInfluenced", label: "Revenue/budget" }
];

const templateDescriptions: Record<TemplateStyle, string> = {
  Corporate: "Classic spacing and conservative headings for business-facing roles.",
  "Modern ATS": "Balanced whitespace with clean, readable section hierarchy.",
  "Tech ATS": "Compact and keyword-forward for tools, support workflows, and technical roles."
};

function formatList(items: string[]) {
  return items.filter(Boolean).join(", ") || "Not added yet";
}

export function IntakeForm({
  data,
  errors,
  selectedTemplate,
  onTemplateSelect,
  onChange,
  onValidate,
  onGenerate
}: IntakeFormProps) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [showAllScope, setShowAllScope] = useState(false);
  const [showAllOutcomes, setShowAllOutcomes] = useState(false);
  const question = questions[questionIndex];
  const suggestions = responsibilitySuggestions[data.roleFamily];
  const roleScopePrompts = scopePromptSets[data.roleFamily];
  const roleOutcomes = outcomeSuggestionsByFamily[data.roleFamily];
  const visibleOutcomes = showAllOutcomes ? outcomeOptions : roleOutcomes;
  const normalizedTargetQuery = data.targetJobTitle.trim().toLowerCase();
  const targetMatches = careerTargets
    .filter((target) => {
      if (!normalizedTargetQuery) return true;
      const title = target.title.toLowerCase();
      const family = target.roleFamily.toLowerCase();
      return title.includes(normalizedTargetQuery) || family.includes(normalizedTargetQuery);
    })
    .slice(0, 12);
  const progress = Math.round(((questionIndex + 1) / questions.length) * 100);
  const selectedSignals = data.selectedResponsibilities.length + data.selectedOutcomes.length;

  const roleSummary = useMemo(() => {
    const roles = [
      [data.currentTitle, data.currentCompany, data.currentTime],
      [data.previousTitle, data.previousCompany, data.previousTime],
      [data.additionalTitle, data.additionalCompany, data.additionalTime]
    ];

    return roles
      .filter(([title]) => title.trim())
      .map(([title, company, time]) => [title, company, time].filter(Boolean).join(" / "));
  }, [
    data.additionalCompany,
    data.additionalTime,
    data.additionalTitle,
    data.currentCompany,
    data.currentTime,
    data.currentTitle,
    data.previousCompany,
    data.previousTime,
    data.previousTitle
  ]);

  const scopeSummary = allScopeFields
    .map((field) => {
      const value = String(data[field.key]).trim();
      return value ? `${field.label}: ${value}` : "";
    })
    .filter(Boolean);

  function update<K extends keyof IntakeData>(key: K, value: IntakeData[K]) {
    onChange({ ...data, [key]: value });
  }

  function setRoleFamily(roleFamily: RoleFamily) {
    onChange({ ...data, roleFamily, selectedResponsibilities: [] });
  }

  function updateTargetRole(value: string) {
    const exactMatch =
      careerTargets.find((target) => target.title.toLowerCase() === value.trim().toLowerCase() && target.roleFamily === data.roleFamily) ??
      careerTargets.find((target) => target.title.toLowerCase() === value.trim().toLowerCase());

    onChange({
      ...data,
      targetJobTitle: value,
      ...(exactMatch ? { roleFamily: exactMatch.roleFamily, selectedResponsibilities: [] } : {})
    });
  }

  function selectCareerTarget(target: CareerTarget) {
    onChange({
      ...data,
      targetJobTitle: target.title,
      roleFamily: target.roleFamily,
      selectedResponsibilities: []
    });
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

  function renderScopeInput(field: { key: keyof IntakeData; label: string; placeholder?: string; hint?: string }) {
    return (
      <label key={field.key} className="block">
        <span className="mb-2 block text-sm font-semibold text-ink">{field.label}</span>
        {field.hint && <span className="mb-2 block text-sm leading-5 text-ink/60">{field.hint}</span>}
        <input
          type="text"
          value={String(data[field.key])}
          onChange={(event) => update(field.key, event.target.value as never)}
          placeholder={field.placeholder}
          className="trust-input min-h-12 w-full rounded-md border px-4 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
        />
      </label>
    );
  }

  function continueQuestion() {
    if (!onValidate(question.validate)) return;
    if (questionIndex < questions.length - 1) {
      setQuestionIndex(questionIndex + 1);
      window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
      return;
    }
    onGenerate();
  }

  function backQuestion() {
    setQuestionIndex(Math.max(0, questionIndex - 1));
    window.setTimeout(() => document.getElementById("intake")?.scrollIntoView(), 0);
  }

  function goToQuestion(index: number) {
    setQuestionIndex(index);
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

  function renderQuestion() {
    switch (questionIndex) {
      case 0:
        return renderField("fullName", "Full name", "Jordan Lee");
      case 1:
        return renderField("email", "Email", "jordan@email.com", "email");
      case 2:
        return (
          <div className="grid gap-5 md:grid-cols-2">
            {renderField("phone", "Phone number", "(555) 123-4567", "text", "Optional. Skip if you do not want it on the resume.")}
            {renderField("website", "Portfolio, LinkedIn, or website", "jordanlee.com", "text", "Optional. Add one clean link if it helps your candidacy.")}
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">
                Search or enter a target role <span className="text-coral">*</span>
              </span>
              <span className="mb-2 block text-sm leading-5 text-ink/60">
                Pick a known role for automatic mapping, or keep typing if your exact title is not listed.
              </span>
              <input
                type="text"
                value={data.targetJobTitle}
                onChange={(event) => updateTargetRole(event.target.value)}
                placeholder="Example: Help Desk Technician, Project Coordinator, Sales Coordinator"
                aria-invalid={Boolean(errors.targetJobTitle)}
                className={inputClass("targetJobTitle")}
              />
              {errors.targetJobTitle && (
                <span className="mt-2 block text-sm font-semibold text-coral">{errors.targetJobTitle}</span>
              )}
            </label>
            <div className="rounded-md border border-ink/10 bg-white p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-spruce">Career target database</p>
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink/50">
                  {careerTargets.length} mapped titles
                </span>
              </div>
              <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {targetMatches.map((target) => (
                  <button
                    key={`${target.title}-${target.roleFamily}`}
                    type="button"
                    onClick={() => selectCareerTarget(target)}
                    className={`rounded-md border p-3 text-left transition ${
                      data.targetJobTitle === target.title && data.roleFamily === target.roleFamily
                        ? "border-gold bg-gold/20"
                        : "border-ink/12 bg-paper/70 hover:border-spruce"
                    }`}
                  >
                    <span className="block text-sm font-bold text-ink">{target.title}</span>
                    <span className="mt-1 block text-xs font-black uppercase tracking-[0.12em] text-spruce">
                      Maps to {target.roleFamily}
                    </span>
                  </button>
                ))}
              </div>
              {!targetMatches.length && (
                <p className="text-sm leading-6 text-ink/65">
                  No exact catalog match. You can continue with this custom title and confirm the closest career lane next.
                </p>
              )}
            </div>
            <div className="rounded-md border border-cyan/20 bg-cyan/10 px-4 py-3 text-sm font-semibold text-ink">
              Current mapping: <span className="text-spruce">{data.roleFamily}</span>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div className="rounded-md border border-ink/10 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-spruce">Mapped role family</p>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Target role: <span className="font-bold text-ink">{data.targetJobTitle || "Not added yet"}</span>
              </p>
              <p className="mt-1 text-sm leading-6 text-ink/65">
                Current lane: <span className="font-bold text-ink">{data.roleFamily}</span>. Change it only if another lane fits your target better.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {roleFamilies.map((roleFamily) => (
                <button
                  key={roleFamily}
                  type="button"
                  onClick={() => setRoleFamily(roleFamily)}
                  className={`min-h-12 rounded-md border px-4 text-left text-sm font-bold transition ${
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
        );
      case 5:
        return renderField("currentTitle", "Current or most recent role", "Support Specialist");
      case 6:
        return (
          <div className="grid gap-5 md:grid-cols-2">
            {renderField("currentCompany", "Company", "Northstar Co.")}
            {renderField("currentTime", "Dates or time in role", "Jan 2024 - Present")}
          </div>
        );
      case 7:
        return (
          <div className="grid gap-5 md:grid-cols-3">
            {renderField("previousTitle", "Previous role", "Administrative Assistant", "text", "Skip if this does not apply.")}
            {renderField("previousCompany", "Company", "Bright Office Group")}
            {renderField("previousTime", "Dates or time in role", "Jun 2022 - Dec 2023")}
          </div>
        );
      case 8:
        return (
          <div className="grid gap-5 md:grid-cols-3">
            {renderField("additionalTitle", "Optional third role", "Campus Assistant", "text", "Skip if this does not apply.")}
            {renderField("additionalCompany", "Company", "City College")}
            {renderField("additionalTime", "Dates or time in role", "Sep 2021 - May 2022")}
          </div>
        );
      case 9:
        return renderField(
          "tools",
          "Tools, software, or platforms",
          "Zendesk, Salesforce, Excel, Notion",
          "text",
          "Use commas for multiple tools. Acronyms like CRM, ATS, SQL, IT, API, and KPI are normalized."
        );
      case 10:
        return (
          <div className="space-y-5">
            <div>
              <span className="mb-3 block text-sm font-bold text-ink">Select responsibilities that fit.</span>
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
              <span className="mb-2 block text-sm font-bold text-ink">Add your own words</span>
              <span className="mb-2 block text-sm leading-5 text-ink/60">
                Plain language is fine. Career Forge will translate it.
              </span>
              <textarea
                value={data.responsibilities}
                onChange={(event) => update("responsibilities", event.target.value)}
                placeholder="Example: helped customers, updated records, escalated issues, prepared reports"
                rows={5}
                className="trust-input w-full rounded-md border px-4 py-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
            </label>
          </div>
        );
      case 11:
        const additionalScopeFields = allScopeFields.filter(
          (field) => !roleScopePrompts.some((prompt) => prompt.key === field.key)
        );

        return (
          <div className="space-y-5">
            <div className="rounded-md border border-ink/10 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-spruce">
                Adaptive prompts for {data.roleFamily}
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                These are the scope signals most likely to strengthen this role family. Estimate if you are not sure.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {roleScopePrompts.map(renderScopeInput)}
            </div>
            <details
              open={showAllScope}
              onToggle={(event) => setShowAllScope(event.currentTarget.open)}
              className="rounded-md border border-ink/10 bg-white p-4"
            >
              <summary className="cursor-pointer text-sm font-black uppercase tracking-[0.12em] text-ink">
                Add more scope details
              </summary>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Use this only if another number helps tell the truth of your work.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {additionalScopeFields.map((field) => renderScopeInput({ ...field, placeholder: "Optional estimate" }))}
              </div>
            </details>
          </div>
        );
      case 12:
        return (
          <div className="space-y-5">
            <div className="rounded-md border border-ink/10 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-spruce">
                Suggested outcomes for {data.roleFamily}
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Pick what your work actually improved. You can expand the full outcome set if needed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleOutcomes.map((item) => (
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
            <button
              type="button"
              onClick={() => setShowAllOutcomes((value) => !value)}
              className="rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-black uppercase tracking-[0.12em] text-ink transition hover:border-gold"
            >
              {showAllOutcomes ? "Show suggested outcomes" : "Show all outcomes"}
            </button>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">Any result you want reflected?</span>
              <span className="mb-2 block text-sm leading-5 text-ink/60">
                This can be informal: faster replies, fewer mistakes, happier customers, cleaner records.
              </span>
              <textarea
                value={data.outcomes}
                onChange={(event) => update("outcomes", event.target.value)}
                placeholder="Example: improved response time, reduced repeat errors, kept records audit-ready"
                rows={4}
                className="trust-input w-full rounded-md border px-4 py-3 text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
            </label>
          </div>
        );
      case 13:
        return (
          <div className="grid gap-4 md:grid-cols-3">
            {templates.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => onTemplateSelect(template)}
                className={`min-h-36 rounded-md border bg-white p-5 text-left transition ${
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
        );
      default:
        return (
          <div className="grid gap-3 md:grid-cols-2">
            <ReviewItem label="Contact" value={[data.fullName, data.email, data.phone, data.website].filter(Boolean).join(" / ")} onEdit={() => goToQuestion(0)} />
            <ReviewItem label="Selected target role" value={data.targetJobTitle || "Not added yet"} onEdit={() => goToQuestion(3)} />
            <ReviewItem label="Mapped role family" value={data.roleFamily} onEdit={() => goToQuestion(4)} />
            <ReviewItem label="Roles" value={formatList(roleSummary)} onEdit={() => goToQuestion(5)} />
            <ReviewItem label="Tools" value={data.tools || "Not added yet"} onEdit={() => goToQuestion(9)} />
            <ReviewItem
              label="Responsibilities"
              value={formatList([...data.selectedResponsibilities, data.responsibilities])}
              onEdit={() => goToQuestion(10)}
            />
            <ReviewItem label="Scope" value={formatList(scopeSummary)} onEdit={() => goToQuestion(11)} />
            <ReviewItem
              label="Outcomes"
              value={formatList([...data.selectedOutcomes, data.outcomes])}
              onEdit={() => goToQuestion(12)}
            />
            <ReviewItem
              label="Adaptive signals"
              value={`${data.roleFamily} scope prompts / ${roleOutcomes.join(", ")}`}
              onEdit={() => goToQuestion(4)}
            />
            <ReviewItem label="Template" value={selectedTemplate} onEdit={() => goToQuestion(13)} />
          </div>
        );
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8" id="intake">
      <form
        className="trust-panel rounded-md p-5 shadow-glow sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          continueQuestion();
        }}
      >
        <div className="mb-6 border-b border-white/10 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="trust-kicker text-sm font-bold uppercase">
              Question {String(questionIndex + 1).padStart(2, "0")} / {questions.length}
            </p>
            <span className="rounded-md border border-cyan/25 bg-cyan/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan">
              career://interview
            </span>
          </div>
          <div className="mt-5 h-1.5 rounded-full bg-white/10">
            <div className="h-1.5 rounded-full bg-cyan transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="rounded-md border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gold">Module 05 intake</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-paper">{question.title}</h2>
            <p className="mt-4 text-sm leading-6 text-paper/68">{question.helper}</p>
            <p className="mt-5 rounded-md border border-cyan/20 bg-cyan/10 px-3 py-2 text-sm font-semibold text-cyan">
              {questionIndex === questions.length - 1
                ? `${selectedSignals} guided signals captured. Review before generating.`
                : "One answer at a time. Short notes are enough."}
            </p>
          </aside>

          <div className="dark-form-card rounded-md p-4 sm:p-5">
            {renderQuestion()}
            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={backQuestion}
                disabled={questionIndex === 0}
                className="min-h-12 rounded-md border border-ink/15 bg-white px-6 font-bold text-ink transition hover:border-gold disabled:cursor-not-allowed disabled:opacity-45"
              >
                Back
              </button>
              <button
                type="submit"
                className="min-h-12 rounded-md bg-ink px-6 font-bold text-paper transition hover:bg-gold hover:text-ink"
              >
                {questionIndex === questions.length - 1 ? "Generate Resume Package" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}

function ReviewItem({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="rounded-md border border-ink/10 bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-spruce">{label}</h3>
        <button type="button" onClick={onEdit} className="text-xs font-black uppercase tracking-[0.12em] text-ink hover:text-spruce">
          Edit
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink/72">{value || "Not added yet"}</p>
    </div>
  );
}
