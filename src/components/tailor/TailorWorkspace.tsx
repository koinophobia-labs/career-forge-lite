"use client";

import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { LockedActionPill } from "@/components/LockedFeature";
import { SiteFooter } from "@/components/SiteFooter";
import { assessJobPost } from "@/lib/input-guidance";
import { sprintEligibility } from "@/lib/role-sprint";
import { useTailorWorkspace } from "@/components/tailor/useTailorWorkspace";

const statusStyles = {
  covered: "border-spruce/60 bg-mint/10 text-mint",
  partial: "border-gold/50 bg-gold/10 text-gold",
  gap: "border-coral/50 bg-coral/10 text-coral"
} as const;

export function TailorWorkspace() {
  const workspace = useTailorWorkspace();
  const {
    state, hydrated, form, setField, handleJobPostChange, analysis, runAnalysis,
    saveAsApplication, startRoleSprint, startTailoredResume, effectiveLane,
    baselines, effectiveBaseline, savedApplicationId, profileReady,
    recommendation, canTailorResume
  } = workspace;

  const eligibleRequirement = recommendation?.requirement ?? null;
  const sprintIsBest = recommendation?.decision === "sprint";
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

        {!profileReady && hydrated && (
          <div className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm leading-6 text-paper/75">
            Results will be more useful after you add some work history. You can still analyze the posting now. <Link href="/profile" className="font-bold text-gold">Add work history</Link>
          </div>
        )}

        <div className="trust-panel mt-7 p-5 sm:p-7">
          <label className="block">
            <span className="text-base font-bold text-paper">Paste the full job posting</span>
            <span className="mt-1 block text-xs leading-5 text-paper/55">Include the responsibilities and qualifications sections.</span>
            <textarea
              aria-label="Paste the full job posting"
              value={form.jobPost}
              rows={12}
              placeholder="Paste the job posting here…"
              onChange={(event) => handleJobPostChange(event.target.value, (event.nativeEvent as InputEvent).inputType)}
              className="trust-input mt-3 w-full border px-3 py-3 text-sm text-ink"
            />
          </label>
          {form.jobPost.trim() && (() => {
            const quality = assessJobPost(form.jobPost);
            return <p className={`mt-2 text-xs leading-5 ${quality.status === "good" ? "text-mint" : "text-gold"}`}>{quality.message}</p>;
          })()}
          <button type="button" onClick={runAnalysis} disabled={!form.jobPost.trim()} className="lab-pill-button mt-5 px-6 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40">Analyze this job →</button>

          <details className="mt-5 border-t border-white/10 pt-4">
            <summary className="cursor-pointer text-sm font-bold text-cyan">Add application details</summary>
            <p className="mt-1 text-xs text-paper/45">Optional. Career Forge will infer and preselect what it can.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label><span className="text-sm font-bold text-paper">Company</span><input value={form.company} onChange={(event) => { setField("company", event.target.value); setField("companyEdited", true); }} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Role title</span><input value={form.roleTitle} onChange={(event) => { setField("roleTitle", event.target.value); setField("roleTitleEdited", true); }} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Target role</span><select value={form.laneId || effectiveLane?.id || ""} onChange={(event) => { setField("laneId", event.target.value); setField("baselineVariantId", ""); }} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"><option value="">No saved target</option>{state.lanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.title}</option>)}</select></label>
              <label><span className="text-sm font-bold text-paper">Résumé baseline</span><select value={form.baselineVariantId || effectiveBaseline?.id || ""} onChange={(event) => setField("baselineVariantId", event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"><option value="">No baseline selected</option>{baselines.map((variant) => <option key={variant.id} value={variant.id}>{variant.kind === "ats" ? "ATS résumé" : "Recruiter résumé"} · {variant.title}</option>)}</select></label>
              <label><span className="text-sm font-bold text-paper">Found on</span><select value={form.source} onChange={(event) => setField("source", event.target.value as typeof form.source)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"><option value="linkedin">LinkedIn</option><option value="company-site">Company site</option><option value="referral">Referral</option><option value="recruiter">Recruiter</option><option value="other">Other</option></select></label>
              <label><span className="text-sm font-bold text-paper">Job link</span><input value={form.discoveryUrl} onChange={(event) => setField("discoveryUrl", event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Application link</span><input value={form.applicationUrl} onChange={(event) => setField("applicationUrl", event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Deadline</span><input type="date" value={form.deadline} onChange={(event) => setField("deadline", event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Posting date</span><input type="date" value={form.postingDate} onChange={(event) => setField("postingDate", event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Contact</span><input value={form.contactName} onChange={(event) => setField("contactName", event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
              <label><span className="text-sm font-bold text-paper">Contact link</span><input value={form.contactUrl} onChange={(event) => setField("contactUrl", event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
            </div>
            <label className="mt-4 block"><span className="text-sm font-bold text-paper">Application questions</span><textarea rows={3} value={form.questionPrompts} onChange={(event) => setField("questionPrompts", event.target.value)} className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink" /></label>
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
                {eligibleRequirement && sprintIsBest ? (
                  <>
                    <p className="mt-2 text-sm font-bold leading-6 text-paper">Build honest proof for: “{eligibleRequirement.requirement}”</p>
                    <p className="mt-1 text-xs leading-5 text-paper/55">{recommendation?.reason}</p>
                    <button type="button" onClick={() => startRoleSprint(eligibleRequirement)} className="lab-pill-button mt-4 px-5 py-2.5 text-sm font-black">Start one Role Sprint →</button>
                    <p className="mt-2 text-xs text-paper/45">This job will be saved automatically so the sprint can return here.</p>
                  </>
                ) : recommendation?.decision === "apply-first" && effectiveBaseline && canTailorResume ? (
                  <>
                    <p className="mt-2 text-sm font-bold leading-6 text-paper">Apply with the experience you already have.</p>
                    <p className="mt-1 text-xs leading-5 text-paper/55">{recommendation.reason}</p>
                    <button type="button" onClick={startTailoredResume} className="lab-pill-button mt-4 px-5 py-2.5 text-sm font-black">Build the tailored résumé →</button>
                  </>
                ) : effectiveBaseline && canTailorResume ? (
                  <>
                    <p className="mt-2 text-sm leading-6 text-paper/70">Your strongest next move is tailoring the résumé you already have.</p>
                    <button type="button" onClick={startTailoredResume} className="lab-pill-button mt-4 px-5 py-2.5 text-sm font-black">Build the tailored résumé →</button>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm leading-6 text-paper/70">Save this job, then add a résumé baseline before deciding whether practice is worth delaying the application.</p>
                    {recommendation?.reason && <p className="mt-1 text-xs leading-5 text-paper/55">{recommendation.reason}</p>}
                    <button type="button" onClick={() => saveAsApplication("drafting")} className="lab-pill-button mt-4 px-5 py-2.5 text-sm font-black">Save this job →</button>
                  </>
                )}
              </div>
            </div>

            <div className="trust-panel p-5 sm:p-6">
              <h2 className="text-xl font-bold text-paper">Requirements</h2>
              <div className="mt-4 grid gap-2.5">
                {analysis.requirements.length ? analysis.requirements.map((requirement) => {
                  const eligibility = requirement.status === "covered" ? null : sprintEligibility(requirement);
                  const existingSprint = state.roleSprints.find((item) => item.requirement === requirement.requirement && item.applicationId === savedApplicationId);
                  const shownAsPrimarySprint = sprintIsBest && requirement === eligibleRequirement;
                  return (
                    <div key={requirement.requirement} className="rounded-lg border border-white/12 bg-obsidian/40 p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2"><p className="max-w-3xl text-sm font-bold leading-5 text-paper">{requirement.requirement}</p><span className={`lab-mono shrink-0 rounded-full border px-2.5 py-0.5 text-[0.62rem] font-bold uppercase ${statusStyles[requirement.status]}`}>{requirement.status}</span></div>
                      <p className="mt-1.5 text-[0.78rem] leading-5 text-paper/60">{requirement.evidence}</p>
                      {eligibility?.eligible && !shownAsPrimarySprint && (
                        <button type="button" onClick={() => startRoleSprint(requirement)} className="mt-2.5 text-xs font-bold text-cyan">
                          {existingSprint ? "Resume sprint →" : recommendation?.decision === "apply-first" && requirement === eligibleRequirement ? "Practice this after applying →" : "Build proof for this →"}
                        </button>
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
                <button type="button" onClick={() => saveAsApplication("drafting")} className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-paper/70">{savedApplicationId ? "Save changes" : "Save as draft"}</button>
                <button type="button" onClick={() => saveAsApplication("applied")} className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-paper/70">I applied</button>
                {savedApplicationId && <Link href="/applications" className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-cyan">Open applications →</Link>}
                {canTailorResume ? <button type="button" onClick={startTailoredResume} disabled={!effectiveBaseline} className="rounded-md border border-cyan/40 px-4 py-2 text-sm font-bold text-cyan disabled:opacity-40">Build tailored résumé</button> : <LockedActionPill feature="tailored_resume_export" label="Build tailored résumé" />}
              </div>
            </details>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
