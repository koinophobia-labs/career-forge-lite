"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { isProfileComplete } from "@/lib/command-center-store";
import {
  appendLine,
  appendSentence,
  applyStarterPack,
  assessProfile,
  constraintPhrases,
  proofPointPhrases,
  situationPhrases,
  skillPhrases,
  starterPacks,
  strengthPhrases,
  targetRolePhrases,
  workStylePhrases
} from "@/lib/input-guidance";
import { useCommandCenter } from "@/lib/use-command-center";
import type { CareerProfile } from "@/types/command-center";

type ThinFlagProps = {
  message?: string;
  severity?: "warn" | "info";
};

function ThinFlag({ message, severity }: ThinFlagProps) {
  if (!message) return null;
  return (
    <span
      className={`lab-mono ml-2 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase ${
        severity === "warn" ? "border-gold/50 bg-gold/10 text-gold" : "border-white/20 text-paper/45"
      }`}
      title={message}
    >
      {severity === "warn" ? "needs more" : "optional"}
    </span>
  );
}

type PhraseChipsProps = {
  phrases: string[];
  current: string;
  onPick: (phrase: string) => void;
};

function PhraseChips({ phrases, current, onPick }: PhraseChipsProps) {
  const remaining = phrases.filter((phrase) => !current.toLowerCase().includes(phrase.toLowerCase().replace(/[.]$/, "")));
  if (!remaining.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {remaining.map((phrase) => (
        <button
          key={phrase}
          type="button"
          onClick={() => onPick(phrase)}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-left text-xs font-bold leading-4 text-paper/60 transition hover:border-cyan hover:text-cyan"
        >
          + {phrase}
        </button>
      ))}
    </div>
  );
}

type FieldProps = {
  label: string;
  hint: string;
  value: string;
  rows?: number;
  placeholder: string;
  flag?: { message: string; severity: "warn" | "info" };
  showFlag: boolean;
  phrases?: string[];
  phraseMode?: "sentence" | "line";
  onChange: (value: string) => void;
};

function TextField({ label, hint, value, rows = 3, placeholder, flag, showFlag, phrases, phraseMode = "sentence", onChange }: FieldProps) {
  return (
    <div>
      <label className="block">
        <span className="text-sm font-bold text-paper">
          {label}
          {showFlag && <ThinFlag message={flag?.message} severity={flag?.severity} />}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-paper/55">{hint}</span>
        {showFlag && flag?.severity === "warn" && (
          <span className="mt-1 block text-xs leading-5 text-gold/90">{flag.message}</span>
        )}
        <textarea
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
        />
      </label>
      {phrases && (
        <PhraseChips
          phrases={phrases}
          current={value}
          onPick={(phrase) => onChange(phraseMode === "line" ? appendLine(value, phrase) : appendSentence(value, phrase))}
        />
      )}
    </div>
  );
}

type ChipFieldProps = {
  label: string;
  hint: string;
  values: string[];
  suggestions: string[];
  placeholder: string;
  flag?: { message: string; severity: "warn" | "info" };
  showFlag: boolean;
  onChange: (values: string[]) => void;
};

function ChipField({ label, hint, values, suggestions, placeholder, flag, showFlag, onChange }: ChipFieldProps) {
  const [draft, setDraft] = useState("");

  function add(value: string) {
    const cleaned = value.trim();
    if (!cleaned || values.some((item) => item.toLowerCase() === cleaned.toLowerCase())) return;
    onChange([...values, cleaned]);
  }

  return (
    <div>
      <span className="text-sm font-bold text-paper">
        {label}
        {showFlag && <ThinFlag message={flag?.message} severity={flag?.severity} />}
      </span>
      <span className="mt-0.5 block text-xs leading-5 text-paper/55">{hint}</span>
      {showFlag && flag?.severity === "warn" && <span className="mt-1 block text-xs leading-5 text-gold/90">{flag.message}</span>}
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold transition hover:border-coral hover:text-coral"
              title="Remove"
            >
              {value} ×
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(draft);
              setDraft("");
            }
          }}
          className="trust-input w-full border px-3 py-2.5 text-sm text-ink"
        />
        <button
          type="button"
          onClick={() => {
            add(draft);
            setDraft("");
          }}
          className="rounded-md bg-gold px-4 text-sm font-black text-ink transition hover:bg-cyan"
        >
          Add
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestions
          .filter((suggestion) => !values.some((value) => value.toLowerCase() === suggestion.toLowerCase()))
          .slice(0, 12)
          .map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-bold text-paper/60 transition hover:border-cyan hover:text-cyan"
            >
              + {suggestion}
            </button>
          ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { state, update, hydrated } = useCommandCenter();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [appliedPack, setAppliedPack] = useState<string | null>(null);
  const profile = state.profile;

  function setProfile(patch: Partial<CareerProfile>) {
    update((current) => ({
      ...current,
      profile: { ...current.profile, ...patch, updatedAt: new Date().toISOString() }
    }));
    setSavedAt(new Date().toLocaleTimeString());
  }

  function applyPackByKey(key: string) {
    const pack = starterPacks.find((item) => item.key === key);
    if (!pack) return;
    update((current) => ({ ...current, profile: applyStarterPack(current.profile, pack) }));
    setAppliedPack(pack.label);
    setSavedAt(new Date().toLocaleTimeString());
  }

  const issues = useMemo(() => assessProfile(profile), [profile]);
  const flagFor = (field: keyof CareerProfile) => issues.find((issue) => issue.field === field);
  const warnCount = issues.filter((issue) => issue.severity === "warn").length;
  const complete = isProfileComplete(profile);

  return (
    <main>
      <CommandNav active="/profile" />

      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Step 01 · Positioning source</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Your career profile</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          Write this once, honestly. Every target lane, tailored resume, outreach message, and interview question pulls
          from what you put here. Changes save automatically to this device — nothing is uploaded.
        </p>

        <div className="mt-8 rounded-xl border border-cyan/25 bg-cyan/10 p-4 sm:p-5">
          <p className="trust-kicker text-xs font-bold uppercase">Start from your background</p>
          <p className="mt-2 text-sm leading-6 text-paper/72">
            Pick every background that applies — each one seeds your situation, skills, strengths, and proof points with
            honest starting language. Then edit: keep only what’s true for you, and add your own real numbers and
            details. Nothing here invents credentials or history.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {starterPacks.map((pack) => (
              <button
                key={pack.key}
                type="button"
                onClick={() => applyPackByKey(pack.key)}
                className="rounded-full border border-cyan/35 bg-cyan/10 px-3 py-1.5 text-xs font-bold text-cyan transition hover:border-gold hover:text-gold"
              >
                + {pack.label}
              </button>
            ))}
          </div>
          {appliedPack && (
            <p className="mt-3 text-xs leading-5 text-paper/60">
              Added the <span className="font-bold text-cyan">{appliedPack}</span> starter language below. Read each
              field and delete anything that isn’t actually you.
            </p>
          )}
        </div>

        <div className="trust-panel mt-6 grid gap-7 p-5 sm:p-7">
          <TextField
            label="Current situation"
            hint="Where you are and where you're headed, in one or two honest sentences. Tap a phrase to start, then make it yours."
            value={profile.currentSituation}
            placeholder="e.g., I'm transitioning from sportsbook operations into fraud/risk or AI support, while building a software company on the side."
            flag={flagFor("currentSituation")}
            showFlag={hydrated}
            phrases={situationPhrases}
            onChange={(value) => setProfile({ currentSituation: value })}
          />

          <TextField
            label="Target roles"
            hint="The role types you're pursuing — you'll turn these into structured lanes next. Tap to add."
            value={profile.targetRoles}
            rows={2}
            placeholder="e.g., AI Support Specialist, Trust & Safety Analyst, Fraud/Risk Operations, Product Support"
            flag={flagFor("targetRoles")}
            showFlag={hydrated}
            phrases={targetRolePhrases}
            onChange={(value) => setProfile({ targetRoles: value })}
          />

          <ChipField
            label="Transferable skills"
            hint="Skills that carry across industries. Aim for at least 5 — the tailoring engine matches these against every job post you analyze."
            values={profile.transferableSkills}
            suggestions={skillPhrases}
            placeholder="Type a skill and press Enter"
            flag={flagFor("transferableSkills")}
            showFlag={hydrated}
            onChange={(values) => setProfile({ transferableSkills: values })}
          />

          <TextField
            label="Experience summary"
            hint="Your work history in plain language — roles, industries, scale, what you were trusted with. Raw material, not resume copy. Real numbers make everything downstream sharper."
            value={profile.experienceSummary}
            rows={5}
            placeholder="e.g., Several years in sportsbook operations: high-pressure customer situations, policy enforcement, payments and tickets, escalations. Before that, retail — handled 50+ customers a day and trained new hires."
            flag={flagFor("experienceSummary")}
            showFlag={hydrated}
            onChange={(value) => setProfile({ experienceSummary: value })}
          />

          <ChipField
            label="Strengths"
            hint="What people who've worked with you would actually say. These become behavioral interview questions, so pick ones you can back with a story."
            values={profile.strengths}
            suggestions={strengthPhrases}
            placeholder="Type a strength and press Enter"
            flag={flagFor("strengths")}
            showFlag={hydrated}
            onChange={(values) => setProfile({ strengths: values })}
          />

          <TextField
            label="Proof points"
            hint="One line per piece of concrete evidence: shipped products, testing loops, AI workflows, metrics, artifacts. Interview prep quizzes you on each line — so only write what you can defend."
            value={profile.proofPoints}
            rows={5}
            placeholder={"e.g.,\nShipped a product to TestFlight and ran feedback loops with real testers\nHandled payout disputes under strict policy without losing customers\nBuilt the prompt workflows I use daily"}
            flag={flagFor("proofPoints")}
            showFlag={hydrated}
            phrases={proofPointPhrases}
            phraseMode="line"
            onChange={(value) => setProfile({ proofPoints: value })}
          />

          <TextField
            label="Constraints"
            hint="Non-negotiables that shape what you apply to. Being clear here saves wasted applications."
            value={profile.constraints}
            rows={2}
            placeholder="e.g., I need a salaried role with benefits, and room to keep building my product outside work hours."
            flag={flagFor("constraints")}
            showFlag={hydrated}
            phrases={constraintPhrases}
            onChange={(value) => setProfile({ constraints: value })}
          />

          <TextField
            label="Preferred work style"
            hint="How you work best — used for screening roles and answering culture questions."
            value={profile.workStyle}
            rows={2}
            placeholder="e.g., I work best with clear goals and independent execution, and I stay steady under escalation."
            flag={flagFor("workStyle")}
            showFlag={hydrated}
            phrases={workStylePhrases}
            onChange={(value) => setProfile({ workStyle: value })}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/5 p-4">
          <p className="text-sm text-paper/68">
            {!hydrated
              ? "Loading…"
              : complete && warnCount === 0
                ? "Profile is strong — lanes, tailoring, and interview prep all have real material to work with."
                : complete
                  ? `Profile works, with ${warnCount} section${warnCount === 1 ? "" : "s"} that could be stronger.`
                  : "Minimum for tailoring: situation, target roles, 3+ transferable skills, and an experience summary."}
            {savedAt && <span className="lab-mono ml-2 text-xs text-paper/45">Saved {savedAt}</span>}
          </p>
          <Link href="/targets" className="lab-pill-button px-5 py-2.5 text-sm font-black transition">
            Next: pick target lanes →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
