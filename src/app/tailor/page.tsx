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

function inferJobIdentity(jobPost: string): { roleTitle: string; company: string } {
  const lines = jobPost.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 8);
  for (const line of lines) {
    const atMatch = line.match(/^(.{3,80}?)\s+at\s+(.{2,80})$/i);
    if (atMatch) return { roleTitle: atMatch[1].trim(), company: atMatch[2].trim() };
    const dividerMatch = line.match(/^(.{3,80}?)\s+(?:—|\||–)\s+(.{2,80})$/);
    if (dividerMatch) return { roleTitle: dividerMatch[1].trim(), company: dividerMatch[2].trim() };
  }
  return { roleTitle: lines[0] ?? "", company: "" };
}

export default function TailorPage() {
  const { state, update, hydrated } = useCommandCenter();
  const { hasFeature } = useEntitlement();
  const [jobPost, setJobPost] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [laneId, setLaneId] = useState("");
  const [baselineVariantId, setBaselineVariantId] = useState("");
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

  const effectiveLane = useMemo(
    () => state.lanes.find((lane) => lane.id === laneId) ?? state.lanes.find((lane) => lane.status === "active") ?? state.lanes[0] ?? null,
    [state.lanes, laneId]
  );
  const currentPack = useMemo(
    () => [...state.resumePacks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
    [state.resumePacks]
  );
  const baselines = useMemo(
    () => currentPack?.variants.filter((variant) => variant.kind !== "job-specific" && (!effectiveLane || variant.laneId === effectiveLane.id)) ?? [],
    [currentPack, effectiveLane]
  );
  const effectiveBaseline = baselines.find((variant) => variant.id === baselineVariantId) ?? baselines.find((variant) => variant.kind === "ats") ?? baselines[0] ?? null;
  const profileReady = hydrated && assessDossierReadiness(state.dossier).level !== "not-ready";

  function runAnalysis() {
    if (!jobPost.trim()) return;
    const inferred = inferJobIdentity(jobPost);
    if (!roleTitle.trim() && inferred.roleTitle) setRoleTitle(inferred.roleTitle);
    if (!company.trim() && inferred.company) setCompany(inferred.company);
    trackCareerEvent("job_tailor_started");
    trackCareerEvent("tailor_started");
    setAnalysis(analyzeJobPost(jobPost, state.profile, effectiveLane, state.dossier));
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
            roleTitle: roleTitle.trim() || effectiveLane?.title || "Untitled role",
            laneId: effectiveLane?.id ?? null,
            status,
            jobPostUrl: "",
            source,
            discoveryUrl: discoveryUrl.trim(),
            applicationUrl: applicationUrl.trim(),
            postingDate: postingDate ? new Date(postingDate).toISOString() : null,
            deadline: deadline ? new Date(deadline).toISOString() : null,
            contactName: contactName.trim(),
            contactUrl: contactUrl.trim(),
            resumeVariantId: effectiveBaseline?.id ?? null,
            applicationQuestions: questionPrompts
              .split(/\n+/)
              .map((prompt) => prompt.trim())
              .filter(Boolean)
              .map((prompt, index) => draftApplicationQuestion(prompt, state.dossier, `${newApplicationId}-question-${index + 1}`)),
            resumeVersionId: null,
            appliedAt: status === "applied" ? nowIso : null,
            nextFollowUpAt: status === "applied" ? addDays(nowIso, APPLICATION_FOLLOW_UP_DAYS) : null,
            followUpsSent: [],
            interviewAt: null,
            notes: analysis ? `Tailoring notes — top keywords: ${analysis.keywords.slice(0, 6).map((hit) => hit.term).join(", ")}` : "",
            analysisKeywords: analysis ? analysis.keywords.slice(0, 10).map((hit) => hit.term) : [],
            analysisGaps: analysis ? analysis.requirements.filter((req) => req.status !== "covered").map((req) => req.requirement).slice(0, 6) : [],
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
        roleTitle: roleTitle || effectiveLane?.title || "",
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
    if (!analysis || !effectiveBaseline || !hasFeature("tailored_resume_export")) return;
    saveHandoff(
      buildHandoff({
        analysis,
        lane: effectiveLane,
        company,
        roleTitle,
        applicationId: savedApplicationId,
        baselineVariantId: effectiveBaseline.id
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

  const eligibleRequirement = analysis?.requirements.find((req) => req.status !== "covered" && sprintEligibility(req).eligible) ?? null;
  const coveredCount = analysis?.requirements.filter((req) => req.status === "covered").length ?? 0;
  const partialCount = analysis?.requirements.filter((req) => req.status === "partial").length ?? 0;
  const gapCount = analysis?.requirements.filter((req) => req.status === "gap").length ?? 0;

  return (
    <main id="main">
      <CommandNav active="/tailor" />

      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Jobs</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Paste a job. See what you can prove.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          Career Forge compares the real posting with the experience you approved. The job post is the only required input.
        </p>

        {!profileReady && hydrated && (
          <div className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-6 text-paper/75">
            Results will be more useful after you add some work history. You can still analyze the posting now.{" "}
            <Link href="/profile" className="font-bold text-gold underline-offset-2 hover:underline">Add work history</Link>
          </div>
        )}

        <div className="trust-panel mt-7 p-5 sm:p-7">
          <label className="block">
            <span className="text-base font-bold text-paper">Paste the full job posting</span>
            <span className="mt-1 block text-xs leading-5 text-paper/55">Include the responsibilities and qualifications sections.</span>
            <textarea
              value={jobPost}
              rows={12}
              placeholder="Paste the job posting here…"
              onChange={(event) => { setJobPost(event.target.value); setAnalysis(null); }}
              className="trust-input mt-3 w-full border px-3 py-3 text-sm text-ink"
            />
          </label>

          {jobPost.trim() && (() => {
            const quality = assessJobPost(jobPost);
            return <p className={`mt-2 text-xs leading-5 ${quality.status === "good" ? "text-mint" : "text-gold"}`}>{quality.message}</p>;
          })()}

          <button
            type="button"
            onClick={runAnalysis}
            disabled={!jobPost.trim()}
            className="lab-pill-button mt-5 px-6 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Analyze this job →
          </button>

          <details className="mt-5 border-t border-white/10 pt-4">
            <summary className="cursor-pointer text-sm font-bold text-cyan">Add application details</summary>
            <p className="mt-1 text-xs text-paper/45">Optional. Career Forge will infer and preselect what it can.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label><span className="text-sm font-bold text-paper">Company</span><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Optional" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Role title</span><input value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} placeholder="Optional" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Target role</span><select value={laneId || effectiveLane?.id || ""} onChange={(event) => { setLaneId(event.target.value); setBaselineVariantId(""); }} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"><option value="">No saved target</option>{state.lanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.title}</option>)}</select></label>
              <label><span className="text-sm font-bold text-paper">Résumé baseline</span><select value={baselineVariantId || effectiveBaseline?.id || ""} onChange={(event) => setBaselineVariantId(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"><option value="">No baseline selected</option>{baselines.map((variant) => <option key={variant.id} value={variant.id}>{variant.kind === "ats" ? "ATS résumé" : "Recruiter résumé"} · {variant.title}</option>)}</select></label>
              <label><span className="text-sm font-bold text-paper">Found on</span><select value={source} onChange={(event) => setSource(event.target.value as typeof source)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"><option value="linkedin">LinkedIn</option><option value="company-site">Company site</option><option value="referral">Referral</option><option value="recruiter">Recruiter</option><option value="other">Other</option></select></label>
              <label><span className="text-sm font-bold text-paper">Job link</span><input value={discoveryUrl} onChange={(event) => setDiscoveryUrl(event.target.value)} placeholder="Optional" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Application link</span><input value={applicationUrl} onChange={(event) => setApplicationUrl(event.target.value)} placeholder="Optional" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Deadline</span><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Posting date</span><input type="date" value={postingDate} onChange={(event) => setPostingDate(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Contact</span><input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Optional" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Contact link</span><input value={contactUrl} onChange={(event) => setContactUrl(event.target.value)} placeholder="Optional" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
            </div>
            <label className="mt-4 block"><span className="text-sm font-bold text-paper">Application questions</span><textarea rows={3} value={questionPrompts} onChange={(event) => setQuestionPrompts(event.target.value)} placeholder="One question per line" className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
          </details>
        </div>

        {analysis && (
          <div className="mt-8 grid gap-6">
            <div className="trust-panel p-5 sm:p-6">
              <p className="trust-kicker text-xs font-bold uppercase">Your match</p>
              <h2 className="mt-2 text-2xl font-bold text-paper">{coveredCount} covered · {partialCount} partial · {gapCount} gaps</h2>
              <p className="mt-2 text-sm leading-6 text-paper/62">{analysis.honestyNote}</p>

              <div className="mt-5 rounded-xl border border-gold/30 bg-gold/10 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-gold">Best next step</p>
                {eligibleRequirement ? (
                  <>
                    <p className="mt-2 text-sm font-bold leading-6 text-paper">Build honest proof for: “{eligibleRequirement.requirement}”</p>
                    <button type="button" onClick={() => startRoleSprint(eligibleRequirement)} className="lab-pill-button mt-4 px-5 py-2.5 text-sm font-black">Start one Role Sprint →</button>
                  </>
                ) : effectiveBaseline && hasFeature("tailored_resume_export") ? (
                  <>
                    <p className="mt-2 text-sm leading-6 text-paper/70">Your strongest next move is tailoring the résumé you already have.</p>
                    <button type="button" onClick={startTailoredResume} className="lab-pill-button mt-4 px-5 py-2.5 text-sm font-black">Build the tailored résumé →</button>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm leading-6 text-paper/70">Save this job, then add a résumé baseline when you are ready to tailor.</p>
                    <button type="button" onClick={() => saveAsApplication("drafting")} className="lab-pill-button mt-4 px-5 py-2.5 text-sm font-black">Save this job →</button>
                  </>
                )}
              </div>
            </div>

            <div className="trust-panel p-5 sm:p-6">
              <h2 className="text-xl font-bold text-paper">Requirements</h2>
              <div className="mt-4 grid gap-2.5">
                {analysis.requirements.length ? analysis.requirements.map((req) => {
                  const eligibility = req.status === "covered" ? null : sprintEligibility(req);
                  const existingSprint = state.roleSprints.find((item) => item.requirement === req.requirement && item.company === company.trim() && item.roleTitle === roleTitle.trim());
                  return (
                    <div key={req.requirement} className="rounded-lg border border-white/12 bg-obsidian/40 p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="max-w-3xl text-sm font-bold leading-5 text-paper">{req.requirement}</p>
                        <span className={`lab-mono shrink-0 rounded-full border px-2.5 py-0.5 text-[0.62rem] font-bold uppercase ${statusStyles[req.status]}`}>{req.status}</span>
                      </div>
                      <p className="mt-1.5 text-[0.78rem] leading-5 text-paper/60">{req.evidence}</p>
                      {eligibility?.eligible && req !== eligibleRequirement && (
                        <button type="button" onClick={() => startRoleSprint(req)} className="mt-2.5 text-xs font-bold text-cyan hover:text-gold">{existingSprint ? "Resume sprint →" : "Build proof for this →"}</button>
                      )}
                      {eligibility && !eligibility.eligible && <p className="mt-2 text-[0.72rem] leading-5 text-paper/42">A short practice task cannot honestly replace this requirement.</p>}
                    </div>
                  );
                }) : <p className="text-sm text-paper/60">Couldn’t isolate the requirements. Paste the posting with its original line breaks.</p>}
              </div>
            </div>

            <details className="trust-panel p-5 sm:p-6">
              <summary className="cursor-pointer text-base font-bold text-cyan">More analysis</summary>
              <div className="mt-5 grid gap-6 lg:grid-cols-2">
                <div><h3 className="font-bold text-paper">Keywords</h3><div className="mt-3 flex flex-wrap gap-2">{analysis.keywords.map((hit) => <span key={hit.term} className={`rounded-full border px-3 py-1 text-xs font-bold ${hit.inProfile ? "border-gold/50 text-gold" : "border-coral/50 text-coral"}`}>{hit.term}</span>)}</div></div>
                <div><h3 className="font-bold text-paper">Weak spots</h3><ul className="mt-3 grid gap-2">{analysis.weakSpots.map((spot) => <li key={spot} className="text-sm leading-6 text-paper/65">• {spot}</li>)}</ul></div>
                <div className="lg:col-span-2"><h3 className="font-bold text-paper">Suggested bullet rewrites</h3><ul className="mt-3 grid gap-2">{analysis.bulletSuggestions.map((item) => <li key={item.suggestion} className="rounded-lg border border-white/10 p-3 text-sm leading-6 text-paper/70">{item.suggestion}</li>)}</ul></div>
              </div>
            </details>

            <details className="rounded-xl border border-white/12 bg-white/5 p-4">
              <summary className="cursor-pointer text-sm font-bold text-paper/65">Other actions</summary>
              <div className="mt-4 flex flex-wrap gap-3">
                {!savedApplication ? (
                  <>
                    <button type="button" onClick={() => saveAsApplication("drafting")} className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-paper/70">Save as draft</button>
                    <button type="button" onClick={() => saveAsApplication("applied")} className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-paper/70">I applied</button>
                  </>
                ) : <Link href="/applications" className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-cyan">Open applications →</Link>}
                {hasFeature("tailored_resume_export") ? (
                  <button type="button" onClick={startTailoredResume} disabled={!effectiveBaseline} className="rounded-md border border-cyan/40 px-4 py-2 text-sm font-bold text-cyan disabled:opacity-40">Build tailored résumé</button>
                ) : <LockedActionPill feature="tailored_resume_export" label="Build tailored résumé" />}
              </div>
            </details>
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
