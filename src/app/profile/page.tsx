"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import {
  assessDossierReadiness,
  evidenceRecord,
  parseResumeTextToProposal,
  withUpdatedDossier
} from "@/lib/dossier";
import { createId } from "@/lib/command-center-store";
import { trackCareerEvent } from "@/lib/analytics";
import { useCommandCenter } from "@/lib/use-command-center";
import type { CareerDossier, DossierEducation, DossierProject, DossierRole } from "@/types/dossier";

function values(text: string): string[] {
  return [...new Set(text.split(/\n|,|;/).map((item) => item.trim()).filter(Boolean))];
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/12 bg-obsidian/40 p-4">
      <p className="text-2xl font-black text-paper">{value}</p>
      <p className="lab-mono mt-1 text-[0.65rem] font-bold uppercase text-paper/50">{label}</p>
    </div>
  );
}

function TextListEditor({ label, value, hint, onSave }: { label: string; value: string[]; hint: string; onSave: (items: string[]) => void }) {
  const [draft, setDraft] = useState(value.join("\n"));
  return (
    <label className="block">
      <span className="lab-mono text-[0.68rem] font-bold uppercase text-gold">{label}</span>
      <textarea className="trust-input mt-1.5 w-full border px-3 py-2 text-sm text-ink" rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => onSave(values(draft))} />
      <span className="mt-1 block text-xs leading-5 text-paper/45">{hint}</span>
    </label>
  );
}

export default function DossierPage() {
  const { state, update, hydrated } = useCommandCenter();
  const dossier = state.dossier;
  const readiness = useMemo(() => assessDossierReadiness(dossier), [dossier]);
  const [role, setRole] = useState({ title: "", employer: "", dates: "", responsibilities: "" });
  const [project, setProject] = useState({ name: "", organization: "", dates: "", description: "" });
  const [education, setEducation] = useState({ credential: "", institution: "", dates: "" });
  const [resumeText, setResumeText] = useState("");
  const [imported, setImported] = useState(false);

  function save(next: CareerDossier) {
    update((current) => withUpdatedDossier(current, { ...next, updatedAt: new Date().toISOString() }));
  }

  function patchIdentity(field: keyof CareerDossier["identity"], value: string | string[]) {
    save({ ...dossier, identity: { ...dossier.identity, [field]: value } });
  }

  function addRole() {
    if (!role.title.trim() && !role.employer.trim()) return;
    const now = new Date().toISOString();
    const responsibilities = values(role.responsibilities);
    const roleEvidence = evidenceRecord("role", [role.title, role.employer, role.dates].filter(Boolean).join(" · "), "manual", true, now, { label: "Employment record" });
    const responsibilityEvidence = responsibilities.map((item) => evidenceRecord("responsibility", item, "manual", true, now, { label: "Role responsibility" }));
    const record: DossierRole = {
      id: createId("role"), title: role.title.trim(), employer: role.employer.trim(), startDate: role.dates.trim(), endDate: "",
      current: /present|current|now/i.test(role.dates), responsibilities, tools: [], outcomes: [],
      evidenceIds: [roleEvidence.id, ...responsibilityEvidence.map((item) => item.id)]
    };
    save({
      ...dossier,
      roles: [...dossier.roles, record],
      responsibilities: [...new Set([...dossier.responsibilities, ...responsibilities])],
      evidence: [...dossier.evidence, roleEvidence, ...responsibilityEvidence],
      approvedClaims: [...new Set([...dossier.approvedClaims, roleEvidence.detail, ...responsibilities])]
    });
    trackCareerEvent("dossier_evidence_added");
    setRole({ title: "", employer: "", dates: "", responsibilities: "" });
  }

  function approveEvidence(id: string, approved: boolean) {
    const evidence = dossier.evidence.map((item) => item.id === id ? { ...item, approved, updatedAt: new Date().toISOString() } : item);
    save({
      ...dossier,
      evidence,
      approvedClaims: [...new Set(evidence.filter((item) => item.approved).map((item) => item.detail))]
    });
  }

  function addProject() {
    if (!project.name.trim()) return;
    const now = new Date().toISOString();
    const detail = [project.name, project.organization, project.dates, project.description].filter(Boolean).join(" · ");
    const proof = evidenceRecord("project", detail, "manual", true, now, { label: "Independent work or project" });
    const record: DossierProject = { id: createId("project"), name: project.name.trim(), organization: project.organization.trim(), dates: project.dates.trim(), description: project.description.trim(), responsibilities: [], tools: [], outcomes: [], evidenceIds: [proof.id] };
    save({ ...dossier, projects: [...dossier.projects, record], evidence: [...dossier.evidence, proof], approvedClaims: [...new Set([...dossier.approvedClaims, proof.detail])] });
    trackCareerEvent("dossier_evidence_added");
    setProject({ name: "", organization: "", dates: "", description: "" });
  }

  function addEducation() {
    if (!education.credential.trim()) return;
    const now = new Date().toISOString();
    const detail = [education.credential, education.institution, education.dates].filter(Boolean).join(" · ");
    const proof = evidenceRecord("education", detail, "manual", true, now, { label: "Education or credential" });
    const record: DossierEducation = { id: createId("education"), credential: education.credential.trim(), institution: education.institution.trim(), field: "", dates: education.dates.trim(), evidenceIds: [proof.id] };
    save({ ...dossier, education: [...dossier.education, record], evidence: [...dossier.evidence, proof], approvedClaims: [...new Set([...dossier.approvedClaims, proof.detail])] });
    trackCareerEvent("dossier_evidence_added");
    setEducation({ credential: "", institution: "", dates: "" });
  }

  function importResume() {
    if (!resumeText.trim()) return;
    const proposals = parseResumeTextToProposal(resumeText);
    const existing = new Set(dossier.evidence.map((item) => item.id));
    save({
      ...dossier,
      evidence: [...dossier.evidence, ...proposals.filter((item) => !existing.has(item.id))],
      migrationReview: [...new Set([...dossier.migrationReview, "Review and approve each imported résumé line before it can support generated claims."])]
    });
    setImported(true);
  }

  const approvedCount = dossier.evidence.filter((item) => item.approved).length;
  const proposed = dossier.evidence.filter((item) => !item.approved);

  return (
    <main>
      <CommandNav active="/profile" />
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Step 1 · Canonical source of truth</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-5xl">Build your Career Dossier once.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-paper/68">
          Every lane résumé, LinkedIn section, and application pack starts here. Facts stay on this device and are only used after you approve them.
        </p>

        {hydrated && (
          <>
            <section className="trust-panel mt-8 p-5 sm:p-6" aria-labelledby="arsenal-title">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="trust-kicker text-xs font-bold uppercase">Career Arsenal</p>
                  <h2 id="arsenal-title" className="mt-2 text-2xl font-bold text-paper">{readiness.level === "resume-ready" ? "Résumé-pack ready" : readiness.level === "foundation" ? "A credible foundation is forming" : "Start with one real role or project"}</h2>
                  <p className="mt-2 text-sm leading-6 text-paper/60">Readiness is based on approved evidence quality, not a field-count percentage.</p>
                </div>
                <span className={`lab-mono rounded-full border px-3 py-1.5 text-xs font-bold uppercase ${readiness.level === "resume-ready" ? "border-mint/40 bg-mint/10 text-mint" : "border-gold/40 bg-gold/10 text-gold"}`}>{readiness.level.replace("-", " ")}</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                <MetricCard label="Roles" value={dossier.roles.length} />
                <MetricCard label="Projects" value={dossier.projects.length} />
                <MetricCard label="Tools" value={dossier.tools.length} />
                <MetricCard label="Proof points" value={dossier.proofPoints.length} />
                <MetricCard label="Metrics" value={dossier.metrics.length} />
                <MetricCard label="Approved claims" value={approvedCount} />
                <MetricCard label="Active lanes" value={state.lanes.filter((lane) => lane.status === "active").length} />
              </div>
              <ul className="mt-5 grid gap-2 md:grid-cols-2">
                {readiness.nextActions.map((item) => <li key={item} className="rounded-lg border border-gold/25 bg-gold/10 px-3 py-2 text-sm leading-5 text-paper/75">{item}</li>)}
              </ul>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="trust-panel p-5">
                <h2 className="text-xl font-bold text-paper">Identity &amp; professional links</h2>
                <p className="mt-1 text-sm text-paper/55">Add once; it appears across every résumé.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {([[
                    "fullName", "Full name", "Name"
                  ], ["email", "Email", "you@example.com"], ["phone", "Phone", "Phone"], ["location", "Location", "City, State"]] as const).map(([field, label, placeholder]) => (
                    <label key={field} className="block"><span className="text-xs font-bold text-paper/60">{label}</span><input className="trust-input mt-1 w-full border px-3 py-2 text-sm text-ink" placeholder={placeholder} value={dossier.identity[field]} onChange={(event) => patchIdentity(field, event.target.value)} /></label>
                  ))}
                </div>
                <label className="mt-3 block"><span className="text-xs font-bold text-paper/60">LinkedIn / portfolio links</span><input className="trust-input mt-1 w-full border px-3 py-2 text-sm text-ink" value={dossier.identity.links.join(", ")} onChange={(event) => patchIdentity("links", values(event.target.value))} /></label>
              </div>

              <div className="trust-panel p-5">
                <h2 className="text-xl font-bold text-paper">Add an employment record</h2>
                <p className="mt-1 text-sm text-paper/55">Structured roles unlock reusable experience sections and interview stories.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input aria-label="Role title" className="trust-input border px-3 py-2 text-sm text-ink" placeholder="Role title" value={role.title} onChange={(event) => setRole({ ...role, title: event.target.value })} />
                  <input aria-label="Employer" className="trust-input border px-3 py-2 text-sm text-ink" placeholder="Employer" value={role.employer} onChange={(event) => setRole({ ...role, employer: event.target.value })} />
                  <input aria-label="Dates" className="trust-input border px-3 py-2 text-sm text-ink sm:col-span-2" placeholder="Dates, e.g. 2022–Present" value={role.dates} onChange={(event) => setRole({ ...role, dates: event.target.value })} />
                  <textarea aria-label="Responsibilities" className="trust-input border px-3 py-2 text-sm text-ink sm:col-span-2" rows={3} placeholder="One recurring responsibility per line" value={role.responsibilities} onChange={(event) => setRole({ ...role, responsibilities: event.target.value })} />
                </div>
                <button type="button" onClick={addRole} className="mt-3 rounded-md bg-gold px-4 py-2 text-sm font-black text-ink transition hover:bg-cyan">Add approved role</button>
                {dossier.roles.length > 0 && <ul className="mt-4 grid gap-2">{dossier.roles.map((item) => <li key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-paper/75"><strong>{item.title || "Role"}</strong>{item.employer ? ` · ${item.employer}` : ""}{item.startDate ? ` · ${item.startDate}` : ""}</li>)}</ul>}
              </div>
            </section>

            <section className="trust-panel mt-6 p-5 sm:p-6">
              <h2 className="text-xl font-bold text-paper">Projects, independent work &amp; education</h2>
              <p className="mt-1 text-sm text-paper/55">Founders and recent graduates can build a defensible dossier without conventional employment.</p>
              <div className="mt-5 grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-white/12 bg-obsidian/35 p-4"><h3 className="font-bold text-paper">Add a project or independent venture</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><input aria-label="Project name" className="trust-input border px-3 py-2 text-sm text-ink" placeholder="Project name" value={project.name} onChange={(event) => setProject({ ...project, name: event.target.value })} /><input aria-label="Project organization" className="trust-input border px-3 py-2 text-sm text-ink" placeholder="Organization or Independent" value={project.organization} onChange={(event) => setProject({ ...project, organization: event.target.value })} /><input aria-label="Project dates" className="trust-input border px-3 py-2 text-sm text-ink sm:col-span-2" placeholder="Dates" value={project.dates} onChange={(event) => setProject({ ...project, dates: event.target.value })} /><textarea aria-label="Project description" className="trust-input border px-3 py-2 text-sm text-ink sm:col-span-2" rows={3} placeholder="What you built, did, or shipped—no assumed outcomes" value={project.description} onChange={(event) => setProject({ ...project, description: event.target.value })} /></div><button type="button" onClick={addProject} className="mt-3 rounded-md bg-gold px-4 py-2 text-sm font-black text-ink">Add approved project</button>{dossier.projects.map((item) => <p key={item.id} className="mt-2 text-sm text-paper/65">{item.name}{item.organization ? ` · ${item.organization}` : ""}</p>)}</div>
                <div className="rounded-xl border border-white/12 bg-obsidian/35 p-4"><h3 className="font-bold text-paper">Add education or a credential</h3><div className="mt-3 grid gap-3"><input aria-label="Credential" className="trust-input border px-3 py-2 text-sm text-ink" placeholder="Degree, certificate, course, or training" value={education.credential} onChange={(event) => setEducation({ ...education, credential: event.target.value })} /><input aria-label="Institution" className="trust-input border px-3 py-2 text-sm text-ink" placeholder="Institution" value={education.institution} onChange={(event) => setEducation({ ...education, institution: event.target.value })} /><input aria-label="Education dates" className="trust-input border px-3 py-2 text-sm text-ink" placeholder="Dates" value={education.dates} onChange={(event) => setEducation({ ...education, dates: event.target.value })} /></div><button type="button" onClick={addEducation} className="mt-3 rounded-md bg-gold px-4 py-2 text-sm font-black text-ink">Add approved education</button>{dossier.education.map((item) => <p key={item.id} className="mt-2 text-sm text-paper/65">{item.credential}{item.institution ? ` · ${item.institution}` : ""}</p>)}</div>
              </div>
            </section>

            <section className="trust-panel mt-6 p-5 sm:p-6">
              <h2 className="text-xl font-bold text-paper">Evidence that powers every output</h2>
              <p className="mt-1 text-sm leading-6 text-paper/55">Use one item per line. These claims become reusable only after they are saved as approved dossier evidence.</p>
              <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <TextListEditor label="Tools & workflows" value={dossier.tools} hint="Unlocks accurate keyword matching." onSave={(items) => save({ ...dossier, tools: items, evidence: [...dossier.evidence.filter((item) => item.kind !== "tool" || item.source !== "manual"), ...items.map((item) => evidenceRecord("tool", item, "manual", true, new Date().toISOString()))] })} />
                <TextListEditor label="Transferable skills" value={dossier.transferableSkills} hint="Supports lane positioning without invented credentials." onSave={(items) => save({ ...dossier, transferableSkills: items, evidence: [...dossier.evidence.filter((item) => item.kind !== "skill" || item.source !== "manual"), ...items.map((item) => evidenceRecord("skill", item, "manual", true, new Date().toISOString()))] })} />
                <TextListEditor label="Proof points" value={dossier.proofPoints} hint="Supports stronger résumé bullets and interview answers." onSave={(items) => save({ ...dossier, proofPoints: items, evidence: [...dossier.evidence.filter((item) => item.kind !== "proof" || item.source !== "manual"), ...items.map((item) => evidenceRecord("proof", item, "manual", true, new Date().toISOString()))] })} />
                <TextListEditor label="Metrics & outcomes" value={dossier.metrics} hint="One measurable outcome can strengthen several variants." onSave={(items) => save({ ...dossier, metrics: items, evidence: [...dossier.evidence.filter((item) => item.kind !== "metric" || item.source !== "manual"), ...items.map((item) => evidenceRecord("metric", item, "manual", true, new Date().toISOString()))] })} />
                <TextListEditor label="Constraints" value={dossier.constraints} hint="Prevents recommendations that waste your time." onSave={(items) => save({ ...dossier, constraints: items })} />
                <TextListEditor label="Target-role interests" value={dossier.targetRoleInterests} hint="Seeds dossier-aware lane recommendations." onSave={(items) => save({ ...dossier, targetRoleInterests: items })} />
                <TextListEditor label="Career goals" value={dossier.careerGoals} hint="Keeps lane and application decisions aligned." onSave={(items) => save({ ...dossier, careerGoals: items })} />
                <TextListEditor label="Preferred work style" value={dossier.preferredWorkStyle} hint="Shapes recommendations without entering résumé claims." onSave={(items) => save({ ...dossier, preferredWorkStyle: items })} />
                <TextListEditor label="Interview stories" value={dossier.interviewStories} hint="Unlocks evidence-backed interview preparation." onSave={(items) => save({ ...dossier, interviewStories: items, evidence: [...dossier.evidence.filter((item) => item.kind !== "story" || item.source !== "manual"), ...items.map((item) => evidenceRecord("story", item, "manual", true, new Date().toISOString()))] })} />
              </div>
            </section>

            <section className="trust-panel mt-6 p-5 sm:p-6">
              <p className="trust-kicker text-xs font-bold uppercase">Local résumé import</p>
              <h2 className="mt-2 text-xl font-bold text-paper">Paste résumé text for review</h2>
              <p className="mt-1 text-sm leading-6 text-paper/55">Nothing is uploaded. Lines are proposed as low-confidence evidence and cannot be used until you approve them.</p>
              <textarea aria-label="Resume text import" className="trust-input mt-4 w-full border px-3 py-2 text-sm text-ink" rows={7} value={resumeText} onChange={(event) => setResumeText(event.target.value)} placeholder="Paste the text from an existing résumé…" />
              <button type="button" onClick={importResume} className="mt-3 rounded-md border border-cyan/40 bg-cyan/10 px-4 py-2 text-sm font-bold text-cyan transition hover:border-gold hover:text-gold">Extract proposed evidence</button>
              {imported && <span className="ml-3 text-sm text-mint">Import parsed locally. Review below.</span>}
            </section>

            {(proposed.length > 0 || dossier.migrationReview.length > 0) && (
              <section className="trust-panel mt-6 p-5 sm:p-6">
                <h2 className="text-xl font-bold text-paper">Review proposed or migrated evidence</h2>
                <p className="mt-1 text-sm text-paper/55">Source text and confidence stay attached. Unsupported assumptions remain unapproved.</p>
                {dossier.migrationReview.map((item) => <p key={item} className="mt-3 rounded-lg border border-gold/25 bg-gold/10 px-3 py-2 text-sm text-paper/70">{item}</p>)}
                <div className="mt-4 grid gap-3">
                  {proposed.map((item) => (
                    <article key={item.id} className="rounded-xl border border-white/12 bg-obsidian/40 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div><p className="lab-mono text-[0.65rem] font-bold uppercase text-gold">{item.kind} · {item.source} · {item.confidence} confidence</p><p className="mt-1 text-sm font-bold text-paper">{item.detail}</p><p className="mt-2 text-xs leading-5 text-paper/45">Source: {item.sourceText}</p></div>
                        <button type="button" onClick={() => approveEvidence(item.id, true)} className="rounded-md bg-mint px-3 py-1.5 text-xs font-black text-ink">Approve fact</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/5 p-4">
              <p className="text-sm text-paper/68">Your dossier is the foundation. Next, choose up to three credible career lanes.</p>
              <Link href="/targets" className="lab-pill-button px-5 py-2.5 text-sm font-black transition">Next: choose career lanes →</Link>
            </div>
          </>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
