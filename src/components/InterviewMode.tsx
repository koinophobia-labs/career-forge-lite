"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  canGenerateResumeFromInterview,
  convertInterviewDraftToExistingResumeInput,
  createAssistantInterviewMessage,
  createInitialInterviewSession,
  createUserInterviewMessage,
  getMissingOrWeakFields,
  getNextAssistantQuestion,
  interviewStages,
  updateInterviewDraftFromUserAnswer
} from "@/lib/interview-mode";
import { generateResumePackage } from "@/lib/generator";
import type { InterviewSession } from "@/types/interview";

function statusTone(status: string) {
  if (status === "strong") return "border-cyan/35 bg-cyan/10 text-cyan";
  if (status === "usable") return "border-gold/35 bg-gold/10 text-gold";
  if (status === "weak") return "border-ember/35 bg-ember/10 text-ember";
  return "border-white/10 bg-white/5 text-paper/55";
}

export function InterviewMode() {
  const [session, setSession] = useState<InterviewSession>(() => createInitialInterviewSession());
  const [input, setInput] = useState("");
  const [generatedNote, setGeneratedNote] = useState("");

  const currentStage = useMemo(
    () => interviewStages.find((stage) => stage.id === session.currentStage) ?? interviewStages[0],
    [session.currentStage]
  );
  const missingFields = useMemo(() => getMissingOrWeakFields(session), [session]);
  const canGenerate = canGenerateResumeFromInterview(session);
  const statusCounts = useMemo(
    () =>
      session.fieldStatuses.reduce(
        (counts, field) => ({ ...counts, [field.status]: counts[field.status] + 1 }),
        { empty: 0, weak: 0, usable: 0, strong: 0 }
      ),
    [session.fieldStatuses]
  );
  const draftPreview = useMemo(
    () => [
      ["Target role", session.resumeDraft.targetRole],
      ["Responsibilities", session.resumeDraft.responsibilities.join(", ")],
      ["Achievements", session.resumeDraft.achievements.join(", ")],
      ["Metrics", session.resumeDraft.metrics.join(", ")],
      ["Tools", session.resumeDraft.tools.join(", ")],
      ["Skills", session.resumeDraft.skills.join(", ")],
      ["Projects", session.resumeDraft.projects.join(", ")]
    ],
    [session.resumeDraft]
  );

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content) return;

    const userMessage = createUserInterviewMessage(content);
    const updated = updateInterviewDraftFromUserAnswer(session, userMessage);
    const nextPrompt = getNextAssistantQuestion(updated);
    const nextSession: InterviewSession = {
      ...updated,
      messages: [...updated.messages, createAssistantInterviewMessage(nextPrompt)]
    };

    setSession(nextSession);
    setInput("");
    setGeneratedNote("");
  }

  function handleGenerate() {
    if (!canGenerate) return;
    const intake = convertInterviewDraftToExistingResumeInput(session);
    const resume = generateResumePackage(intake);
    setGeneratedNote(`Resume package is ready for ${resume.linkedinHeadline}. Full review wiring comes next.`);
  }

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="Back to Career Forge Lite">
            <span className="logo-mark" aria-hidden="true">
              CF
            </span>
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.18em] text-gold">Career Forge Lite</span>
              <span className="block text-[0.68rem] font-bold uppercase tracking-[0.22em] text-paper/56">
                Interview Mode Preview
              </span>
            </span>
          </Link>
          <span className="rounded-md border border-cyan/25 bg-cyan/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan">
            Premium Preview / No Paywall
          </span>
        </div>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="trust-panel rounded-md p-5 sm:p-7">
            <p className="trust-kicker text-xs font-black uppercase">career://interview-mode</p>
            <h1 className="mt-3 text-3xl font-bold text-paper sm:text-5xl">Career Forge Interview Mode</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-paper/70">
              Answer questions conversationally. Career Forge will pull resume-ready material from your answers and map it
              into the same ATS-safe resume structure used by the current builder.
            </p>

            <div className="mt-7 rounded-md border border-white/10 bg-obsidian/45">
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-paper/50">Current stage</p>
                <h2 className="mt-1 text-lg font-bold text-paper">{currentStage.label}</h2>
                <p className="mt-1 text-sm leading-6 text-paper/60">{currentStage.goal}</p>
              </div>

              <div className="max-h-[31rem] space-y-3 overflow-y-auto px-4 py-4">
                {session.messages.map((message) => (
                  <article
                    key={message.id}
                    className={`max-w-[88%] rounded-md border px-4 py-3 ${
                      message.role === "assistant"
                        ? "border-cyan/20 bg-cyan/10 text-paper"
                        : "ml-auto border-gold/20 bg-gold/10 text-paper"
                    }`}
                  >
                    <p className="mb-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-paper/42">
                      {message.role === "assistant" ? "Career Forge" : "You"}
                    </p>
                    <p className="text-sm leading-6">{message.content}</p>
                  </article>
                ))}
              </div>

              <form onSubmit={handleSend} className="border-t border-white/10 p-4">
                <label htmlFor="interview-answer" className="text-xs font-black uppercase tracking-[0.14em] text-paper/55">
                  Your answer
                </label>
                <textarea
                  id="interview-answer"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={4}
                  placeholder="Plain language is fine. Career Forge will translate it."
                  className="mt-2 w-full rounded-md border border-white/12 bg-white/8 px-4 py-3 text-sm leading-6 text-paper outline-none transition placeholder:text-paper/35 focus:border-cyan"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-paper/55">Estimate if you are not sure. Short answers are okay for this preview.</p>
                  <button
                    type="submit"
                    className="min-h-11 rounded-md bg-gold px-5 text-sm font-black text-ink transition hover:bg-cyan"
                  >
                    Send Answer
                  </button>
                </div>
              </form>
            </div>
          </div>

          <aside className="trust-panel rounded-md p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-paper/52">Resume readiness</p>
            <div className="mt-3 h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-cyan transition-all"
                style={{ width: `${session.resumeDraft.confidenceScore}%` }}
              />
            </div>
            <p className="mt-2 text-sm font-bold text-cyan">{session.resumeDraft.confidenceScore}% structured signal</p>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[0.65rem] font-black uppercase tracking-[0.12em]">
              {[
                ["Strong", statusCounts.strong, "text-cyan"],
                ["Usable", statusCounts.usable, "text-gold"],
                ["Weak", statusCounts.weak, "text-ember"],
                ["Empty", statusCounts.empty, "text-paper/45"]
              ].map(([label, count, tone]) => (
                <div key={label} className="rounded-md border border-white/10 bg-white/5 px-2 py-2">
                  <span className={`block text-lg ${tone}`}>{count}</span>
                  <span className="text-paper/45">{label}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2">
              {session.fieldStatuses.map((field) => (
                <div key={String(field.fieldKey)} className={`rounded-md border px-3 py-2 ${statusTone(field.status)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-paper">{field.label}</span>
                    <span className="text-[0.65rem] font-black uppercase tracking-[0.14em]">{field.status}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-paper/58">{field.notes}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-md border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-bold text-paper">Missing or weak fields</h2>
              {missingFields.length ? (
                <ul className="mt-3 space-y-2 text-sm text-paper/65">
                  {missingFields.map((field) => (
                    <li key={String(field.fieldKey)}>{field.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-cyan">Minimum interview signal is ready.</p>
              )}
            </div>

            <details className="mt-4 rounded-md border border-white/10 bg-white/5 p-4">
              <summary className="cursor-pointer text-sm font-bold text-paper">Extracted draft preview</summary>
              <div className="mt-4 space-y-3">
                {draftPreview.map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-paper/42">{label}</p>
                    <p className="mt-1 text-sm leading-6 text-paper/70">{value || "Not captured yet"}</p>
                  </div>
                ))}
              </div>
            </details>

            <button
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerate}
              className="mt-5 min-h-12 w-full rounded-md bg-gold px-5 text-sm font-black text-ink transition hover:bg-cyan disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-paper/35"
            >
              Generate Resume
            </button>
            {generatedNote && <p className="mt-3 rounded-md border border-cyan/20 bg-cyan/10 p-3 text-sm text-cyan">{generatedNote}</p>}
          </aside>
        </section>
      </div>
    </main>
  );
}
