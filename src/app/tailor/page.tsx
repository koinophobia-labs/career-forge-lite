"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { LockedActionPill } from "@/components/LockedFeature";
import { SiteFooter } from "@/components/SiteFooter";
import { activationEventsForTransition } from "@/lib/activation";
import { trackCareerEvent } from "@/lib/analytics";
import { draftApplicationQuestion } from "@/lib/application-questions";
import { APPLICATION_FOLLOW_UP_DAYS, addDays } from "@/lib/command-center-insights";
import { createId } from "@/lib/command-center-store";
import { assessDossierReadiness } from "@/lib/dossier";
import { useEntitlement } from "@/lib/entitlement";
import { assessJobPost } from "@/lib/input-guidance";
import { analyzeJobPost, type JobPostAnalysis, type RequirementMatch } from "@/lib/job-post-analyzer";
import { applicationJobPost, encodeJobPostText } from "@/lib/job-workspace";
import { createRoleSprint, sprintEligibility } from "@/lib/role-sprint";
import { recommendRoleSprintRequirement } from "@/lib/role-sprint-ux";
import { buildHandoff, saveHandoff } from "@/lib/tailor-handoff";
import { useCommandCenter } from "@/lib/use-command-center";
import type { ApplicationRecord } from "@/types/command-center";

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

function firstPostingLine(value: string): string {
  return value.split(/\n+/).map((line) => line.trim()).find(Boolean) ?? "";
}

export default function TailorPage() {
  const { state, update, hydrated } = useCommandCenter();
  const { hasFeature } = useEntitlement();
  const router = useRouter();
  const loadedApplicationRef = useRef<string | null>(null);

  const [jobPost, setJobPost] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [companyEdited, setCompanyEdited] = useState(false);
  const [roleTitleEdited, setRoleTitleEdited] = useState(false);
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
  const [savedApplicationId, setSavedApplicationId] = useState<string | null>(null);

  const effectiveLane = useMemo(
    () => state.lanes.find((lane) => lane.id === laneId) ?? state.lanes.find((lane) => lane.status === "active") ?? state.lanes[0] ?? null,
    [laneId, state.lanes]
  );
  const currentPack = useMemo(() => [...state.resumePacks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null, [state.resumePacks]);
  const baselines = useMemo(
    () => currentPack?.variants.filter((variant) => variant.kind !== "job-specific" && (!effectiveLane || variant.laneId === effectiveLane.id)) ?? [],
    [currentPack, effectiveLane]
  );
  const effectiveBaseline = baselines.find((variant) => variant.id === baselineVariantId) ?? baselines.find((variant) => variant.kind === "ats") ?? baselines[0] ?? null;
  const profileReady = hydrated && assessDossierReadiness(state.dossier).level !== "not-ready";

  useEffect(() => {
    if (!hydrated || loadedApplicationRef.current) return;
    const applicationId = new URLSearchParams(window.location.search).get("applicationId");
    const application = applicationId ? state.applications.find((item) => item.id === applicationId) : null;
    const savedPost = application ? applicationJobPost(application) : "";
    if (!application || !savedPost) return;

    loadedApplicationRef.current = application.id;
    setJobPost(savedPost);
    setCompany(application.company === "Unknown company" ? "" : application.company);
    setRoleTitle(application.roleTitle === "Untitled role" ? "" : application.roleTitle);
    setCompanyEdited(true);
    setRoleTitleEdited(true);
    setLaneId(application.laneId ?? "");
    setBaselineVariantId(application.resumeVariantId ?? "");
    setSource(application.source);
    setDiscoveryUrl(application.discoveryUrl);
    setApplicationUrl(application.applicationUrl);
    setPostingDate(application.postingDate?.slice(0, 10) ?? "");
    setDeadline(application.deadline?.slice(0, 10) ?? "");
    setContactName(application.contactName);
    setContactUrl(application.contactUrl);
    setQuestionPrompts(application.applicationQuestions.map((question) => question.prompt).join("\n"));
    setSavedApplicationId(application.id);
    const lane = state.lanes.find((item) => item.id === application.laneId) ?? effectiveLane;
    setAnalysis(analyzeJobPost(savedPost, state.profile, lane, state.dossier));
  }, [effectiveLane, hydrated, state.applications, state.dossier, state.lanes, state.profile]);

  function handleJobPostChange(nextPost: string) {
    const newPosting = Boolean(jobPost.trim()) && firstPostingLine(jobPost) !== firstPostingLine(nextPost) && (analysis !== null || Math.abs(nextPost.length - jobPost.length) > 40);
    setJobPost(nextPost);
    setAnalysis(null);
    if (newPosting) {
      setSavedApplicationId(null);
      loadedApplicationRef.current = null;
      setCompanyEdited(false);
      setRoleTitleEdited(false);
    }
    const inferred = inferJobIdentity(nextPost);
    if (newPosting || !companyEdited) setCompany(inferred.company);
    if (newPosting || !roleTitleEdited) setRoleTitle(inferred.roleTitle);
  }

  function runAnalysis() {
    if (!jobPost.trim()) return;
    const inferred = inferJobIdentity(jobPost);
    if (!companyEdited) setCompany(inferred.company);
    if (!roleTitleEdited) setRoleTitle(inferred.roleTitle);
    trackCareerEvent("job_tailor_started");
    trackCareerEvent("tailor_started");
    setAnalysis(analyzeJobPost(jobPost, state.profile, effectiveLane, state.dossier));
  }

  function buildApplication(id: string, status: "drafting" | "applied", current?: ApplicationRecord): ApplicationRecord {
    const nowIso = new Date().toISOString();
    const inferred = inferJobIdentity(jobPost);
    const questions = questionPrompts.trim()
      ? questionPrompts.split(/\n+/).map((prompt) => prompt.trim()).filter(Boolean).map((prompt, index) => draftApplicationQuestion(prompt, state.dossier, `${id}-question-${index + 1}`))
      : current?.applicationQuestions ?? [];
    return {
      id,
      company: company.trim() || inferred.company || "Unknown company",
      roleTitle: roleTitle.trim() || inferred.roleTitle || effectiveLane?.title || "Untitled role",
      laneId: effectiveLane?.id ?? null,
      status,
      jobPostUrl: encodeJobPostText(jobPost),
      source,
      discoveryUrl: discoveryUrl.trim(),
      applicationUrl: applicationUrl.trim(),
      postingDate: postingDate ? new Date(postingDate).toISOString() : null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      contactName: contactName.trim(),
      contactUrl: contactUrl.trim(),
      resumeVariantId: effectiveBaseline?.id ?? current?.resumeVariantId ?? null,
      applicationQuestions: questions,
      resumeVersionId: current?.resumeVersionId ?? null,
      appliedAt: status === "applied" ? current?.appliedAt ?? nowIso : current?.appliedAt ?? null,
      nextFollowUpAt: status === "applied" ? current?.nextFollowUpAt ?? addDays(nowIso, APPLICATION_FOLLOW_UP_DAYS) : current?.nextFollowUpAt ?? null,
      followUpsSent: current?.followUpsSent ?? [],
      interviewAt: current?.interviewAt ?? null,
      notes: current?.notes || (analysis ? `Tailoring notes — top keywords: ${analysis.keywords.slice(0, 6).map((hit) => hit.term).join(", ")}` : ""),
      analysisKeywords: analysis ? analysis.keywords.slice(0, 10).map((hit) => hit.term) : current?.analysisKeywords ?? [],
      analysisGaps: analysis ? analysis.requirements.filter((item) => item.status !== "covered").map((item) => item.requirement).slice(0, 6) : current?.analysisGaps ?? [],
      analysisWeakSpots: analysis ? analysis.weakSpots.slice(0, 4) : current?.analysisWeakSpots ?? [],
      createdAt: current?.createdAt ?? nowIso
    };
  }

  function saveAsApplication(status: "drafting" | "applied"): string {
    const id = savedApplicationId ?? createId("app");
    let events: ReturnType<typeof activationEventsForTransition> = [];
    update((current) => {
      const existing = current.applications.find((item) => item.id === id);
      const record = buildApplication(id, status, existing);
      const next = { ...current, applications: existing ? current.applications.map((item) => item.id === id ? record : item) : [...current.applications, record] };
      events = activationEventsForTransition(current, next);
      return next;
    });
    setSavedApplicationId(id);
    loadedApplicationRef.current = id;
    events.forEach(trackCareerEvent);
    return id;
  }

  function startRoleSprint(requirement: RequirementMatch) {
    const applicationId = saveAsApplication("drafting");
    const nowIso = new Date().toISOString();
    let sprintId = "";
    update((current) => {
      const existing = current.roleSprints.find((item) => item.requirement === requirement.requirement && item.applicationId === applicationId);
      if (existing) {
        sprintId = existing.id;
        return current;
      }
      const application = current.applications.find((item) => item.id === applicationId);
      const sprint = createRoleSprint({
        requirement,
        company: application?.company ?? company,
        roleTitle: application?.roleTitle ?? (roleTitle || effectiveLane?.title || ""),
        applicationId,
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
    const applicationId = saveAsApplication("drafting");
    saveHandoff(buildHandoff({ analysis, lane: effectiveLane, company, roleTitle, applicationId, baselineVariantId: effectiveBaseline.id }));
    trackCareerEvent("application_pack_completed");
    router.push("/resume-builder");
  }

  const statusStyles = {
    covered: "border-spruce/60 bg-mint/10 text-mint",
    partial: "border-gold/50 bg-gold/10 text-gold",
    gap: "border-coral/50 bg-coral/10 text-coral"
  } as const;
  const recommendation = analysis ? recommendRoleSprintRequirement(analysis.requirements, jobPost) : null;
  const eligibleRequirement = recommendation?.requirement ?? null;
  const coveredCount = analysis?.requirements.filter((item) => item.status === "covered").length ?? 0;
  const partialCount = analysis?.requirements.filter((item) => item.status === "partial").length ?? 0;
  const gapCount = analysis?.requirements.filter((item) => item.status === "gap").length ?? 0;

  return (
    <main id="main">
      <CommandNav active="/tailor" />
      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Jobs</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Paste a job. See what you can prove.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">Career Forge compares the real posting with the experience you approved. The job post is the only required input.</p>

        {!profileReady && hydrated && <div className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-6 text-paper/75">Results will be more useful after you add some work history. You can still analyze the posting now. <Link href="/profile" className="font-bold text-gold">Add work history</Link></div>}

        <div className="trust-panel mt-7 p-5 sm:p-7">
          <label className="block">
            <span className="text-base font-bold text-paper">Paste the full job posting</span>
            <span className="mt-1 block text-xs leading-5 text-paper/55">Include the responsibilities and qualifications sections.</span>
            <textarea value={jobPost} rows={12} placeholder="Paste the job posting here…" onChange={(event) => handleJobPostChange(event.target.value)} className="trust-input mt-3 w-full border px-3 py-3 text-sm text-ink" />
          </label>
          {jobPost.trim() && (() => { const quality = assessJobPost(jobPost); return <p className={`mt-2 text-xs leading-5 ${quality.status === "good" ? "text-mint" : "text-gold"}`}>{quality.message}</p>; })()}
          <button type="button" onClick={runAnalysis} disabled={!jobPost.trim()} className="lab-pill-button mt-5 px-6 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40">Analyze this job →</button>

          <details className="mt-5 border-t border-white/10 pt-4">
            <summary className="cursor-pointer text-sm font-bold text-cyan">Add application details</summary>
            <p className="mt-1 text-xs text-paper/45">Optional. Career Forge will infer and preselect what it can.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label><span className="text-sm font-bold text-paper">Company</span><input value={company} onChange={(event) => { setCompany(event.target.value); setCompanyEdited(true); }} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Role title</span><input value={roleTitle} onChange={(event) => { setRoleTitle(event.target.value); setRoleTitleEdited(true); }} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Target role</span><select value={laneId || effectiveLane?.id || ""} onChange={(event) => { setLaneId(event.target.value); setBaselineVariantId(""); }} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"><option value="">No saved target</option>{state.lanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.title}</option>)}</select></label>
              <label><span className="text-sm font-bold text-paper">Résumé baseline</span><select value={baselineVariantId || effectiveBaseline?.id || ""} onChange={(event) => setBaselineVariantId(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"><option value="">No baseline selected</option>{baselines.map((variant) => <option key={variant.id} value={variant.id}>{variant.kind === "ats" ? "ATS résumé" : "Recruiter résumé"} · {variant.title}</option>)}</select></label>
              <label><span className="text-sm font-bold text-paper">Found on</span><select value={source} onChange={(event) => setSource(event.target.value as typeof source)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"><option value="linkedin">LinkedIn</option><option value="company-site">Company site</option><option value="referral">Referral</option><option value="recruiter">Recruiter</option><option value="other">Other</option></select></label>
              <label><span className="text-sm font-bold text-paper">Job link</span><input value={discoveryUrl} onChange={(event) => setDiscoveryUrl(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Application link</span><input value={applicationUrl} onChange={(event) => setApplicationUrl(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Deadline</span><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Posting date</span><input type="date" value={postingDate} onChange={(event) => setPostingDate(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Contact</span><input value={contactName} onChange={(event) => setContactName(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Contact link</span><input value={contactUrl} onChange={(event) => setContactUrl(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
            </div>
            <label className="mt-4 block"><span className="text-sm font-bold text-paper">Application questions</span><textarea rows={3} value={questionPrompts} onChange={(event) => setQuestionPrompts(event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
          </details>
        </div>

        {analysis && <div className="mt-8 grid gap-6">
          <div className="trust-panel p-5 sm:p-6">
            <p className="trust-kicker text-xs font-bold uppercase">Your match</p>
            <h2 className="mt-2 text-2xl font-bold text-paper">{coveredCount} covered · {partialCount} partial · {gapCount} gaps</h2>
            <p className="mt-2 text-sm leading-6 text-paper/62">{analysis.honestyNote}</p>
            <div className="mt-5 rounded-xl border border-gold/30 bg-gold/10 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gold">Best next step</p>
              {eligibleRequirement ? <>
                <p className="mt-2 text-sm font-bold leading-6 text-paper">Build honest proof for: “{eligibleRequirement.requirement}”</p>
                <p className="mt-1 text-xs leading-5 text-paper/55">{recommendation?.reason}</p>
                <button type="button" onClick={() => startRoleSprint(eligibleRequirement)} className="lab-pill-button mt-4 px-5 py-2.5 text-sm font-black">Start one Role Sprint →</button>
                <p className="mt-2 text-xs text-paper/45">This job will be saved automatically so the sprint can return here.</p>
              </> : effectiveBaseline && hasFeature("tailored_resume_export") ? <>
                <p className="mt-2 text-sm leading-6 text-paper/70">Your strongest next move is tailoring the résumé you already have.</p>
                <button type="button" onClick={startTailoredResume} className="lab-pill-button mt-4 px-5 py-2.5 text-sm font-black">Build the tailored résumé →</button>
              </> : <>
                <p className="mt-2 text-sm leading-6 text-paper/70">Save this job, then add a résumé baseline when you are ready to tailor.</p>
                <button type="button" onClick={() => saveAsApplication("drafting")} className="lab-pill-button mt-4 px-5 py-2.5 text-sm font-black">Save this job →</button>
              </>}
            </div>
          </div>

          <div className="trust-panel p-5 sm:p-6">
            <h2 className="text-xl font-bold text-paper">Requirements</h2>
            <div className="mt-4 grid gap-2.5">{analysis.requirements.length ? analysis.requirements.map((requirement) => {
              const eligibility = requirement.status === "covered" ? null : sprintEligibility(requirement);
              const existingSprint = state.roleSprints.find((item) => item.requirement === requirement.requirement && item.applicationId === savedApplicationId);
              return <div key={requirement.requirement} className="rounded-lg border border-white/12 bg-obsidian/40 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2"><p className="max-w-3xl text-sm font-bold leading-5 text-paper">{requirement.requirement}</p><span className={`lab-mono shrink-0 rounded-full border px-2.5 py-0.5 text-[0.62rem] font-bold uppercase ${statusStyles[requirement.status]}`}>{requirement.status}</span></div>
                <p className="mt-1.5 text-[0.78rem] leading-5 text-paper/60">{requirement.evidence}</p>
                {eligibility?.eligible && requirement !== eligibleRequirement && <button type="button" onClick={() => startRoleSprint(requirement)} className="mt-2.5 text-xs font-bold text-cyan">{existingSprint ? "Resume sprint →" : "Build proof for this →"}</button>}
                {eligibility && !eligibility.eligible && <p className="mt-2 text-[0.72rem] leading-5 text-paper/42">A short practice task cannot honestly replace this requirement.</p>}
              </div>;
            }) : <p className="text-sm text-paper/60">Couldn’t isolate the requirements. Paste the posting with its original line breaks.</p>}</div>
          </div>

          <details className="trust-panel p-5 sm:p-6"><summary className="cursor-pointer text-base font-bold text-cyan">More analysis</summary><div className="mt-5 grid gap-6 lg:grid-cols-2"><div><h3 className="font-bold text-paper">Keywords</h3><div className="mt-3 flex flex-wrap gap-2">{analysis.keywords.map((hit) => <span key={hit.term} className={`rounded-full border px-3 py-1 text-xs font-bold ${hit.inProfile ? "border-gold/50 text-gold" : "border-coral/50 text-coral"}`}>{hit.term}</span>)}</div></div><div><h3 className="font-bold text-paper">Weak spots</h3><ul className="mt-3 grid gap-2">{analysis.weakSpots.map((spot) => <li key={spot} className="text-sm leading-6 text-paper/65">• {spot}</li>)}</ul></div><div className="lg:col-span-2"><h3 className="font-bold text-paper">Suggested bullet rewrites</h3><ul className="mt-3 grid gap-2">{analysis.bulletSuggestions.map((item) => <li key={item.suggestion} className="rounded-lg border border-white/10 p-3 text-sm leading-6 text-paper/70">{item.suggestion}</li>)}</ul></div></div></details>

          <details className="rounded-xl border border-white/12 bg-white/5 p-4"><summary className="cursor-pointer text-sm font-bold text-paper/65">Other actions</summary><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => saveAsApplication("drafting")} className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-paper/70">{savedApplicationId ? "Save changes" : "Save as draft"}</button><button type="button" onClick={() => saveAsApplication("applied")} className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-paper/70">I applied</button>{savedApplicationId && <Link href="/applications" className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-cyan">Open applications →</Link>}{hasFeature("tailored_resume_export") ? <button type="button" onClick={startTailoredResume} disabled={!effectiveBaseline} className="rounded-md border border-cyan/40 px-4 py-2 text-sm font-bold text-cyan disabled:opacity-40">Build tailored résumé</button> : <LockedActionPill feature="tailored_resume_export" label="Build tailored résumé" />}</div></details>
        </div>}
      </section>
      <SiteFooter />
    </main>
  );
}
