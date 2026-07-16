"use client";

import { FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { LinkedInPreview } from "@/components/LinkedInPreview";
import { PremiumBadge, PremiumLockedPanel, PremiumPreviewMeter, UpgradeCallout } from "@/components/PremiumAccess";
import { ResumePreview } from "@/components/ResumePreview";
import {
  canGenerateResumeFromInterview,
  createNextAssistantInterviewTurn,
  createUserInterviewMessage,
  generateResumePackageFromInterview,
  getInterviewCoachingMessages,
  getMissingOrWeakFields,
  getSmartInterviewSummary,
  getWeakestInterviewStage,
  type InterviewGeneratedPackage,
  markInterviewReadyForGeneration,
  updateInterviewDraftFromUserAnswer
} from "@/lib/interview-mode";
import { trackCareerForgeCompletion, trackCareerForgeStart, trackResumeGeneration } from "@/lib/analytics";
import { getInterviewModeLimitState } from "@/lib/feature-access";
import {
  getInterviewSessionServerSnapshot,
  getInterviewSessionSnapshot,
  resetInterviewSession,
  setInterviewSession,
  subscribeInterviewSession
} from "@/lib/interview-session-store";
import { resumeToText } from "@/lib/resume-export";
import type { ResumePackage } from "@/types/career";
import type { InterviewSession } from "@/types/interview";

type InterviewModeState = "interview" | "generating" | "review";

function statusTone(status: string) {
  if (status === "strong") return "border-cyan/35 bg-cyan/10 text-cyan";
  if (status === "usable") return "border-gold/35 bg-gold/10 text-gold";
  if (status === "weak") return "border-ember/35 bg-ember/10 text-ember";
  return "border-white/10 bg-white/5 text-paper/55";
}

function readinessLabel(status: string) {
  if (status === "strong") return "Strong";
  if (status === "usable") return "Ready";
  if (status === "weak") return "Needs detail";
  return "Need answer";
}

function readinessNote(label: string, status: string) {
  if (status === "strong") return `${label} has strong resume evidence.`;
  if (status === "usable") return `${label} is usable for a first draft.`;
  if (status === "weak") return `${label} needs one more concrete detail.`;
  return `${label} still needs an answer.`;
}

function focusCopy(stage: InterviewSession["currentStage"]) {
  const focus: Record<InterviewSession["currentStage"], { label: string; body: string }> = {
    role_targeting: {
      label: "Understanding your target role",
      body: "First, I need to know where this resume should point."
    },
    background_overview: {
      label: "Connecting your background",
      body: "I am looking for the work history that best supports your next move."
    },
    current_or_recent_role: {
      label: "Unpacking your recent work",
      body: "Your most recent role usually gives the resume its strongest proof."
    },
    responsibilities: {
      label: "Finding what you were trusted with",
      body: "Plain duties become stronger bullets when we name the work clearly."
    },
    achievements: {
      label: "Looking for outcomes",
      body: "Results, improvements, and useful examples make the resume feel real."
    },
    metrics: {
      label: "Finding measurable wins",
      body: "Estimates are okay. Scale helps recruiters understand the weight of the work."
    },
    tools_and_skills: {
      label: "Identifying tools and skills",
      body: "Systems, software, workflows, and strengths help shape the keyword layer."
    },
    projects_or_portfolio: {
      label: "Finding proof beyond job titles",
      body: "A project or example can show capability even when your title does not."
    },
    education_and_certifications: {
      label: "Adding training or credentials",
      body: "Relevant education, courses, or certifications can support the story."
    },
    gaps_and_positioning: {
      label: "Shaping the final resume",
      body: "If anything needs careful positioning, we can handle it before generating."
    },
    final_resume_review: {
      label: "Shaping the final resume",
      body: "We have enough to generate, and one more detail can still make it stronger."
    }
  };

  return focus[stage];
}

export function InterviewMode() {
  // Sessions persist locally and survive refresh; the server snapshot keeps
  // static prerendering happy until the stored session hydrates in.
  const session = useSyncExternalStore(
    subscribeInterviewSession,
    getInterviewSessionSnapshot,
    getInterviewSessionServerSnapshot
  );
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<InterviewModeState>("interview");
  const [isThinking, setIsThinking] = useState(false);
  const [generatedPackage, setGeneratedPackage] = useState<InterviewGeneratedPackage | null>(null);

  const missingFields = useMemo(() => getMissingOrWeakFields(session), [session]);
  const canGenerate = canGenerateResumeFromInterview(session);
  const limitState = useMemo(() => getInterviewModeLimitState(session), [session]);
  const coachingMessages = useMemo(() => getInterviewCoachingMessages(session), [session]);
  const smartSummary = useMemo(() => getSmartInterviewSummary(session), [session]);
  const interviewFocus = useMemo(() => focusCopy(session.currentStage), [session.currentStage]);
  const coachTip = coachingMessages[0] ?? "Short answers work, but examples make the resume stronger.";
  const generateHelpText = canGenerate
    ? "Ready when you are. You can generate now or add one more proof point."
    : "Generate unlocks after Career Forge has a target role, experience proof, responsibilities, tools or skills, and one result or project.";
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

  useEffect(() => {
    trackCareerForgeStart("interview");
  }, []);

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || limitState.isLocked) return;

    const userMessage = createUserInterviewMessage(content);
    const updated = updateInterviewDraftFromUserAnswer(session, userMessage);
    setInterviewSession(updated);
    setInput("");
    setIsThinking(true);
    window.setTimeout(() => {
      setInterviewSession(createNextAssistantInterviewTurn(updated));
      setIsThinking(false);
    }, 180);
  }

  function handleGenerate() {
    if (!canGenerate) return;
    const readySession = markInterviewReadyForGeneration(session);
    setInterviewSession(readySession);
    setMode("generating");
    window.setTimeout(() => {
      setGeneratedPackage(generateResumePackageFromInterview(readySession));
      trackResumeGeneration("interview");
      trackCareerForgeCompletion("interview");
      setMode("review");
    }, 220);
  }

  function updateGeneratedResume(resume: ResumePackage) {
    if (!generatedPackage) return;
    setGeneratedPackage({ ...generatedPackage, resume });
  }

  function handleImproveWeakAreas() {
    const weakestStage = getWeakestInterviewStage(session);
    const targetedSession: InterviewSession = { ...session, currentStage: weakestStage };
    setInterviewSession(createNextAssistantInterviewTurn(targetedSession));
    setMode("interview");
  }

  function handleStartOver() {
    resetInterviewSession();
    setGeneratedPackage(null);
    setInput("");
    setIsThinking(false);
    setMode("interview");
  }

  if (mode === "review" && generatedPackage) {
    const weakAreas = generatedPackage.readiness.weakAreas;
    const missingMetrics = !session.resumeDraft.metrics.length;

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
                  Review Resume
                </span>
              </span>
            </Link>
            <div className="flex flex-wrap gap-2">
              <PremiumBadge />
              <button
                type="button"
                onClick={() => setMode("interview")}
                className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-paper/70 transition hover:border-cyan hover:text-cyan"
              >
                Back to Interview
              </button>
              <button
                type="button"
                onClick={handleImproveWeakAreas}
                className="rounded-md border border-cyan/25 bg-cyan/10 px-4 py-2 text-sm font-bold text-cyan transition hover:border-gold hover:text-gold"
              >
                Improve Weak Areas
              </button>
              <button
                type="button"
                onClick={handleStartOver}
                className="rounded-md border border-ember/25 bg-ember/10 px-4 py-2 text-sm font-bold text-ember transition hover:border-ember"
              >
                Start Over
              </button>
            </div>
          </div>

          <section className="trust-panel rounded-md p-5 sm:p-7">
            <p className="trust-kicker text-xs font-black uppercase">Beta Preview Result</p>
            <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_22rem]">
              <div>
                <h1 className="text-3xl font-bold text-paper sm:text-5xl">Your interview-built resume draft</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-paper/70">
                  This draft only uses what you told Career Forge. Missing metrics are shown as coaching notes, not invented.
                </p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-paper/45">Resume Strength</p>
                <p className="mt-2 text-lg font-bold text-cyan">{generatedPackage.readiness.strengthLabel}</p>
                <p className="mt-2 text-sm leading-6 text-paper/62">{generatedPackage.readiness.suggestedNextQuestion}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <CopyButton getText={() => resumeToText(generatedPackage.intake, generatedPackage.resume)} label="Copy resume draft" />
              <CopyButton getText={() => generatedPackage.resume.linkedinHeadline} label="Copy headline" />
              <button
                type="button"
                onClick={handleImproveWeakAreas}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-cyan/30 bg-cyan/10 px-4 text-sm font-semibold text-cyan transition hover:border-cyan hover:bg-cyan hover:text-ink"
              >
                Continue improving
              </button>
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Resume Summary", generatedPackage.resume.summary || "No summary generated yet."],
              [
                "Experience Bullets",
                generatedPackage.resume.experience.flatMap((role) => role.bullets).filter(Boolean).slice(0, 2).join(" ")
                  || "No bullets generated yet."
              ],
              ["Skills & Tools", generatedPackage.resume.coreSkills.slice(0, 8).join(", ") || "No skills identified yet."],
              ["LinkedIn Headline", generatedPackage.resume.linkedinHeadline || "No headline generated yet."]
            ].map(([title, body]) => (
              <article key={title} className="trust-card rounded-md p-4">
                <h2 className="text-sm font-bold text-paper">{title}</h2>
                <p className="mt-2 text-xs leading-5 text-paper/62">{body}</p>
              </article>
            ))}
          </section>

          <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="trust-panel rounded-md p-5">
              <h2 className="text-lg font-bold text-paper">Evidence Career Forge Used</h2>
              <div className="mt-4 space-y-3">
                {generatedPackage.evidence.length ? (
                  generatedPackage.evidence.slice(0, 12).map((item) => (
                    <article key={`${item.label}-${item.value}`} className="rounded-md border border-white/10 bg-white/5 p-3">
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-cyan">{item.label}</p>
                      <p className="mt-1 text-sm font-bold text-paper">{item.value}</p>
                      <p className="mt-2 text-xs leading-5 text-paper/55">
                        Evidence: {item.evidence[0] || "Captured in the structured draft."}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-paper/60">
                    No evidence captured yet. Add a role, responsibility, tool, result, or project and Career Forge will show what supported the draft.
                  </p>
                )}
              </div>
            </div>

            <div className="trust-panel rounded-md p-5">
              <h2 className="text-lg font-bold text-paper">What to Improve Next</h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-paper/68">
                {missingMetrics && (
                  <p className="rounded-md border border-ember/20 bg-ember/10 p-3 text-ember">
                    Missing metrics reduce resume strength, but Career Forge will not invent them. Add measurable impact such as customers helped, tickets handled, reports created, transaction volume, or time saved.
                  </p>
                )}
                {weakAreas.length ? (
                  weakAreas.map((area) => (
                    <p key={area} className="rounded-md border border-white/10 bg-white/5 p-3">
                      {area}
                    </p>
                  ))
                ) : (
                  <p className="rounded-md border border-cyan/20 bg-cyan/10 p-3 text-cyan">
                    The interview has enough signal for a first resume draft.
                  </p>
                )}
              </div>
            </div>
          </section>

          <ResumePreview
            data={generatedPackage.intake}
            resume={generatedPackage.resume}
            template="Modern ATS"
            onChange={updateGeneratedResume}
          />
          <LinkedInPreview resume={generatedPackage.resume} onChange={updateGeneratedResume} />
        </div>
      </main>
    );
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
          <PremiumBadge />
        </div>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="trust-panel rounded-md p-5 sm:p-7">
            <p className="trust-kicker text-xs font-black uppercase">Beta Preview</p>
            <h1 className="mt-3 text-3xl font-bold text-paper sm:text-5xl">Let Career Forge interview you.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-paper/70">
              Answer naturally. Career Forge pulls out responsibilities, achievements, tools, and proof, then turns them
              into a recruiter-ready resume.
            </p>
            <p className="mt-3 text-sm font-semibold text-cyan">
              You do not need perfect resume language. Plain answers are enough.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                ["Answer like a conversation", "Type the way you would explain your work to a coach."],
                ["Career Forge finds the proof", "Responsibilities, tools, outcomes, and metrics are pulled into a useful draft."],
                ["Generate when ready", "When there is enough signal, build the resume and LinkedIn headline."]
              ].map(([title, body]) => (
                <article key={title} className="rounded-md border border-white/10 bg-white/5 p-4">
                  <h2 className="text-sm font-bold text-paper">{title}</h2>
                  <p className="mt-2 text-xs leading-5 text-paper/58">{body}</p>
                </article>
              ))}
            </div>

            <div className="mt-7 rounded-md border border-white/10 bg-obsidian/45">
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-paper/50">Interview Focus</p>
                <h2 className="mt-1 text-lg font-bold text-paper">{interviewFocus.label}</h2>
                <p className="mt-1 text-sm leading-6 text-paper/60">{interviewFocus.body}</p>
              </div>

              <div className="max-h-[31rem] space-y-3 overflow-y-auto px-4 py-4">
                {session.messages.map((message) => (
                  <article
                    key={message.id}
                    className={`max-w-[92%] rounded-md border px-4 py-3 transition md:max-w-[86%] ${
                      message.role === "assistant"
                        ? "border-cyan/18 bg-white/6 text-paper"
                        : "ml-auto border-gold/25 bg-gold/12 text-paper"
                    }`}
                  >
                    <p className="mb-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-paper/42">
                      {message.role === "assistant" ? "Career Forge" : "You"}
                    </p>
                    <p className="text-sm leading-6">{message.content}</p>
                  </article>
                ))}
                {isThinking && (
                  <article className="max-w-[88%] rounded-md border border-cyan/20 bg-cyan/10 px-4 py-3 text-paper">
                    <p className="mb-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-paper/42">Career Forge</p>
                    <p className="text-sm leading-6">Thinking... shaping the next question.</p>
                  </article>
                )}
              </div>

              <form onSubmit={handleSend} className="border-t border-white/10 p-4">
                <label htmlFor="interview-answer" className="text-xs font-black uppercase tracking-[0.14em] text-paper/55">
                  Talk it through
                </label>
                <textarea
                  id="interview-answer"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={limitState.isLocked}
                  rows={4}
                  placeholder={limitState.isLocked ? "Beta preview limit reached." : "Type naturally. I'll translate it."}
                  className="mt-2 w-full rounded-md border border-white/12 bg-white/8 px-4 py-3 text-sm leading-6 text-paper outline-none transition placeholder:text-paper/35 focus:border-cyan disabled:cursor-not-allowed disabled:opacity-55"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-paper/55">Short answers work, but examples make the resume stronger.</p>
                  <button
                    type="submit"
                    disabled={limitState.isLocked}
                    className="min-h-11 rounded-md bg-gold px-5 text-sm font-black text-ink transition hover:bg-cyan disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-paper/35"
                  >
                    Send Answer
                  </button>
                </div>
              </form>
            </div>
          </div>

          <aside className="trust-panel rounded-md p-5">
            <PremiumPreviewMeter state={limitState} />
            {limitState.isLocked && (
              <div className="mt-4">
                <PremiumLockedPanel
                  hasGeneratedResume={Boolean(generatedPackage)}
                  onStartOver={handleStartOver}
                  onViewResume={generatedPackage ? () => setMode("review") : undefined}
                />
              </div>
            )}
            <div className="mt-4">
              <UpgradeCallout />
            </div>
            <section className="mt-6 rounded-md border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-paper/45">Resume Readiness</p>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-cyan transition-all"
                  style={{ width: `${session.resumeDraft.confidenceScore}%` }}
                />
              </div>
              <p className="mt-2 text-lg font-bold text-cyan">{session.resumeDraft.confidenceScore}% ready</p>
              <p className="mt-1 text-sm leading-6 text-paper/58">
                I am looking for a clear target, recent work, proof, tools, and at least one result or example.
              </p>
            </section>

            <div className="mt-6 rounded-md border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-bold text-paper">So far I&apos;ve learned</h2>
              {smartSummary.learned.length ? (
                <ul className="mt-3 space-y-2 text-sm text-paper/70">
                  {smartSummary.learned.map((fact) => (
                    <li key={fact}>Learned: {fact}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-paper/55">I am still learning your target role and recent experience.</p>
              )}
              {smartSummary.stillLearning.length > 0 && (
                <>
                  <h3 className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-paper/42">Still trying to learn</h3>
                  <ul className="mt-2 space-y-2 text-sm text-paper/55">
                    {smartSummary.stillLearning.map((item) => (
                      <li key={item}>Open: {item}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-cyan">
                {smartSummary.conversationScore > 12 ? "Strong interview signal" : "Keep adding proof"}
              </p>
            </div>

            <div className="mt-6 rounded-md border border-gold/20 bg-gold/10 p-4">
              <h2 className="text-sm font-bold text-paper">Coach Tip</h2>
              <p className="mt-2 text-sm leading-6 text-paper/70">{coachTip}</p>
            </div>

            <div className="mt-6 rounded-md border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-bold text-paper">Still need</h2>
              {missingFields.length ? (
                <ul className="mt-3 space-y-2 text-sm text-paper/65">
                  {missingFields.slice(0, 3).map((field) => (
                    <li key={String(field.fieldKey)}>{field.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-6 text-cyan">
                  No weak areas yet. You can generate now, or add one more example to make the draft stronger.
                </p>
              )}
            </div>

            <details className="mt-4 rounded-md border border-white/10 bg-white/5 p-4">
              <summary className="cursor-pointer text-sm font-bold text-paper">View captured details</summary>
              <div className="mt-4 space-y-3">
                {draftPreview.map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-paper/42">{label}</p>
                    <p className="mt-1 text-sm leading-6 text-paper/70">
                      {value || (label === "Metrics" ? "No metrics yet. Estimate volume, speed, time saved, customer count, revenue, accuracy, or scale if you can." : "Not captured yet.")}
                    </p>
                  </div>
                ))}
              </div>
            </details>

            <details className="mt-4 rounded-md border border-white/10 bg-white/5 p-4">
              <summary className="cursor-pointer text-sm font-bold text-paper">View readiness details</summary>
              <div className="mt-4 space-y-2">
                {session.fieldStatuses.map((field) => (
                  <div key={String(field.fieldKey)} className={`rounded-md border px-3 py-2 ${statusTone(field.status)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-paper">{field.label}</span>
                      <span className="text-[0.65rem] font-black uppercase tracking-[0.14em]">{readinessLabel(field.status)}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-paper/58">{readinessNote(field.label, field.status)}</p>
                  </div>
                ))}
              </div>
            </details>

            <button
              type="button"
              disabled={!canGenerate || mode === "generating"}
              onClick={handleGenerate}
              aria-describedby="generate-resume-help"
              className="mt-5 min-h-12 w-full rounded-md bg-gold px-5 text-sm font-black text-ink transition hover:bg-cyan disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-paper/35"
            >
              {mode === "generating" ? "Generating..." : "Generate Resume"}
            </button>
            <p id="generate-resume-help" className="mt-2 text-xs leading-5 text-paper/50">
              {mode === "generating" ? "Career Forge is shaping your draft now." : generateHelpText}
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}
