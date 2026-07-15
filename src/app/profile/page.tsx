"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import {
  assessDossierReadiness,
  evidenceRecord,
  mergeImportProposals,
  parseResumePackToProposals,
  withUpdatedDossier
} from "@/lib/dossier";
import { extractLocalResumeFiles } from "@/lib/local-resume-import";
import { createId } from "@/lib/command-center-store";
import { trackCareerEvent } from "@/lib/analytics";
import { useCommandCenter } from "@/lib/use-command-center";
import type { CareerDossier, DossierEducation, DossierProject, DossierRole, ImportProposalGroup, ImportProposalRecord } from "@/types/dossier";

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
  const [saved, setSaved] = useState(false);
  return (
    <div className="block">
      <span className="lab-mono text-[0.68rem] font-bold uppercase text-gold">{label}</span>
      <textarea aria-label={label} className="trust-input mt-1.5 w-full border px-3 py-2 text-sm text-ink" rows={4} value={draft} onChange={(event) => { setDraft(event.target.value); setSaved(false); }} />
      <span className="mt-1 block text-xs leading-5 text-paper/45">{hint}</span>
      <button type="button" onClick={() => { onSave(values(draft)); setSaved(true); }} className="mt-2 rounded border border-cyan/35 px-3 py-1.5 text-xs font-bold text-cyan">Save {label.toLowerCase()}</button>{saved && <span className="ml-2 text-xs font-bold text-mint">Saved</span>}
    </div>
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
  const [importProposals, setImportProposals] = useState<ImportProposalRecord[]>([]);
  const [importMessage, setImportMessage] = useState("");
  const [retainSourceFilenames, setRetainSourceFilenames] = useState(false);

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
    const evidence = dossier.evidence.map((item) => item.id === id ? { ...item, approved, rejected: !approved, updatedAt: new Date().toISOString() } : item);
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
    const record: DossierProject = { id: createId("project"), name: project.name.trim(), organization: project.organization.trim(), dates: project.dates.trim(), description: project.description.trim(), responsibilities: [], tools: [], outcomes: [], metrics: [], links: [], defaultPlacement: "projects", evidenceIds: [proof.id] };
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
    setImportProposals(parseResumePackToProposals([{ filename: "Pasted résumé.txt", text: resumeText }]));
    setImportMessage("Pasted text parsed locally. Review grouped records below.");
  }

  async function importFiles(files: File[]) {
    try {
      const extracted = await extractLocalResumeFiles(files);
      setImportProposals(parseResumePackToProposals(extracted));
      setImportMessage(`${files.length} file${files.length === 1 ? "" : "s"} extracted locally. Raw files were not stored.`);
      trackCareerEvent("resume_pack_imported");
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Those files could not be read.");
    }
  }

  function decideProposal(id: string, status: ImportProposalRecord["status"]) {
    setImportProposals((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  function approveGroup(group: ImportProposalGroup) {
    setImportProposals((current) => current.map((item) => item.group === group ? { ...item, status: "approved" } : item));
  }

  function mergeLikelyDuplicates() {
    setImportProposals((current) => {
      const merged: ImportProposalRecord[] = [];
      const tokens = (value: string) => new Set(value.toLowerCase().replace(/(?:19|20)\d{2}|present/g, " ").match(/[a-z0-9]{3,}/g) ?? []);
      for (const proposal of current) {
        const sourceTokens = tokens(proposal.detail);
        const match = merged.find((item) => {
          if (item.group !== proposal.group) return false;
          const targetTokens = tokens(item.detail);
          const overlap = [...sourceTokens].filter((token) => targetTokens.has(token)).length;
          return overlap / Math.max(1, Math.min(sourceTokens.size, targetTokens.size)) >= 0.7;
        });
        if (!match) { merged.push({ ...proposal }); continue; }
        match.detail = match.detail.length >= proposal.detail.length ? match.detail : proposal.detail;
        match.sourceFilenames = [...new Set([...match.sourceFilenames, ...proposal.sourceFilenames])];
        match.sourceExcerpts = [...new Set([...match.sourceExcerpts, ...proposal.sourceExcerpts])];
        if (proposal.status === "approved") match.status = "approved";
      }
      setImportMessage(`Merged ${current.length - merged.length} likely duplicate record${current.length - merged.length === 1 ? "" : "s"}. Review the result before saving.`);
      return merged;
    });
  }

  function commitImportReview() {
    save(mergeImportProposals(dossier, importProposals, new Date().toISOString(), retainSourceFilenames));
    setImportMessage("Review saved. Only approved records can now support generated claims.");
    setImportProposals([]);
  }

  function deleteRecord(kind: "roles" | "projects" | "education", id: string, evidenceIds: string[]) {
    const linked = state.resumePacks.some((pack) => pack.variants.some((variant) => variant.evidenceReferences.some((ref) => ref.evidenceIds.some((evidenceId) => evidenceIds.includes(evidenceId)))));
    if (linked && !window.confirm("This record supports an existing résumé. Delete it and mark that résumé out of date?")) return;
    if (!linked && !window.confirm("Delete this dossier record?")) return;
    save({
      ...dossier,
      [kind]: dossier[kind].filter((item) => item.id !== id),
      evidence: dossier.evidence.filter((item) => !evidenceIds.includes(item.id)),
      approvedClaims: dossier.approvedClaims.filter((claim) => !dossier.evidence.some((item) => evidenceIds.includes(item.id) && item.detail === claim))
    });
  }

  function editRole(id: string, form: FormData) {
    save({ ...dossier, roles: dossier.roles.map((item) => item.id === id ? {
      ...item, title: String(form.get("title") ?? "").trim(), employer: String(form.get("employer") ?? "").trim(),
      startDate: String(form.get("dates") ?? "").trim(), responsibilities: values(String(form.get("responsibilities") ?? ""))
    } : item) });
  }

  function editProject(id: string, form: FormData) {
    save({ ...dossier, projects: dossier.projects.map((item) => item.id === id ? {
      ...item, name: String(form.get("name") ?? "").trim(), organization: String(form.get("organization") ?? "").trim(),
      dates: String(form.get("dates") ?? "").trim(), description: String(form.get("description") ?? "").trim(),
      responsibilities: values(String(form.get("responsibilities") ?? "")), tools: values(String(form.get("tools") ?? "")),
      outcomes: values(String(form.get("outcomes") ?? "")), metrics: values(String(form.get("metrics") ?? "")),
      links: values(String(form.get("links") ?? "")),
      defaultPlacement: String(form.get("placement")) as DossierProject["defaultPlacement"]
    } : item) });
  }

  function editEducation(id: string, form: FormData) {
    save({ ...dossier, education: dossier.education.map((item) => item.id === id ? {
      ...item, credential: String(form.get("credential") ?? "").trim(), institution: String(form.get("institution") ?? "").trim(),
      field: String(form.get("field") ?? "").trim(), dates: String(form.get("dates") ?? "").trim()
    } : item) });
  }

  function editEvidence(id: string, detail: string) {
    const now = new Date().toISOString();
    const evidence = dossier.evidence.map((item) => item.id === id ? { ...item, detail: detail.trim(), updatedAt: now } : item);
    save({ ...dossier, evidence, approvedClaims: evidence.filter((item) => item.approved && !item.rejected).map((item) => item.detail) });
  }

  function deleteEvidence(id: string) {
    const linked = state.resumePacks.some((pack) => pack.variants.some((variant) => variant.evidenceReferences.some((ref) => ref.evidenceIds.includes(id))));
    if (!window.confirm(linked ? "This evidence supports an existing résumé. Delete it and mark that résumé out of date?" : "Delete this evidence permanently?")) return;
    const evidence = dossier.evidence.filter((item) => item.id !== id);
    save({ ...dossier, evidence, approvedClaims: evidence.filter((item) => item.approved && !item.rejected).map((item) => item.detail) });
  }

  const approvedCount = dossier.evidence.filter((item) => item.approved).length;
  const proposed = dossier.evidence.filter((item) => !item.approved && !item.rejected);
  const rejected = dossier.evidence.filter((item) => item.rejected);
  const approvedEvidence = dossier.evidence.filter((item) => item.approved && !item.rejected);
  const importGroups: Array<[ImportProposalGroup, string]> = [["identity", "Identity"], ["employment", "Employment"], ["projects", "Projects"], ["education", "Education"], ["tools", "Tools"], ["skills", "Skills"], ["metrics-outcomes", "Metrics and outcomes"], ["other", "Other proposed evidence"]];

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
                {dossier.roles.length > 0 && <div className="mt-4 grid gap-2">{dossier.roles.map((item) => <details key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-paper/75"><summary className="cursor-pointer font-bold">{item.title || "Role"}{item.employer ? ` · ${item.employer}` : ""}{item.startDate ? ` · ${item.startDate}` : ""}</summary><form action={(form) => editRole(item.id, form)} className="mt-3 grid gap-2"><input name="title" aria-label="Edit role title" defaultValue={item.title} className="trust-input border px-3 py-2 text-ink"/><input name="employer" aria-label="Edit role employer" defaultValue={item.employer} className="trust-input border px-3 py-2 text-ink"/><input name="dates" aria-label="Edit role dates" defaultValue={item.startDate} className="trust-input border px-3 py-2 text-ink"/><textarea name="responsibilities" aria-label="Edit role responsibilities" defaultValue={item.responsibilities.join("\n")} className="trust-input border px-3 py-2 text-ink"/><div className="flex gap-2"><button className="rounded bg-mint px-3 py-1.5 font-bold text-ink">Save role</button><button type="button" onClick={() => deleteRecord("roles", item.id, item.evidenceIds)} className="rounded border border-coral/50 px-3 py-1.5 text-coral">Delete role</button></div></form></details>)}</div>}
              </div>
            </section>

            {approvedEvidence.length > 0 && <section className="trust-panel mt-6 p-5 sm:p-6"><h2 className="text-xl font-bold text-paper">Approved evidence lifecycle</h2><p className="mt-1 text-sm text-paper/55">Edit, reject, or delete individual facts. Existing outputs are preserved and marked out of date.</p><div className="mt-4 grid gap-2">{approvedEvidence.map((item) => <details key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3"><summary className="cursor-pointer text-sm font-bold text-paper/75">{item.label}: {item.detail}</summary><div className="mt-3 grid gap-2"><input aria-label={`Edit evidence ${item.label}`} defaultValue={item.detail} onBlur={(event) => { if (event.target.value.trim() !== item.detail) editEvidence(item.id, event.target.value); }} className="trust-input border px-3 py-2 text-sm text-ink"/><p className="text-xs text-paper/45">Sources: {item.sourceFilenames.join(", ") || item.source} · Exact text: {item.sourceExcerpts[0] ?? item.sourceText}</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => approveEvidence(item.id, false)} className="rounded border border-gold/50 px-3 py-1.5 text-xs font-bold text-gold">Reject evidence</button><button type="button" onClick={() => deleteEvidence(item.id)} className="rounded border border-coral/50 px-3 py-1.5 text-xs font-bold text-coral">Delete evidence</button></div></div></details>)}</div></section>}

            <section className="trust-panel mt-6 p-5 sm:p-6">
              <h2 className="text-xl font-bold text-paper">Projects, independent work &amp; education</h2>
              <p className="mt-1 text-sm text-paper/55">Founders and recent graduates can build a defensible dossier without conventional employment.</p>
              <div className="mt-5 grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-white/12 bg-obsidian/35 p-4"><h3 className="font-bold text-paper">Add a project or independent venture</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><input aria-label="Project name" className="trust-input border px-3 py-2 text-sm text-ink" placeholder="Project name" value={project.name} onChange={(event) => setProject({ ...project, name: event.target.value })} /><input aria-label="Project organization" className="trust-input border px-3 py-2 text-sm text-ink" placeholder="Organization or Independent" value={project.organization} onChange={(event) => setProject({ ...project, organization: event.target.value })} /><input aria-label="Project dates" className="trust-input border px-3 py-2 text-sm text-ink sm:col-span-2" placeholder="Dates" value={project.dates} onChange={(event) => setProject({ ...project, dates: event.target.value })} /><textarea aria-label="Project description" className="trust-input border px-3 py-2 text-sm text-ink sm:col-span-2" rows={3} placeholder="What you built, did, or shipped—no assumed outcomes" value={project.description} onChange={(event) => setProject({ ...project, description: event.target.value })} /></div><button type="button" onClick={addProject} className="mt-3 rounded-md bg-gold px-4 py-2 text-sm font-black text-ink">Add approved project</button>{dossier.projects.map((item) => <details key={item.id} className="mt-3 rounded-lg border border-white/10 p-3 text-sm text-paper/70"><summary className="cursor-pointer font-bold">{item.name}{item.organization ? ` · ${item.organization}` : ""}</summary><form action={(form) => editProject(item.id, form)} className="mt-3 grid gap-2"><input name="name" aria-label="Edit project name" defaultValue={item.name} className="trust-input border px-3 py-2 text-ink"/><input name="organization" aria-label="Edit project organization" defaultValue={item.organization} className="trust-input border px-3 py-2 text-ink"/><input name="dates" aria-label="Edit project dates" defaultValue={item.dates} className="trust-input border px-3 py-2 text-ink"/><textarea name="description" aria-label="Edit project description" defaultValue={item.description} className="trust-input border px-3 py-2 text-ink"/><textarea name="responsibilities" aria-label="Edit project responsibilities" defaultValue={item.responsibilities.join("\n")} placeholder="Responsibilities" className="trust-input border px-3 py-2 text-ink"/><textarea name="tools" aria-label="Edit project tools" defaultValue={item.tools.join("\n")} placeholder="Tools" className="trust-input border px-3 py-2 text-ink"/><textarea name="outcomes" aria-label="Edit project outcomes" defaultValue={item.outcomes.join("\n")} placeholder="Outcomes" className="trust-input border px-3 py-2 text-ink"/><textarea name="metrics" aria-label="Edit project metrics" defaultValue={item.metrics.join("\n")} placeholder="Metrics" className="trust-input border px-3 py-2 text-ink"/><textarea name="links" aria-label="Edit project links" defaultValue={item.links.join("\n")} placeholder="Links" className="trust-input border px-3 py-2 text-ink"/><select name="placement" aria-label="Project resume placement" defaultValue={item.defaultPlacement} className="trust-input border px-3 py-2 text-ink"><option value="projects">Projects</option><option value="experience">Experience</option><option value="selected-projects">Selected Projects</option><option value="omit">Omit by default</option></select><div className="flex gap-2"><button className="rounded bg-mint px-3 py-1.5 font-bold text-ink">Save project</button><button type="button" onClick={() => deleteRecord("projects", item.id, item.evidenceIds)} className="rounded border border-coral/50 px-3 py-1.5 text-coral">Delete project</button></div></form></details>)}</div>
                <div className="rounded-xl border border-white/12 bg-obsidian/35 p-4"><h3 className="font-bold text-paper">Add education or a credential</h3><div className="mt-3 grid gap-3"><input aria-label="Credential" className="trust-input border px-3 py-2 text-sm text-ink" placeholder="Degree, certificate, course, or training" value={education.credential} onChange={(event) => setEducation({ ...education, credential: event.target.value })} /><input aria-label="Institution" className="trust-input border px-3 py-2 text-sm text-ink" placeholder="Institution" value={education.institution} onChange={(event) => setEducation({ ...education, institution: event.target.value })} /><input aria-label="Education dates" className="trust-input border px-3 py-2 text-sm text-ink" placeholder="Dates" value={education.dates} onChange={(event) => setEducation({ ...education, dates: event.target.value })} /></div><button type="button" onClick={addEducation} className="mt-3 rounded-md bg-gold px-4 py-2 text-sm font-black text-ink">Add approved education</button>{dossier.education.map((item) => <details key={item.id} className="mt-3 rounded-lg border border-white/10 p-3 text-sm text-paper/70"><summary className="cursor-pointer font-bold">{item.credential}{item.institution ? ` · ${item.institution}` : ""}</summary><form action={(form) => editEducation(item.id, form)} className="mt-3 grid gap-2"><input name="credential" aria-label="Edit credential" defaultValue={item.credential} className="trust-input border px-3 py-2 text-ink"/><input name="institution" aria-label="Edit institution" defaultValue={item.institution} className="trust-input border px-3 py-2 text-ink"/><input name="field" aria-label="Edit education field" defaultValue={item.field} className="trust-input border px-3 py-2 text-ink"/><input name="dates" aria-label="Edit education dates" defaultValue={item.dates} className="trust-input border px-3 py-2 text-ink"/><div className="flex gap-2"><button className="rounded bg-mint px-3 py-1.5 font-bold text-ink">Save education</button><button type="button" onClick={() => deleteRecord("education", item.id, item.evidenceIds)} className="rounded border border-coral/50 px-3 py-1.5 text-coral">Delete education</button></div></form></details>)}</div>
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
              <h2 className="mt-2 text-xl font-bold text-paper">Import a résumé pack for grouped review</h2>
              <p className="mt-1 text-sm leading-6 text-paper/55">Choose multiple PDF, DOCX, or text résumés. Extraction and deduplication happen in this browser; binary files are never persisted or uploaded.</p>
              <label className="mt-4 block rounded-xl border border-dashed border-cyan/40 bg-cyan/5 p-4 text-sm text-paper/70"><span className="font-bold text-cyan">Choose résumé files</span><input aria-label="Resume pack files" type="file" multiple accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="mt-2 block w-full text-xs" onChange={(event) => { const files = [...(event.target.files ?? [])]; if (files.length) void importFiles(files); event.target.value = ""; }} /></label>
              <p className="mt-5 text-xs font-bold uppercase text-paper/45">Or paste plain text</p>
              <textarea aria-label="Resume text import" className="trust-input mt-4 w-full border px-3 py-2 text-sm text-ink" rows={7} value={resumeText} onChange={(event) => setResumeText(event.target.value)} placeholder="Paste the text from an existing résumé…" />
              <button type="button" onClick={importResume} className="mt-3 rounded-md border border-cyan/40 bg-cyan/10 px-4 py-2 text-sm font-bold text-cyan transition hover:border-gold hover:text-gold">Extract proposed evidence</button>
              {importMessage && <p className="mt-3 text-sm text-mint" role="status">{importMessage}</p>}
              <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-paper/55"><input type="checkbox" checked={retainSourceFilenames} onChange={(event) => setRetainSourceFilenames(event.target.checked)} className="mt-1"/><span>Retain source filenames in local dossier metadata after approval. Leave off for maximum privacy; exact supporting text is retained either way.</span></label>
            </section>

            {importProposals.length > 0 && <section className="trust-panel mt-6 p-5 sm:p-6" aria-labelledby="import-review-title"><h2 id="import-review-title" className="text-xl font-bold text-paper">Review structured proposals</h2><p className="mt-1 text-sm text-paper/55">Approve a section or individual record, edit the proposed wording, reject it, and inspect every source. Nothing can support generation until this review is saved.</p><div className="mt-5 grid gap-5">{importGroups.map(([group, title]) => { const items = importProposals.filter((item) => item.group === group); if (!items.length) return null; return <section key={group} className="rounded-xl border border-white/12 bg-obsidian/35 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-paper">{title} <span className="text-paper/45">({items.length})</span></h3><button type="button" onClick={() => approveGroup(group)} className="rounded border border-mint/50 px-3 py-1.5 text-xs font-bold text-mint">Approve section</button></div><div className="mt-3 grid gap-3">{items.map((item) => <article key={item.id} className={`rounded-lg border p-3 ${item.status === "approved" ? "border-mint/40 bg-mint/5" : item.status === "rejected" ? "border-coral/40 bg-coral/5" : "border-white/10"}`}><input aria-label={`Edit proposal ${item.label}`} value={item.detail} onChange={(event) => setImportProposals((current) => current.map((proposal) => proposal.id === item.id ? { ...proposal, detail: event.target.value } : proposal))} className="trust-input w-full border px-3 py-2 text-sm text-ink"/><details className="mt-2 text-xs text-paper/55"><summary className="cursor-pointer">Sources: {item.sourceFilenames.join(", ")}</summary>{item.sourceExcerpts.map((source) => <p key={source} className="mt-2 border-l-2 border-cyan/30 pl-2">{source}</p>)}</details><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => decideProposal(item.id, "approved")} className="rounded bg-mint px-3 py-1.5 text-xs font-black text-ink">Approve</button><button type="button" onClick={() => decideProposal(item.id, "rejected")} className="rounded border border-coral/50 px-3 py-1.5 text-xs font-bold text-coral">Reject</button><span className="ml-auto text-xs uppercase text-paper/40">{item.confidence} confidence · {item.status}</span></div></article>)}</div></section>; })}</div><button type="button" onClick={commitImportReview} className="mt-5 rounded-md bg-gold px-5 py-2.5 text-sm font-black text-ink">Save reviewed evidence</button></section>}
            {importProposals.length > 1 && <div className="mt-3 flex justify-end"><button type="button" onClick={mergeLikelyDuplicates} className="rounded border border-cyan/40 px-4 py-2 text-sm font-bold text-cyan">Merge likely duplicates</button></div>}

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
                        <div className="flex gap-2"><button type="button" onClick={() => approveEvidence(item.id, true)} className="rounded-md bg-mint px-3 py-1.5 text-xs font-black text-ink">Approve fact</button><button type="button" onClick={() => approveEvidence(item.id, false)} className="rounded-md border border-coral/50 px-3 py-1.5 text-xs font-bold text-coral">Reject</button></div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {rejected.length > 0 && <section className="trust-panel mt-6 p-5 sm:p-6"><h2 className="text-xl font-bold text-paper">Rejected evidence</h2><p className="mt-1 text-sm text-paper/55">Restore an item if it was rejected accidentally. It remains unusable until restored.</p><div className="mt-3 grid gap-2">{rejected.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 p-3 text-sm text-paper/65"><span className="mr-auto">{item.detail}</span><button type="button" onClick={() => approveEvidence(item.id, true)} className="rounded border border-mint/50 px-3 py-1 text-xs font-bold text-mint">Restore and approve</button></div>)}</div></section>}

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
