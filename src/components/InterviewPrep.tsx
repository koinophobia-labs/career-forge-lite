"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { isProfileStarted } from "@/lib/command-center-store";
import { answerScaffold, scaffoldTemplate } from "@/lib/input-guidance";
import {
  coachAnswer,
  generateInterviewPrep,
  loadPrepDraft,
  resolvePrepLane,
  savePrepDraft,
  type CoachingFeedback,
  type PrepCategory,
  type PrepQuestion
} from "@/lib/interview-prep";
import { useCommandCenter } from "@/lib/use-command-center";

const categoryMeta: Record<PrepCategory, { label: string; blurb: string }> = {
  transition: {
    label: "Transition framing",
    blurb: "The career-changer questions. Nail these two and every other answer gets easier."
  },
  role: {
    label: "Role-specific",
    blurb: "What interviewers for this lane actually ask, with coaching on how your background answers it."
  },
  behavioral: {
    label: "Behavioral — from your own claims",
    blurb: "Built from your approved evidence, proof points, strengths, and skills. If it's on your resume, expect the deep-dive."
  },
  gap_defense: {
    label: "Gap defense",
    blurb: "The uncomfortable questions about what you don't have yet. Rehearsed honesty beats improvised bluffing."
  },
  discovery: {
    label: "Needs more evidence",
    blurb: "Claims and self-reported strengths that aren't backed by enough recorded detail yet to defend in an interview. These are reminders to go add evidence, not questions to rehearse an answer for."
  }
};

const categoryOrder: PrepCategory[] = ["transition", "role", "behavioral", "gap_defense", "discovery"];

type QuestionCardProps = {
  question: PrepQuestion;
};

function QuestionCard({ question }: QuestionCardProps) {
  const [open, setOpen] = useState(false);
  // Drafts persist per question text; the textarea only renders after an
  // explicit click, so the lazy localStorage read can't cause a hydration
  // mismatch.
  const [answer, setAnswer] = useState(() => loadPrepDraft(question.question));
  const [feedback, setFeedback] = useState<CoachingFeedback[] | null>(null);

  return (
    <article className="rounded-xl border border-white/12 bg-obsidian/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm font-bold leading-6 text-paper">{question.question}</p>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold text-paper/60 transition hover:border-cyan hover:text-cyan"
        >
          {open ? "Collapse" : "Practice"}
        </button>
      </div>
      <p className="mt-2 text-[0.78rem] leading-5 text-paper/55">
        <span className="font-bold text-cyan">Why they ask: </span>
        {question.why}
      </p>

      {open && (
        <div className="mt-4 grid gap-4 border-t border-white/10 pt-4">
          <div>
            <p className="lab-mono text-[0.68rem] font-bold uppercase text-gold">How to answer this honestly</p>
            <ul className="mt-1.5 grid gap-1.5">
              {question.coaching.map((tip) => (
                <li key={tip} className="text-[0.8rem] leading-5 text-paper/70">
                  · {tip}
                </li>
              ))}
            </ul>
            <p className="lab-mono mt-2 text-[0.62rem] font-bold uppercase text-paper/40">Based on: {question.basedOn}</p>
          </div>

          <div>
            <p className="lab-mono text-[0.68rem] font-bold uppercase text-cyan">
              {question.category === "gap_defense"
                ? "Structure: acknowledge → situation → action → result → plan"
                : question.category === "discovery"
                  ? "This isn't ready to rehearse — go find or record the real example first"
                  : "Structure: situation → action → result"}
            </p>
            <ul className="mt-1.5 grid gap-1">
              {answerScaffold(question.category).map((line) => (
                <li key={line} className="text-[0.75rem] leading-5 text-paper/55">
                  · {line}
                </li>
              ))}
            </ul>
            <label className="mt-3 block">
              <span className="text-sm font-bold text-paper">Draft your answer</span>
              <textarea
                value={answer}
                rows={6}
                placeholder="Write it the way you'd say it out loud — or insert the structure below and fill in each line."
                onChange={(event) => {
                  setAnswer(event.target.value);
                  savePrepDraft(question.question, event.target.value);
                  setFeedback(null);
                }}
                className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {!answer.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setAnswer(scaffoldTemplate(question.category));
                    savePrepDraft(question.question, scaffoldTemplate(question.category));
                  }}
                  className="rounded-md border border-cyan/40 bg-cyan/10 px-4 py-2 text-sm font-bold text-cyan transition hover:border-gold hover:text-gold"
                >
                  Insert answer structure
                </button>
              )}
              <button
                type="button"
                onClick={() => setFeedback(coachAnswer(answer, question))}
                disabled={!answer.trim()}
                className="rounded-md bg-gold px-4 py-2 text-sm font-black text-ink transition hover:bg-cyan disabled:cursor-not-allowed disabled:opacity-40"
              >
                Coach my answer
              </button>
            </div>

            {feedback && (
              <ul className="mt-3 grid gap-2">
                {feedback.map((item) => (
                  <li
                    key={item.message}
                    className={`rounded-lg border p-3 text-[0.8rem] leading-5 ${
                      item.tone === "good"
                        ? "border-spruce/50 bg-mint/10 text-mint"
                        : "border-gold/40 bg-gold/10 text-paper/80"
                    }`}
                  >
                    <span className="lab-mono mr-2 text-[0.62rem] font-bold uppercase">
                      {item.tone === "good" ? "Keep" : "Fix"}
                    </span>
                    {item.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

type InterviewPrepProps = {
  onSwitchToIntake: () => void;
};

export function InterviewPrep({ onSwitchToIntake }: InterviewPrepProps) {
  const { state, hydrated } = useCommandCenter();
  const [laneId, setLaneId] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const defaultLane = useMemo(() => {
    const interviewing = state.applications.find((app) => app.status === "interviewing" && app.laneId);
    if (interviewing) {
      const lane = state.lanes.find((item) => item.id === interviewing.laneId);
      if (lane) return lane;
    }
    return state.lanes.find((lane) => lane.status === "active") ?? state.lanes[0] ?? null;
  }, [state.lanes, state.applications]);

  const defaultApplication = useMemo(
    () => state.applications.find((app) => app.status === "interviewing") ?? null,
    [state.applications]
  );
  const selectedApplication =
    applicationId === null
      ? defaultApplication
      : (state.applications.find((app) => app.id === applicationId) ?? null);

  // The selected application's lane wins over the active-lane default so the
  // questions target the role actually being interviewed; picking a lane by
  // hand still overrides.
  const selectedLane = resolvePrepLane(state.lanes, laneId, selectedApplication, defaultLane);
  const laneMismatch =
    Boolean(selectedApplication?.laneId) &&
    selectedLane?.id !== selectedApplication?.laneId &&
    state.lanes.some((lane) => lane.id === selectedApplication?.laneId);

  const pack = useMemo(
    () => generateInterviewPrep(state.profile, selectedLane, selectedApplication, state.dossier),
    [state.profile, selectedLane, selectedApplication, state.dossier]
  );

  const grouped = useMemo(
    () =>
      categoryOrder
        .map((category) => ({
          category,
          questions: pack.questions.filter((question) => question.category === category)
        }))
        .filter((group) => group.questions.length > 0),
    [pack]
  );

  const setupNeeded = hydrated && !isProfileStarted(state.profile) && !state.lanes.length;

  return (
    <main>
      <CommandNav active="/interview" />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="trust-kicker text-sm font-bold uppercase">Step 06 · Interview prep</p>
            <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Practice the interview you’ll actually get.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
              Questions generated from your lane, your profile’s proof points, and the gaps your job-post analysis
              found — with coaching that pushes you toward specific, honest answers. No invented credentials, ever.
            </p>
          </div>
          <div className="max-w-64 text-right">
            <button
              type="button"
              onClick={onSwitchToIntake}
              className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-paper/70 transition hover:border-cyan hover:text-cyan"
            >
              Build a résumé by conversation instead →
            </button>
            <p className="mt-1.5 text-[0.7rem] leading-4 text-paper/45">
              Opens the capped résumé-building intake. This prep page is the uncapped practice tool.
            </p>
          </div>
        </div>

        {setupNeeded && (
          <div className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-6 text-paper/75">
            Prep gets sharp once it has material. Start with your{" "}
            <Link href="/profile" className="font-bold text-gold underline-offset-2 hover:underline">
              profile
            </Link>{" "}
            and pick a{" "}
            <Link href="/targets" className="font-bold text-gold underline-offset-2 hover:underline">
              target lane
            </Link>{" "}
            — the generic questions below will become lane- and proof-specific.
          </div>
        )}

        <div className="trust-panel mt-8 flex flex-wrap items-end gap-3 p-5">
          <label className="min-w-52 flex-1">
            <span className="text-sm font-bold text-paper">Lane</span>
            <select
              value={selectedLane?.id ?? ""}
              onChange={(event) => setLaneId(event.target.value || "none")}
              className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
            >
              <option value="">No lane (generic prep)</option>
              {state.lanes.map((lane) => (
                <option key={lane.id} value={lane.id}>
                  {lane.title} ({lane.status})
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-52 flex-1">
            <span className="text-sm font-bold text-paper">Application (optional)</span>
            <select
              value={selectedApplication?.id ?? ""}
              onChange={(event) => {
                setApplicationId(event.target.value || "none");
                // A newly-picked application brings its own lane; clear any
                // stale manual lane choice so the application's lane wins.
                setLaneId(null);
              }}
              className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
            >
              <option value="">No specific application</option>
              {state.applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.roleTitle} · {app.company} ({app.status})
                </option>
              ))}
            </select>
          </label>
          <div className="min-w-52 flex-1 text-[0.78rem] leading-5 text-paper/55">
            {selectedApplication
              ? selectedApplication.analysisGaps.length
                ? `Using the saved job-post analysis for ${selectedApplication.company} — gap-defense questions below come from that posting.`
                : `${selectedApplication.company} has no saved analysis. Run it through the tailoring engine to unlock posting-specific gap defense.`
              : "Pick a saved application to get gap-defense questions built from its actual job post."}
          </div>
        </div>

        {laneMismatch && selectedApplication && (
          <div className="mt-3 rounded-lg border border-gold/40 bg-gold/10 p-3 text-[0.8rem] leading-5 text-paper/80">
            This application targets the{" "}
            <span className="font-bold text-gold">
              {state.lanes.find((lane) => lane.id === selectedApplication.laneId)?.title}
            </span>{" "}
            lane, but questions below use{" "}
            <span className="font-bold text-gold">{selectedLane ? selectedLane.title : "no lane"}</span>. Set the lane
            picker back to match the application unless the switch is deliberate.
          </div>
        )}

        <div className="mt-6 rounded-xl border border-cyan/25 bg-cyan/10 p-4 sm:p-5">
          <p className="trust-kicker text-xs font-bold uppercase">Answer framework</p>
          <ol className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
            {pack.answerFramework.map((step) => (
              <li key={step} className="text-[0.78rem] leading-5 text-paper/72">
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-white/10 pt-3 text-[0.78rem] leading-5 text-paper/60">{pack.honestyNote}</p>
        </div>

        {hydrated &&
          grouped.map((group) => (
            <div key={group.category} className="mt-8">
              <h2 className="text-xl font-bold text-paper">{categoryMeta[group.category].label}</h2>
              <p className="mt-1 text-sm text-paper/60">{categoryMeta[group.category].blurb}</p>
              <div className="mt-4 grid gap-3">
                {group.questions.map((question) => (
                  <QuestionCard key={`${group.category}-${question.id}-${question.question.slice(0, 24)}`} question={question} />
                ))}
              </div>
            </div>
          ))}

        {hydrated && pack.reverseQuestions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-paper">Questions to ask the interviewer</h2>
            <p className="mt-1 text-sm text-paper/60">
              Interviews end with “any questions for us?” — bring these. Specific ones come from your saved posting
              and lane; the generic staples work anywhere.
            </p>
            <div className="mt-4 grid gap-3">
              {pack.reverseQuestions.map((item) => (
                <article key={item.question} className="rounded-xl border border-white/12 bg-obsidian/40 p-4 sm:p-5">
                  <p className="max-w-3xl text-sm font-bold leading-6 text-paper">{item.question}</p>
                  <p className="mt-2 text-[0.78rem] leading-5 text-paper/55">
                    <span className="font-bold text-cyan">Why it works: </span>
                    {item.why}
                  </p>
                  <p className="lab-mono mt-2 text-[0.62rem] font-bold uppercase text-paper/40">Based on: {item.basedOn}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
