"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ActivationFeedback } from "@/components/ActivationFeedback";
import { ActivationPath } from "@/components/ActivationPath";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import {
  assessDossierReadiness,
  evidenceRecord,
  parseResumePackToProposals,
  withUpdatedDossier
} from "@/lib/dossier";
import { extractLocalResumeFiles } from "@/lib/local-resume-import";
import { createId } from "@/lib/command-center-store";
import { trackCareerEvent } from "@/lib/analytics";
import { activationEventsForTransition } from "@/lib/activation";
import {
  addProposalsToReview,
  commitTruthInboxReview,
  createPendingImportReview,
  discardTruthInboxReview,
  truthInboxCounts
} from "@/lib/truth-inbox";
import { useCommandCenter } from "@/lib/use-command-center";
import type { CareerDossier, DossierEducation, DossierProject, DossierRole, ImportProposalGroup, ImportProposalRecord, PendingImportReview } from "@/types/dossier";

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

function ImportReview({ batch, groups, onChange, onApproveGroup, onDecision, onCommit, onMerge, onDiscard, onRetainFilenames }: {
  batch: PendingImportReview;
  groups: Array<[ImportProposalGroup, string]>;
  onChange: (id: string, detail: string) => void;
  onApproveGroup: (group: ImportProposalGroup) => void;
  onDecision: (id: string, status: ImportProposalRecord["status"]) => void;
  onCommit: () => void;
  onMerge: () => void;
  onDiscard: () => void;
  onRetainFilenames: (retain: boolean) => void;
}) {
  const proposals = batch.proposals;
  if (!proposals.length) return null;
  const counts = truthInboxCounts(batch);
  const supportLabel = (kind: ImportProposalRecord["kind"]) => {
    if (kind === "role" || kind === "responsibility") return "experience sections and evidence-backed bullets";
    if (kind === "project") return "project proof and transferable technical work";
    if (kind === "metric" || kind === "proof") return "stronger bullets and interview answers";
    if (kind === "tool" || kind === "skill") return "truthful keyword matching when the work supports it";
    return "your reusable Career Dossier";
  };
  return (
    <section id="review" className="trust-panel mt-6 scroll-mt-28 p-5 sm:p-6" aria-labelledby="import-review-title">
      <p className="trust-kicker text-xs font-bold uppercase">Truth Inbox · durable local review</p>
      <h2 id="import-review-title" className="mt-2 text-xl font-bold text-paper">Review what Career Forge found</h2>
      <p className="mt-1 text-sm leading-6 text-paper/55">Review what Career Forge found before anything becomes part of your career record. Pending facts remain here across navigation and refresh.</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full border border-mint/35 bg-mint/10 px-3 py-1 text-mint">{counts.approved} approved</span><span className="rounded-full border border-coral/35 bg-coral/10 px-3 py-1 text-coral">{counts.rejected} rejected</span><span className="rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-gold">{counts.proposed} still need review</span></div>
      <p className="mt-3 break-words text-xs leading-5 text-paper/45">Files represented: {batch.sourceFileCount} {batch.retainSourceFilenames ? `(${batch.sourceFilenames.join(", ")})` : "(filenames private)"} · Imported {new Date(batch.importedAt).toLocaleString()} · Last updated {new Date(batch.updatedAt).toLocaleString()}</p>
      {batch.retainSourceFilenames
        ? <label className="mt-3 flex min-h-11 items-start gap-2 text-xs leading-5 text-paper/55"><input type="checkbox" checked onChange={(event) => onRetainFilenames(event.target.checked)} className="mt-1"/><span>Retain source filenames in approved evidence metadata. Turn this off before approval to remove them from the review; exact source excerpts stay attached.</span></label>
        : <p className="mt-3 text-xs leading-5 text-paper/55">Source filename retention was disabled when this review was created. Filenames cannot be restored from the queue; exact source excerpts remain attached.</p>}
      <div className="mt-5 grid gap-5">
        {groups.map(([group, title]) => {
          const items = proposals.filter((item) => item.group === group);
          if (!items.length) return null;
          return <section key={group} className="rounded-xl border border-white/12 bg-obsidian/35 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-paper">{title} <span className="text-paper/45">({items.length})</span></h3><p className="mt-1 text-xs text-paper/48">Approved items become reusable only after saving; rejected items remain unusable.</p></div><button type="button" onClick={() => onApproveGroup(group)} className="min-h-11 rounded border border-mint/50 px-3 py-1.5 text-xs font-bold text-mint">Approve section</button></div><div className="mt-3 grid gap-3">{items.map((item) => <article key={item.id} className={`rounded-lg border p-3 ${item.status === "approved" ? "border-mint/40 bg-mint/5" : item.status === "rejected" ? "border-coral/40 bg-coral/5" : "border-white/10"}`}><input aria-label={`Edit proposal ${item.label}`} value={item.detail} onChange={(event) => onChange(item.id, event.target.value)} className="trust-input w-full border px-3 py-2 text-sm text-ink"/><p className="mt-2 text-xs leading-5 text-cyan">Can support: {supportLabel(item.kind)}.</p>{item.edited && <p className="mt-1 text-xs font-bold text-gold">Edited in this review</p>}{item.likelyDuplicateOf && <p className="mt-1 text-xs font-bold text-gold">Likely duplicate—compare before approving</p>}<details className="mt-2 text-xs text-paper/55"><summary className="cursor-pointer">Review source text</summary>{item.sourceExcerpts.map((source) => <p key={source} className="mt-2 border-l-2 border-cyan/30 pl-2">{source}</p>)}</details><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onDecision(item.id, "approved")} className="min-h-11 rounded bg-mint px-3 py-1.5 text-xs font-black text-ink">Approve</button><button type="button" onClick={() => onDecision(item.id, "rejected")} className="min-h-11 rounded border border-coral/50 px-3 py-1.5 text-xs font-bold text-coral">Reject</button><button type="button" onClick={() => onDecision(item.id, "proposed")} className="min-h-11 rounded border border-white/20 px-3 py-1.5 text-xs font-bold text-paper/65">Undecide</button><span className="ml-auto self-center text-xs uppercase text-paper/40">{item.confidence} confidence · {item.status}</span></div></article>)}</div></section>;
        })}
      </div>
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={onCommit} disabled={counts.approved + counts.rejected === 0} className="min-h-11 rounded-md bg-gold px-5 py-2.5 text-sm font-black text-ink disabled:cursor-not-allowed disabled:opacity-40">{counts.approved + counts.rejected === 0 ? "Review at least one fact first" : counts.proposed ? "Save decisions and continue later" : "Finish review"}</button>{proposals.length > 1 && <button type="button" onClick={onMerge} className="min-h-11 rounded border border-cyan/40 px-4 py-2 text-sm font-bold text-cyan">Mark likely duplicates</button>}<button type="button" onClick={onDiscard} className="min-h-11 rounded border border-coral/45 px-4 py-2 text-sm font-bold text-coral">Discard this import review</button></div>
    </section>
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
  const [importMessage, setImportMessage] = useState("");
  const [retainSourceFilenames, setRetainSourceFilenames] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [stagedImport, setStagedImport] = useState<{ proposals: ImportProposalRecord[]; message: string } | null>(null);
  const activeBatch = state.pendingImportReviews.find((item) => item.id === selectedBatchId) ?? state.pendingImportReviews[0] ?? null;

  function save(next: CareerDossier) {
    let events: ReturnType<typeof activationEventsForTransition> = [];
    update((current) => {
      const nextState = withUpdatedDossier(current, { ...next, updatedAt: new Date().toISOString() });
      events = activationEventsForTransition(current, nextState);
      return nextState;
    });
    events.forEach(trackCareerEvent);
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
    trackCareerEvent("import_started");
    queueExtractedImport(parseResumePackToProposals([{ filename: "Pasted résumé.txt", text: resumeText }]), "Pasted text parsed locally. Review grouped records below.");
    trackCareerEvent("import_completed");
    trackCareerEvent("proposal_review_started");
  }

  async function importFiles(files: File[]) {
    try {
      trackCareerEvent("import_started");
      const extracted = await extractLocalResumeFiles(files);
      queueExtractedImport(parseResumePackToProposals(extracted), `${files.length} file${files.length === 1 ? "" : "s"} extracted locally. Raw files were not stored.`);
      trackCareerEvent("resume_pack_imported");
      trackCareerEvent("import_completed");
      trackCareerEvent("proposal_review_started");
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Those files could not be read.");
    }
  }

  function createReview(proposals: ImportProposalRecord[], message: string) {
    const now = new Date().toISOString();
    const batch = createPendingImportReview(createId("truth-inbox"), proposals, now, retainSourceFilenames);
    update((current) => ({ ...current, pendingImportReviews: [...current.pendingImportReviews, batch] }));
    setSelectedBatchId(batch.id);
    setImportMessage(message);
    trackCareerEvent("truth_inbox_created");
  }

  function queueExtractedImport(proposals: ImportProposalRecord[], message: string) {
    if (!proposals.length) {
      setImportMessage("No reviewable facts were found. Try a text-based résumé or paste the text directly.");
      return;
    }
    if (state.pendingImportReviews.length) {
      setStagedImport({ proposals, message });
      return;
    }
    createReview(proposals, message);
  }

  function resolveStagedImport(choice: "add" | "separate" | "cancel") {
    if (!stagedImport) return;
    if (choice === "cancel") {
      setStagedImport(null);
      setImportMessage("New import canceled. Your existing Truth Inbox was not changed.");
      return;
    }
    if (choice === "separate" || !activeBatch) {
      createReview(stagedImport.proposals, stagedImport.message);
    } else {
      const now = new Date().toISOString();
      update((current) => ({
        ...current,
        pendingImportReviews: current.pendingImportReviews.map((batch) => batch.id === activeBatch.id
          ? addProposalsToReview(batch, stagedImport.proposals, now)
          : batch)
      }));
      setImportMessage(`${stagedImport.message} Added to the current Truth Inbox without overwriting pending work.`);
    }
    setStagedImport(null);
  }

  function updateActiveBatch(change: (batch: PendingImportReview) => PendingImportReview) {
    if (!activeBatch) return;
    update((current) => ({
      ...current,
      pendingImportReviews: current.pendingImportReviews.map((batch) => batch.id === activeBatch.id ? change(batch) : batch)
    }));
  }

  function decideProposal(id: string, status: ImportProposalRecord["status"]) {
    updateActiveBatch((batch) => ({ ...batch, updatedAt: new Date().toISOString(), proposals: batch.proposals.map((item) => item.id === id ? { ...item, status } : item) }));
  }

  function approveGroup(group: ImportProposalGroup) {
    updateActiveBatch((batch) => ({ ...batch, updatedAt: new Date().toISOString(), proposals: batch.proposals.map((item) => item.group === group ? { ...item, status: "approved" } : item) }));
  }

  function mergeLikelyDuplicates() {
    updateActiveBatch((batch) => {
      const marked: ImportProposalRecord[] = [];
      const tokens = (value: string) => new Set(value.toLowerCase().replace(/(?:19|20)\d{2}|present/g, " ").match(/[a-z0-9]{3,}/g) ?? []);
      let matches = 0;
      for (const proposal of batch.proposals) {
        const sourceTokens = tokens(proposal.detail);
        const match = marked.find((item) => {
          if (item.group !== proposal.group) return false;
          const targetTokens = tokens(item.detail);
          const overlap = [...sourceTokens].filter((token) => targetTokens.has(token)).length;
          return overlap / Math.max(1, Math.min(sourceTokens.size, targetTokens.size)) >= 0.7;
        });
        if (!match) { marked.push({ ...proposal }); continue; }
        matches += 1;
        marked.push({ ...proposal, likelyDuplicateOf: match.id });
      }
      setImportMessage(`Marked ${matches} likely duplicate record${matches === 1 ? "" : "s"}. Source excerpts and both records remain available for review.`);
      return { ...batch, proposals: marked, updatedAt: new Date().toISOString() };
    });
  }

  function commitImportReview() {
    if (!activeBatch) return;
    const result = commitTruthInboxReview(state, activeBatch.id, new Date().toISOString());
    if (!result.changed) {
      setImportMessage("Review at least one fact first. Undecided proposals remain safely in the Truth Inbox.");
      return;
    }
    update(() => result.state);
    activationEventsForTransition(state, result.state).forEach(trackCareerEvent);
    if (result.completed) {
      setImportMessage(`Truth Inbox complete: ${result.approved} approved · ${result.rejected} rejected. Only approved evidence can support outputs.`);
      setSelectedBatchId(null);
      trackCareerEvent("truth_inbox_completed");
    } else {
      setImportMessage(`Decisions saved: ${result.approved} approved · ${result.rejected} rejected · ${result.remaining} still need review.`);
    }
  }

  function discardImportReview() {
    if (!activeBatch) return;
    if (!window.confirm("This removes the pending review but does not delete evidence you already approved in earlier sessions.")) return;
    update((current) => discardTruthInboxReview(current, activeBatch.id));
    setSelectedBatchId(null);
    setImportMessage("Pending review discarded. Previously approved dossier evidence was not changed.");
    trackCareerEvent("truth_inbox_discarded");
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
            <div className="mt-8"><ActivationPath state={state} compact /></div>

            <section id="import" className="trust-panel mt-6 scroll-mt-28 p-5 sm:p-6" aria-labelledby="import-title">
              <p className="trust-kicker text-xs font-bold uppercase">Recommended first entrance · local résumé import</p>
              <h2 id="import-title" className="mt-2 text-2xl font-bold text-paper">Start with the history you already have</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-paper/65">Upload old résumés, role-specific versions, or exported LinkedIn text. Career Forge groups repeated facts and conflicts for review. Multiple versions are useful; duplicates can be merged. Nothing becomes trusted evidence until you approve it.</p>
              <label className="mt-4 block rounded-xl border border-dashed border-cyan/40 bg-cyan/5 p-4 text-sm text-paper/70"><span className="font-bold text-cyan">Choose PDF, DOCX, or text résumé files</span><span className="mt-1 block text-xs text-paper/50">Select more than one. Processing happens in this browser; raw files are never persisted or uploaded.</span><input aria-label="Resume pack files" type="file" multiple accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="mt-3 block min-h-11 w-full text-xs" onChange={(event) => { const files = [...(event.target.files ?? [])]; if (files.length) void importFiles(files); event.target.value = ""; }} /></label>
              <details className="mt-4 rounded-xl border border-white/12 bg-white/5 p-4" open={Boolean(resumeText || state.pendingImportReviews.length)}><summary className="cursor-pointer text-sm font-bold text-paper">No file handy? Paste résumé text</summary><textarea aria-label="Resume text import" className="trust-input mt-4 w-full border px-3 py-2 text-sm text-ink" rows={7} value={resumeText} onChange={(event) => setResumeText(event.target.value)} placeholder="Paste the text from an existing résumé…" /><button type="button" onClick={importResume} className="mt-3 min-h-11 rounded-md border border-cyan/40 bg-cyan/10 px-4 py-2 text-sm font-bold text-cyan transition hover:border-gold hover:text-gold">Extract proposed evidence</button></details>
              {importMessage && <p className="mt-3 text-sm text-mint" role="status" aria-live="polite">{importMessage}</p>}
              <label className="mt-3 flex min-h-11 items-start gap-2 text-xs leading-5 text-paper/55"><input type="checkbox" checked={retainSourceFilenames} onChange={(event) => setRetainSourceFilenames(event.target.checked)} className="mt-1"/><span>Retain source filenames in local dossier metadata after approval. Leave off for maximum privacy; exact supporting text is retained either way.</span></label>
              {stagedImport && <div role="dialog" aria-modal="true" aria-labelledby="import-choice-title" className="mt-4 rounded-xl border border-gold/40 bg-gold/10 p-4"><h3 id="import-choice-title" className="font-bold text-paper">A Truth Inbox already exists</h3><p className="mt-1 text-sm text-paper/65">Choose how to handle the new files. Your current pending review will not be overwritten.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => resolveStagedImport("add")} className="min-h-11 rounded bg-mint px-3 py-2 text-xs font-black text-ink">Add files to current review</button><button type="button" onClick={() => resolveStagedImport("separate")} className="min-h-11 rounded border border-cyan/45 px-3 py-2 text-xs font-bold text-cyan">Start a separate review batch</button><button type="button" onClick={() => resolveStagedImport("cancel")} className="min-h-11 rounded border border-white/20 px-3 py-2 text-xs font-bold text-paper/65">Cancel</button></div></div>}
            </section>

            {state.pendingImportReviews.length > 0 && <section className="trust-panel mt-6 p-5 sm:p-6" aria-labelledby="truth-inbox-list-title"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="trust-kicker text-xs font-bold uppercase">Truth Inbox</p><h2 id="truth-inbox-list-title" className="mt-2 text-xl font-bold text-paper">{state.pendingImportReviews.length} pending review batch{state.pendingImportReviews.length === 1 ? "" : "es"}</h2><p className="mt-1 text-sm text-paper/55">Nothing here supports readiness, lanes, résumés, matching, or answers until approved and saved.</p></div><Link href="#review" onClick={() => trackCareerEvent("truth_inbox_resumed")} className="min-h-11 rounded border border-cyan/45 px-4 py-2.5 text-sm font-bold text-cyan">Resume review</Link></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{state.pendingImportReviews.map((batch) => { const counts = truthInboxCounts(batch); return <button key={batch.id} type="button" onClick={() => { setSelectedBatchId(batch.id); trackCareerEvent("truth_inbox_resumed"); }} className={`rounded-xl border p-3 text-left ${activeBatch?.id === batch.id ? "border-gold/55 bg-gold/10" : "border-white/12 bg-white/5"}`}><span className="block text-sm font-bold text-paper">{counts.total} proposed facts · {batch.sourceFileCount} file{batch.sourceFileCount === 1 ? "" : "s"}</span><span className="mt-1 block text-xs text-paper/50">{counts.approved} approved · {counts.rejected} rejected · {counts.proposed} undecided</span></button>; })}</div></section>}

            {activeBatch && <ImportReview batch={activeBatch} groups={importGroups} onChange={(id, detail) => updateActiveBatch((batch) => ({ ...batch, updatedAt: new Date().toISOString(), proposals: batch.proposals.map((proposal) => proposal.id === id ? { ...proposal, detail, edited: true } : proposal) }))} onApproveGroup={approveGroup} onDecision={decideProposal} onCommit={commitImportReview} onMerge={mergeLikelyDuplicates} onDiscard={discardImportReview} onRetainFilenames={(retain) => updateActiveBatch((batch) => ({ ...batch, retainSourceFilenames: retain, sourceFilenames: retain ? batch.sourceFilenames : [], proposals: retain ? batch.proposals : batch.proposals.map((proposal) => ({ ...proposal, sourceFilenames: [] })), updatedAt: new Date().toISOString() }))} />}

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

            {approvedEvidence.length > 0 && <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.72fr]" id="unlocks"><div className="rounded-xl border border-mint/35 bg-mint/10 p-5"><p className="trust-kicker text-xs font-bold uppercase">What your approvals unlock</p><h2 className="mt-2 text-xl font-bold text-paper">{readiness.level === "not-ready" ? "A truthful foundation is taking shape" : readiness.level === "foundation" ? "You can begin testing credible role lanes" : "You have enough proof to forge lane résumés"}</h2><ul className="mt-3 grid gap-2 text-sm leading-6 text-paper/70"><li>• Roles and projects can become traced experience sections and bullets.</li><li>• Tools and skills can support matching only when the underlying work is approved.</li><li>• Missing credentials and unverified duration remain visible gaps—not generated claims.</li></ul><Link href="/targets" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-mint px-4 py-2 text-sm font-black text-ink">See dossier-backed role lanes →</Link></div><ActivationFeedback milestone="dossier" question="Did the review make it clear what Career Forge now trusts?" /></section>}

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
