"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { APPLICATION_FOLLOW_UP_DAYS, addDays } from "@/lib/command-center-insights";
import { createId, isProfileComplete } from "@/lib/command-center-store";
import { assessJobPost } from "@/lib/input-guidance";
import { analyzeJobPost, type JobPostAnalysis } from "@/lib/job-post-analyzer";
import { buildHandoff, saveHandoff } from "@/lib/tailor-handoff";
import { useCommandCenter } from "@/lib/use-command-center";

export default function TailorPage() {
  const { state, update, hydrated } = useCommandCenter();
  const [jobPost, setJobPost] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [laneId, setLaneId] = useState<string>("");
  const [analysis, setAnalysis] = useState<JobPostAnalysis | null>(null);
  const [savedApplication, setSavedApplication] = useState(false);
  const [savedApplicationId, setSavedApplicationId] = useState<string | null>(null);
  const router = useRouter();

  const selectedLane = useMemo(() => state.lanes.find((lane) => lane.id === laneId) ?? null, [state.lanes, laneId]);
  const profileReady = hydrated && isProfileComplete(state.profile);

  function runAnalysis() {
    if (!jobPost.trim()) return;
    setAnalysis(analyzeJobPost(jobPost, state.profile, selectedLane));
    setSavedApplication(false);
  }

  function saveAsApplication(status: "drafting" | "applied") {
    const nowIso = new Date().toISOString();
    const newApplicationId = createId("app");
    update((current) => ({
      ...current,
      applications: [
        ...current.applications,
        {
          id: newApplicationId,
          company: company.trim() || "Unknown company",
          roleTitle: roleTitle.trim() || selectedLane?.title || "Untitled role",
          laneId: selectedLane?.id ?? null,
          status,
          jobPostUrl: "",
          resumeVersionId: null,
          appliedAt: status === "applied" ? nowIso : null,
          nextFollowUpAt: status === "applied" ? addDays(nowIso, APPLICATION_FOLLOW_UP_DAYS) : null,
          followUpsSent: [],
          interviewAt: null,
          notes: analysis
            ? `Tailoring notes — top keywords: ${analysis.keywords
                .slice(0, 6)
                .map((hit) => hit.term)
                .join(", ")}`
            : "",
          analysisKeywords: analysis ? analysis.keywords.slice(0, 10).map((hit) => hit.term) : [],
          analysisGaps: analysis
            ? analysis.requirements
                .filter((req) => req.status === "gap" || req.status === "partial")
                .map((req) => req.requirement)
                .slice(0, 6)
            : [],
          analysisWeakSpots: analysis ? analysis.weakSpots.slice(0, 4) : [],
          createdAt: nowIso
        }
      ]
    }));
    setSavedApplication(true);
    setSavedApplicationId(newApplicationId);
  }

  function startTailoredResume() {
    if (!analysis) return;
    saveHandoff(
      buildHandoff({
        analysis,
        lane: selectedLane,
        company,
        roleTitle,
        applicationId: savedApplicationId
      })
    );
    router.push("/resume-builder");
  }

  const statusStyles = {
    covered: "border-spruce/60 bg-mint/10 text-mint",
    partial: "border-gold/50 bg-gold/10 text-gold",
    gap: "border-coral/50 bg-coral/10 text-coral"
  } as const;

  return (
    <main>
      <CommandNav active="/tailor" />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Step 03 · Application tailoring</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Tailor against the actual job post.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          Paste a job posting. The engine extracts its keywords and requirements, checks them against your profile and
          lane, flags weak spots, and suggests honest bullet rewrites. It works from what you’ve claimed — it will never
          invent experience for you.
        </p>

        {hydrated && !profileReady && (
          <div className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-6 text-paper/75">
            Your profile isn’t complete enough for useful matching yet.{" "}
            <Link href="/profile" className="font-bold text-gold underline-offset-2 hover:underline">
              Finish your profile
            </Link>{" "}
            (situation, target roles, 3+ skills, experience summary) — the analysis below will be shallow until then.
          </div>
        )}

        <div className="trust-panel mt-8 grid gap-5 p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-bold text-paper">Company</span>
              <input
                value={company}
                placeholder="e.g., Anthropic"
                onChange={(event) => setCompany(event.target.value)}
                className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-paper">Role title</span>
              <input
                value={roleTitle}
                placeholder="e.g., Product Support Specialist"
                onChange={(event) => setRoleTitle(event.target.value)}
                className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-paper">Lane</span>
              <select
                value={laneId}
                onChange={(event) => setLaneId(event.target.value)}
                className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
              >
                <option value="">No lane (generic)</option>
                {state.lanes.map((lane) => (
                  <option key={lane.id} value={lane.id}>
                    {lane.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label className="block">
              <span className="text-sm font-bold text-paper">Paste the full job post here</span>
              <span className="mt-0.5 block text-xs leading-5 text-paper/55">
                Select everything on the job page — title, about-the-role, responsibilities, and especially the
                requirements/qualifications section. The analyzer extracts: keywords worth mirroring, each requirement
                matched against your profile (covered / partial / gap), weak spots, and honest bullet rewrites.
              </span>
              <textarea
                value={jobPost}
                rows={10}
                placeholder={
                  "Works best with the real sections, e.g.:\n\nProduct Support Specialist — Acme\n\nWhat you'll do:\n- Own customer tickets from first reply to resolution\n- ...\n\nWhat we're looking for:\n- 2+ years of customer support experience\n- Strong written communication\n- ..."
                }
                onChange={(event) => setJobPost(event.target.value)}
                className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
              />
            </label>
            {jobPost.trim() &&
              (() => {
                const quality = assessJobPost(jobPost);
                if (quality.status === "good") {
                  return <p className="mt-2 text-xs leading-5 text-mint">{quality.message}</p>;
                }
                return (
                  <p className="mt-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs leading-5 text-paper/80">
                    <span className="lab-mono mr-1.5 font-bold uppercase text-gold">Short paste</span>
                    {quality.message}
                  </p>
                );
              })()}
          </div>

          <button
            type="button"
            onClick={runAnalysis}
            disabled={!jobPost.trim()}
            className="lab-pill-button justify-self-start px-6 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Analyze this post
          </button>
        </div>

        {analysis && (
          <div className="mt-8 grid gap-6">
            <div className="rounded-xl border border-cyan/25 bg-cyan/10 p-4 text-sm leading-6 text-paper/75">
              {analysis.honestyNote}
            </div>

            <div className="trust-panel p-5 sm:p-6">
              <h2 className="text-xl font-bold text-paper">Keywords the post cares about</h2>
              <p className="mt-1 text-sm text-paper/60">
                Gold = already in your profile. Red = missing — add only if true, in the post’s own wording.
              </p>
              {analysis.keywords.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {analysis.keywords.map((hit) => (
                    <span
                      key={hit.term}
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${
                        hit.inProfile ? "border-gold/50 bg-gold/10 text-gold" : "border-coral/50 bg-coral/10 text-coral"
                      }`}
                    >
                      {hit.term} ×{hit.count}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-paper/60">
                  No recognized keywords found — this post may be unusually vague. Focus on the requirements below.
                </p>
              )}
            </div>

            <div className="trust-panel p-5 sm:p-6">
              <h2 className="text-xl font-bold text-paper">Requirements vs. your profile</h2>
              <div className="mt-4 grid gap-2.5">
                {analysis.requirements.length ? (
                  analysis.requirements.map((req) => (
                    <div key={req.requirement} className="rounded-lg border border-white/12 bg-obsidian/40 p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="max-w-3xl text-sm font-bold leading-5 text-paper">{req.requirement}</p>
                        <span
                          className={`lab-mono shrink-0 rounded-full border px-2.5 py-0.5 text-[0.62rem] font-bold uppercase ${statusStyles[req.status]}`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[0.78rem] leading-5 text-paper/60">{req.evidence}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-paper/60">
                    Couldn’t isolate requirement lines. Try pasting the post with its original line breaks.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="trust-panel p-5 sm:p-6">
                <h2 className="text-xl font-bold text-paper">Weak spots</h2>
                <ul className="mt-4 grid gap-2.5">
                  {analysis.weakSpots.map((spot) => (
                    <li key={spot} className="rounded-lg border border-coral/25 bg-coral/5 p-3.5 text-sm leading-6 text-paper/72">
                      {spot}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="trust-panel p-5 sm:p-6">
                <h2 className="text-xl font-bold text-paper">Suggested bullet rewrites</h2>
                <ul className="mt-4 grid gap-2.5">
                  {analysis.bulletSuggestions.map((item) => (
                    <li key={item.suggestion} className="rounded-lg border border-white/12 bg-obsidian/40 p-3.5">
                      <p className="text-sm leading-6 text-paper/80">{item.suggestion}</p>
                      <p className="lab-mono mt-1.5 text-[0.65rem] font-bold uppercase text-paper/45">
                        Based on: {item.basedOn}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/12 bg-white/5 p-4">
              <p className="mr-auto text-sm text-paper/68">
                {savedApplication
                  ? "Saved to your applications tracker."
                  : "Happy with the angle? Track this as an application."}
              </p>
              {!savedApplication && (
                <>
                  <button
                    type="button"
                    onClick={() => saveAsApplication("drafting")}
                    className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-paper/70 transition hover:border-cyan hover:text-cyan"
                  >
                    Save as draft
                  </button>
                  <button
                    type="button"
                    onClick={() => saveAsApplication("applied")}
                    className="rounded-md bg-gold px-4 py-2 text-sm font-black text-ink transition hover:bg-cyan"
                  >
                    I applied — track it
                  </button>
                </>
              )}
              {savedApplication && (
                <Link href="/applications" className="lab-pill-button px-4 py-2 text-sm font-black transition">
                  Open applications →
                </Link>
              )}
              <button
                type="button"
                onClick={startTailoredResume}
                title={
                  savedApplication
                    ? "Opens the resume builder with this analysis loaded and links the resulting version to this application."
                    : "Opens the resume builder with this analysis loaded. Save the application first to also link the version to it."
                }
                className="rounded-md border border-cyan/40 bg-cyan/10 px-4 py-2 text-sm font-bold text-cyan transition hover:border-gold hover:text-gold"
              >
                Build the resume for this shot →
              </button>
            </div>
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
