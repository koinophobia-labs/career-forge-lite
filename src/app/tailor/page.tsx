"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { LockedActionPill } from "@/components/LockedFeature";
import { SiteFooter } from "@/components/SiteFooter";
import { APPLICATION_FOLLOW_UP_DAYS, addDays } from "@/lib/command-center-insights";
import { useEntitlement } from "@/lib/entitlement";
import { createId } from "@/lib/command-center-store";
import { assessDossierReadiness } from "@/lib/dossier";
import { assessJobPost } from "@/lib/input-guidance";
import { analyzeJobPost, type JobPostAnalysis, type RequirementMatch } from "@/lib/job-post-analyzer";
import { createRoleSprint, sprintEligibility } from "@/lib/role-sprint";
import { buildHandoff, saveHandoff } from "@/lib/tailor-handoff";
import { trackCareerEvent } from "@/lib/analytics";
import { activationEventsForTransition } from "@/lib/activation";
import { draftApplicationQuestion } from "@/lib/application-questions";
import { useCommandCenter } from "@/lib/use-command-center";

export default function TailorPage() {
  const { state, update, hydrated } = useCommandCenter();
  const { hasFeature } = useEntitlement();
  const [jobPost, setJobPost] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [laneId, setLaneId] = useState<string>("");
  const [baselineVariantId, setBaselineVariantId] = useState<string>("");
  const [source, setSource] = useState<"linkedin" | "company-site" | "referral" | "recruiter" | "other">("linkedin");
  const [discoveryUrl, setDiscoveryUrl] = useState("");
  const [applicationUrl, setApplicationUrl] = useState("");
  const [postingDate, setPostingDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactUrl, setContactUrl] = useState("");
  const [questionPrompts, setQuestionPrompts] = useState("");
  const [analysis, setAnalysis] = useState<JobPostAnalysis | null>(null);
  const [savedApplication, setSavedApplication] = useState(false);
  const [savedApplicationId, setSavedApplicationId] = useState<string | null>(null);
  const router = useRouter();

  const selectedLane = useMemo(() => state.lanes.find((lane) => lane.id === laneId) ?? null, [state.lanes, laneId]);
  const currentPack = useMemo(() => [...state.resumePacks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null, [state.resumePacks]);
  const baselines = useMemo(() => currentPack?.variants.filter((variant) => variant.kind !== "job-specific" && (!laneId || variant.laneId === laneId)) ?? [], [currentPack, laneId]);
  const selectedBaseline = baselines.find((variant) => variant.id === baselineVariantId) ?? null;
  const profileReady = hydrated && assessDossierReadiness(state.dossier).level !== "not-ready";

  function runAnalysis() {
    if (!jobPost.trim() || !selectedBaseline) return;
    trackCareerEvent("job_tailor_started");
    trackCareerEvent("tailor_started");
    setAnalysis(analyzeJobPost(jobPost, state.profile, selectedLane, state.dossier));
    setSavedApplication(false);
  }

  function saveAsApplication(status: "drafting" | "applied") {
    const nowIso = new Date().toISOString();
    const newApplicationId = createId("app");
    let events: ReturnType<typeof activationEventsForTransition> = [];
    update((current) => {
      const next = {
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
          source,
          discoveryUrl: discoveryUrl.trim(),
          applicationUrl: applicationUrl.trim(),
          postingDate: postingDate ? new Date(postingDate).toISOString() : null,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          contactName: contactName.trim(),
          contactUrl: contactUrl.trim(),
          resumeVariantId: selectedBaseline?.id ?? null,
          applicationQuestions: questionPrompts.split(/\n+/).map((prompt) => prompt.trim()).filter(Boolean).map((prompt, index) => draftApplicationQuestion(prompt, state.dossier, `${newApplicationId}-question-${index + 1}`)),
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
      };
      events = activationEventsForTransition(current, next);
      return next;
    });
    setSavedApplication(true);
    setSavedApplicationId(newApplicationId);
    events.forEach(trackCareerEvent);
  }

  // One click on an eligible gap/partial requirement opens a bounded Role
  // Sprint. The sprint record is created immediately (durable restore point);
  // an existing sprint for the same requirement + target is reused so a
  // second click never forks the provenance chain.
  function startRoleSprint(req: RequirementMatch) {
    const nowIso = new Date().toISOString();
    let sprintId = "";
    update((current) => {
      const existing = current.roleSprints.find(
        (item) =>
          item.requirement === req.requirement &&
          item.company === company.trim() &&
          item.roleTitle === roleTitle.trim() &&
          (item.applicationId === savedApplicationId || (!item.applicationId && !savedApplicationId))
      );
      if (existing) {
        sprintId = existing.id;
        return savedApplicationId && !existing.applicationId
          ? {
              ...current,
              roleSprints: current.roleSprints.map((item) =>
                item.id === existing.id ? { ...item, applicationId: savedApplicationId, updatedAt: nowIso } : item
              )
            }
          : current;
      }
      const sprint = createRoleSprint({
        requirement: req,
        company,
        roleTitle,
        applicationId: savedApplicationId,
        nowIso
      });
      sprintId = sprint.id;
      return { ...current, roleSprints: [...current.roleSprints, sprint] };
    });
    trackCareerEvent("role_sprint_started");
    router.push(`/role-sprint?id=${sprintId}`);
  }

  function startTailoredResume() {
    if (!analysis || !selectedBaseline || !hasFeature("tailored_resume_export")) return;
    saveHandoff(
      buildHandoff({
        analysis,
        lane: selectedLane,
        company,
        roleTitle,
        applicationId: savedApplicationId,
        baselineVariantId: selectedBaseline.id
      })
    );
    trackCareerEvent("application_pack_completed");
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
        <p className="trust-kicker text-sm font-bold uppercase">Step 5 · Tailor to a real job</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Tailor against the actual job post.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          Start from the right lane résumé, then paste the job posting. Career Forge keeps the approved evidence, baseline,
          and real posting connected while leaving the reusable baseline unchanged.
        </p>

        {hydrated && !profileReady && (
          <div className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-6 text-paper/75">
            Your dossier needs one more approved role, project, or proof point for useful matching.{" "}
            <Link href="/profile" className="font-bold text-gold underline-offset-2 hover:underline">
              Add approved evidence
            </Link>{" "}
            — the analysis below will stay deliberately cautious until then.
          </div>
        )}
        {hydrated && !currentPack && <div className="mt-6 rounded-xl border border-coral/30 bg-coral/10 p-4 text-sm text-paper/75">Tailoring now starts from an existing lane baseline. <Link href="/targets" className="font-bold text-gold">Choose lanes and forge your résumé pack first.</Link></div>}

        <div className="trust-panel mt-8 grid gap-5 p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                onChange={(event) => { setLaneId(event.target.value); setBaselineVariantId(""); }}
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
            <label className="block">
              <span className="text-sm font-bold text-paper">Baseline résumé</span>
              <select value={baselineVariantId} onChange={(event) => setBaselineVariantId(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink">
                <option value="">Select a lane baseline</option>
                {baselines.map((variant) => <option key={variant.id} value={variant.id}>{variant.kind === "ats" ? "ATS Submission" : "Recruiter / Networking"} · {variant.title}</option>)}
              </select>
              {hydrated && baselines.length === 0 && (
                <span className="mt-2 block rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs leading-5 text-paper/80">
                  No baseline résumé exists yet — tailoring starts from one.{" "}
                  <Link href="/targets" className="font-bold text-gold underline hover:text-cyan">
                    Forge your résumé pack first →
                  </Link>
                </span>
              )}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block"><span className="text-sm font-bold text-paper">Discovery source</span><select value={source} onChange={(event) => setSource(event.target.value as typeof source)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"><option value="linkedin">LinkedIn</option><option value="company-site">Company site</option><option value="referral">Referral</option><option value="recruiter">Recruiter</option><option value="other">Other</option></select></label>
            <label className="block"><span className="text-sm font-bold text-paper">Discovery URL</span><input aria-label="Discovery URL" value={discoveryUrl} onChange={(event) => setDiscoveryUrl(event.target.value)} placeholder="LinkedIn posting URL" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"/></label>
            <label className="block"><span className="text-sm font-bold text-paper">Direct application URL</span><input aria-label="Direct application URL" value={applicationUrl} onChange={(event) => setApplicationUrl(event.target.value)} placeholder="Employer portal URL" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"/></label>
            <label className="block"><span className="text-sm font-bold text-paper">Contact</span><input aria-label="Contact name" value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Recruiter or referral name" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"/></label>
            <label className="block"><span className="text-sm font-bold text-paper">Contact URL</span><input aria-label="Contact URL" value={contactUrl} onChange={(event) => setContactUrl(event.target.value)} placeholder="LinkedIn profile" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"/></label>
            <label className="block"><span className="text-sm font-bold text-paper">Posting date</span><input aria-label="Posting date" type="date" value={postingDate} onChange={(event) => setPostingDate(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"/></label>
            <label className="block"><span className="text-sm font-bold text-paper">Deadline</span><input aria-label="Deadline" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"/></label>
          </div>

          <label className="block"><span className="text-sm font-bold text-paper">Custom application questions</span><span className="mt-0.5 block text-xs text-paper/55">One prompt per line. Drafts cite approved evidence and stay editable in the application tracker.</span><textarea aria-label="Application questions" rows={4} value={questionPrompts} onChange={(event) => setQuestionPrompts(event.target.value)} placeholder="What excites you most about this opportunity?" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"/></label>

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
            disabled={!jobPost.trim() || !selectedBaseline}
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
                  analysis.requirements.map((req) => {
                    const eligibility = req.status === "covered" ? null : sprintEligibility(req);
                    const existingSprint = state.roleSprints.find(
                      (item) => item.requirement === req.requirement && item.company === company.trim() && item.roleTitle === roleTitle.trim()
                    );
                    return (
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
                        {eligibility?.eligible && (
                          <button
                            type="button"
                            onClick={() => startRoleSprint(req)}
                            className="mt-2.5 rounded-md border border-cyan/40 bg-cyan/10 px-3 py-1.5 text-xs font-bold text-cyan transition hover:border-gold hover:text-gold"
                          >
                            {existingSprint ? "Resume your Role Sprint →" : "Build proof for this gap →"}
                          </button>
                        )}
                        {eligibility && !eligibility.eligible && (
                          <p className="mt-2 text-[0.72rem] leading-5 text-paper/45">
                            <span className="lab-mono mr-1.5 font-bold uppercase text-paper/55">No sprint offered</span>
                            {eligibility.reason}
                          </p>
                        )}
                      </div>
                    );
                  })
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

            {currentPack && <div className="trust-panel p-5 sm:p-6"><h2 className="text-xl font-bold text-paper">Optional application materials</h2><p className="mt-1 text-sm text-paper/55">Built from the same approved dossier foundation; review and personalize before sending.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-lg border border-white/10 bg-white/5 p-4"><p className="lab-mono text-xs font-bold uppercase text-gold">Cover letter foundation</p><p className="mt-2 text-sm leading-6 text-paper/70">{currentPack.coverLetterFoundation}</p></div><div className="rounded-lg border border-white/10 bg-white/5 p-4"><p className="lab-mono text-xs font-bold uppercase text-cyan">Recruiter / hiring-manager message</p><p className="mt-2 text-sm leading-6 text-paper/70">{(() => {
                // Sendable first-person text only — never lane coaching copy.
                const laneVariant = currentPack.variants.find((variant) => variant.laneId === selectedLane?.id && variant.kind === "ats");
                const highlights = laneVariant?.resume.coreSkills.slice(0, 3).join(", ") ?? "";
                return `I’m exploring ${roleTitle || selectedLane?.title || "this role"}${company ? ` at ${company}` : ""}.${highlights ? ` My background includes ${highlights}.` : ""} My résumé is attached with the most relevant verified experience — happy to share more detail.`;
              })()}</p></div></div></div>}

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
              {hasFeature("tailored_resume_export") ? (
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
              ) : (
                <LockedActionPill feature="tailored_resume_export" label="Build the resume for this shot" />
              )}
            </div>
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
