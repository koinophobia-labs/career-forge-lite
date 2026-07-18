"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActivationPath } from "@/components/ActivationPath";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { createId } from "@/lib/command-center-store";
import { useEntitlement } from "@/lib/entitlement";
import { laneLibrary } from "@/lib/lane-library";
import { generateResumePack, preserveUserEditedVariants } from "@/lib/resume-pack";
import { assessDossierReadiness } from "@/lib/dossier";
import { trackCareerEvent } from "@/lib/analytics";
import { activationEventsForTransition } from "@/lib/activation";
import { useCommandCenter } from "@/lib/use-command-center";
import type { LaneStatus, ResumeVersionRecord, TargetLane } from "@/types/command-center";
import type { LaneBlueprint } from "@/lib/lane-library";


function LaneDetail({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="lab-mono text-[0.68rem] font-bold uppercase text-gold">{title}</p>
      <ul className="mt-1.5 grid gap-1">
        {items.map((item) => (
          <li key={item} className="text-[0.8rem] leading-5 text-paper/68">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function laneEvidenceView(blueprint: LaneBlueprint, approvedDetails: string[]) {
  const terms = blueprint.keywords.map((item) => item.toLowerCase()).filter((item) => item.length > 2);
  const supporting = approvedDetails.filter((detail) => terms.some((term) => detail.toLowerCase().includes(term))).slice(0, 3);
  const label = supporting.length >= 3 ? "Strong lane" : supporting.length >= 1 ? "Credible transition" : approvedDetails.length ? "Exploratory" : "Not enough evidence yet";
  return { supporting, label };
}

export default function TargetsPage() {
  const { state, update, hydrated } = useCommandCenter();
  const { laneLimit, commerceEnabled } = useEntitlement();
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [forging, setForging] = useState(false);
  const dossierReadiness = assessDossierReadiness(state.dossier);
  // Exploring and activating lanes is free; the purchased pack decides how
  // many active lanes the generated Résumé Pack covers.
  const packLaneCap = laneLimit();
  const activeLaneCount = state.lanes.filter((lane) => lane.status === "active").length;

  const adoptedKeys = new Set(
    state.lanes.map((lane) => laneLibrary.find((blueprint) => blueprint.title === lane.title)?.key).filter(Boolean)
  );

  function adoptLane(key: string) {
    const blueprint = laneLibrary.find((item) => item.key === key);
    if (!blueprint) return;
    let events: ReturnType<typeof activationEventsForTransition> = [];
    update((current) => {
      if (current.lanes.some((lane) => lane.title === blueprint.title)) return current;
      const lane: TargetLane = {
        id: createId("lane"),
        title: blueprint.title,
        status: current.lanes.filter((item) => item.status === "active").length < 3 ? "active" : "exploring",
        whyFit: current.dossier.approvedClaims.length
          ? `${blueprint.whyFit} Strongest dossier evidence: ${current.dossier.approvedClaims.slice(0, 2).join("; ")}.`
          : blueprint.whyFit,
        resumeAngle: blueprint.resumeAngle,
        proof: blueprint.proof,
        gaps: blueprint.gaps,
        keywords: blueprint.keywords,
        source: "library",
        createdAt: new Date().toISOString()
      };
      const next = { ...current, lanes: [...current.lanes, lane] };
      events = activationEventsForTransition(current, next);
      return next;
    });
    trackCareerEvent("lane_activated");
    events.forEach(trackCareerEvent);
  }

  function addCustomLane() {
    const title = customTitle.trim();
    if (!title) return;
    update((current) => {
      if (current.lanes.some((lane) => lane.title.toLowerCase() === title.toLowerCase())) return current;
      // Prefer evidence that actually relates to the requested lane; falling
      // back to strongest general proof beats rendering empty sections.
      const titleWords = title.toLowerCase().split(/\s+/).filter((word) => word.length >= 4);
      const related = (values: string[]) => values.filter((value) => titleWords.some((word) => value.toLowerCase().includes(word)));
      const relatedProof = related(current.dossier.proofPoints);
      const proof = (relatedProof.length ? relatedProof : current.dossier.proofPoints).slice(0, 4);
      const relatedClaims = related(current.dossier.approvedClaims);
      const lane: TargetLane = {
        id: createId("lane"),
        title,
        status: "exploring",
        whyFit: relatedClaims.length
          ? `Your approved facts that relate most directly: ${relatedClaims.slice(0, 3).join("; ")}.`
          : current.dossier.approvedClaims.length
            ? `No approved fact mentions ${title} yet — your strongest general proof will carry this lane until you add related experience.`
            : "Add approved experience first so this lane has real facts behind it.",
        resumeAngle: current.dossier.transferableSkills.length
          ? `Lead with ${current.dossier.transferableSkills.slice(0, 3).join(", ")} where the role requires them.`
          : `Position verified experience toward ${title}; do not claim missing qualifications.`,
        proof,
        gaps: [`Only claim ${title} qualifications your approved evidence supports.`],
        keywords: current.dossier.tools.slice(0, 8),
        source: "custom",
        createdAt: new Date().toISOString()
      };
      return { ...current, lanes: [...current.lanes, lane] };
    });
    setCustomTitle("");
  }

  function setLaneStatus(id: string, nextStatus: LaneStatus) {
    let events: ReturnType<typeof activationEventsForTransition> = [];
    update((current) => {
      const target = current.lanes.find((lane) => lane.id === id);
      if (!target || target.status === nextStatus) return current;
      if (nextStatus === "active" && current.lanes.filter((lane) => lane.status === "active").length >= 3) return current;
      const next = { ...current, lanes: current.lanes.map((lane) => lane.id === id ? { ...lane, status: nextStatus } : lane) };
      events = activationEventsForTransition(current, next);
      return next;
    });
    events.forEach(trackCareerEvent);
  }

  function removeLane(id: string) {
    update((current) => ({ ...current, lanes: current.lanes.filter((lane) => lane.id !== id) }));
  }

  function editLaneField(id: string, field: "whyFit" | "resumeAngle", value: string) {
    update((current) => ({
      ...current,
      lanes: current.lanes.map((lane) => (lane.id === id ? { ...lane, [field]: value } : lane))
    }));
  }

  function forgePack() {
    const active = state.lanes.filter((lane) => lane.status === "active").slice(0, packLaneCap);
    if (!active.length || dossierReadiness.level === "not-ready" || forging) return;
    // Generation is synchronous, but on a slow device the click-to-navigation
    // gap can read as "nothing happened" — show the working state immediately
    // and yield one frame so it actually paints before the heavy work runs.
    setForging(true);
    window.setTimeout(() => runForge(active), 30);
  }

  function runForge(active: typeof state.lanes) {
    trackCareerEvent("resume_pack_started");
    const now = new Date().toISOString();
    const generated = generateResumePack(state.dossier, active, now);
    let events: ReturnType<typeof activationEventsForTransition> = [];
    update((current) => {
      // Manual edits survive regeneration: a user-edited variant for the same
      // lane+kind carries over (marked out-of-date) instead of being clobbered.
      const previousPack = [...current.resumePacks]
        .filter((item) => item.status !== "archived")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const pack = preserveUserEditedVariants(previousPack, generated);
      const versions: ResumeVersionRecord[] = pack.variants.map((variant) => {
        const lane = current.lanes.find((item) => item.id === variant.laneId);
        return {
          id: variant.id,
          label: variant.title,
          laneId: variant.laneId,
          notes: `Canonical ${variant.kind} baseline generated from dossier ${pack.dossierId}.`,
          source: "builder",
          applicationId: null,
          targetCompany: "",
          targetTitle: lane?.title ?? "",
          keywordsUsed: pack.receipt.keywordsIncluded,
          gapsAcknowledged: pack.receipt.gapsAvoided,
          influenceSummary: `Built from ${pack.receipt.evidenceUsed.length} of your ${pack.receipt.evidenceUsed.length + pack.receipt.evidenceOmitted.length} approved facts; ${pack.receipt.evidenceOmitted.length} approved fact${pack.receipt.evidenceOmitted.length === 1 ? " was" : "s were"} not needed by this document.`,
          resumeText: [variant.resume.summary, ...variant.resume.coreSkills, ...variant.resume.experience.flatMap((role) => role.bullets)].join("\n"),
          resumeSnapshot: {
            fullName: current.dossier.identity.fullName,
            email: current.dossier.identity.email,
            phone: current.dossier.identity.phone,
            website: current.dossier.identity.links[0] ?? "",
            template: variant.template,
            resume: variant.resume
          },
          createdAt: now
        };
      });
      // Re-forging supersedes: prior packs archive, and their auto-generated
      // baseline versions are removed unless an application points at them —
      // otherwise every re-forge doubles the archive with stale duplicates.
      const linkedVersionIds = new Set(current.applications.map((app) => app.resumeVersionId).filter(Boolean));
      const survivingVersions = current.resumeVersions.filter(
        (version) =>
          !(version.source === "builder" && version.notes.startsWith("Canonical") && !version.applicationId && !linkedVersionIds.has(version.id))
      );
      const next = {
        ...current,
        // Every prior pack archives on re-forge — including packs already in
        // "needs-review" after an edit, or duplicates linger as live packs.
        resumePacks: [...current.resumePacks.map((item) => item.status === "archived" ? item : { ...item, status: "archived" as const }), pack],
        resumeVersions: [...survivingVersions, ...versions]
      };
      events = activationEventsForTransition(current, next);
      return next;
    });
    events.forEach(trackCareerEvent);
    router.push("/versions");
  }

  return (
    <main>
      <CommandNav active="/targets" />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Step 3 · Choose role lanes</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Pick the lanes you’re running in.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          A lane is a role family with a defined angle: why you fit, how the resume should read, what proof to lead
          with, and what gaps to close. Two or three active lanes beats ten vague ones — every application and message
          gets sharper when it belongs to a lane.
        </p>

        {hydrated && <div className="mt-8"><ActivationPath state={state} compact /></div>}

        {hydrated && state.lanes.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-paper">Your lanes ({state.lanes.length})</h2>
            <div className="mt-4 grid gap-4">
              {state.lanes.map((lane) => (
                <article key={lane.id} className="trust-panel p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-paper">{lane.title}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {lane.status !== "active" && (
                        <button
                          type="button"
                          onClick={() => setLaneStatus(lane.id, "active")}
                          disabled={activeLaneCount >= 3}
                          title={activeLaneCount >= 3 ? "Three lanes are already active — pause one first." : "Include this lane when you forge your résumé pack."}
                          className="min-h-11 rounded-full bg-gold px-4 py-1.5 text-xs font-black text-ink transition hover:bg-cyan disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Make this lane active
                        </button>
                      )}
                      <label className="lab-mono flex items-center gap-1.5 text-[0.65rem] font-bold uppercase text-paper/50">
                        <span className="sr-only">Status for {lane.title}</span>
                        <select
                          value={lane.status}
                          onChange={(event) => setLaneStatus(lane.id, event.target.value as LaneStatus)}
                          className={`min-h-11 rounded-full border bg-obsidian px-3 py-1 text-[0.65rem] font-bold uppercase ${
                            lane.status === "active"
                              ? "border-gold/50 text-gold"
                              : lane.status === "exploring"
                                ? "border-cyan/50 text-cyan"
                                : "border-white/20 text-paper/50"
                          }`}
                        >
                          <option value="active">Active — in my pack</option>
                          <option value="exploring">Exploring</option>
                          <option value="paused">Paused</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === lane.id ? null : lane.id)}
                        className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold text-paper/60 transition hover:border-cyan hover:text-cyan"
                      >
                        {expandedId === lane.id ? "Collapse" : "Details"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLane(lane.id)}
                        className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold text-paper/60 transition hover:border-coral hover:text-coral"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {expandedId === lane.id && (
                    <div className="mt-4 grid gap-5 border-t border-white/10 pt-4 lg:grid-cols-2">
                      <div className="grid gap-4">
                        <label className="block">
                          <span className="lab-mono text-[0.68rem] font-bold uppercase text-gold">Why this fits</span>
                          <textarea
                            value={lane.whyFit}
                            rows={3}
                            placeholder="Why your background maps to this lane — in your own words."
                            onChange={(event) => editLaneField(lane.id, "whyFit", event.target.value)}
                            className="trust-input mt-1.5 w-full border px-3 py-2 text-sm text-ink"
                          />
                        </label>
                        <label className="block">
                          <span className="lab-mono text-[0.68rem] font-bold uppercase text-gold">Resume angle</span>
                          <textarea
                            value={lane.resumeAngle}
                            rows={3}
                            placeholder="How the resume should be framed for this lane."
                            onChange={(event) => editLaneField(lane.id, "resumeAngle", event.target.value)}
                            className="trust-input mt-1.5 w-full border px-3 py-2 text-sm text-ink"
                          />
                        </label>
                      </div>
                      <div className="grid content-start gap-4">
                        <LaneDetail title="Proof to emphasize" items={lane.proof} />
                        <LaneDetail title="Transferable skills" items={state.dossier.transferableSkills.slice(0, 6)} />
                        <LaneDetail title="Evidence-backed keywords" items={lane.keywords} />
                        <LaneDetail title="Gaps to close" items={lane.gaps} />
                        <p className="text-[0.78rem] leading-5 text-paper/55">
                          Résumé readiness: {state.dossier.evidence.filter((item) => item.approved).length >= 3 ? "supported by approved evidence" : "missing approved evidence"}. Qualifications in the gap list will not be claimed.
                        </p>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        {hydrated && !state.lanes.length && (
          <div className="mt-8 rounded-xl border border-cyan/25 bg-cyan/10 p-5 text-sm leading-6 text-paper/72">
            No lanes yet. Adopt from the library below — each comes pre-loaded with a fit rationale, resume angle,
            proof list, and gap plan built for transitions from operations and customer-facing work.
          </div>
        )}

        <div className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-paper">Lane library</h2>
              <p className="mt-1 text-sm text-paper/60">
                Nine entry lanes for the operations-to-tech transition. Recommendations below reflect only approved evidence that overlaps the lane; they are not hiring predictions.
              </p>
            </div>
            <div>
              <div className="flex gap-2">
                <input
                  value={customTitle}
                  placeholder="Or add a custom lane, e.g. Payments Operations"
                  onChange={(event) => setCustomTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addCustomLane();
                  }}
                  className="trust-input border px-3 py-2 text-sm text-ink"
                />
                <button
                  type="button"
                  onClick={addCustomLane}
                  className="rounded-md bg-gold px-4 py-2 text-sm font-black text-ink transition hover:bg-cyan"
                >
                  Add
                </button>
              </div>
              <p className="mt-1.5 max-w-xs text-xs leading-4 text-paper/45">
                Custom lanes start with dossier-backed proof, transferable skills, and an explicit honesty gap.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {laneLibrary.map((blueprint) => {
              const adopted = adoptedKeys.has(blueprint.key);
              const view = laneEvidenceView(blueprint, state.dossier.evidence.filter((item) => item.approved && !item.rejected).map((item) => item.detail));
              return (
                <article key={blueprint.key} className="trust-card flex flex-col p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-base font-bold text-paper">{blueprint.title}</h3><span className={`lab-mono rounded-full border px-2.5 py-1 text-[0.62rem] font-bold uppercase ${view.label === "Strong lane" ? "border-mint/40 bg-mint/10 text-mint" : view.label === "Credible transition" ? "border-cyan/40 bg-cyan/10 text-cyan" : view.label === "Exploratory" ? "border-gold/40 bg-gold/10 text-gold" : "border-white/15 text-paper/45"}`}>{view.label}</span></div>
                  <p className="mt-1.5 text-[0.78rem] leading-5 text-paper/60">{blueprint.summary}</p>
                  <p className="mt-3 text-[0.7rem] font-bold uppercase tracking-wide text-paper/45">Included roles</p><p className="mt-1 text-[0.78rem] leading-5 text-paper/62">{blueprint.summary}</p>
                  <p className="mt-3 text-[0.78rem] leading-5 text-paper/68">
                    <span className="font-bold text-cyan">Why it fits: </span>
                    {view.supporting.length ? view.supporting.join(" · ") : "No approved evidence directly overlaps this lane yet. Explore it only if you can add truthful proof."}
                  </p>
                  <details className="mt-3 text-[0.78rem] leading-5 text-paper/60"><summary className="cursor-pointer font-bold text-paper/72">Proof, gaps, and résumé outcome</summary><p className="mt-2"><strong className="text-mint">Résumé produced:</strong> ATS and recruiter baselines for {blueprint.title}.</p><p className="mt-2"><strong className="text-cyan">Positioning tip:</strong> {blueprint.resumeAngle}</p><p className="mt-2"><strong className="text-gold">Proof to add:</strong> {blueprint.proof.slice(0, 2).join(" · ")}</p><p className="mt-2"><strong className="text-coral">Gap:</strong> {blueprint.gaps[0]}</p></details>
                  <button
                    type="button"
                    data-testid="adopt-lane"
                    disabled={adopted}
                    onClick={() => adoptLane(blueprint.key)}
                    className={`mt-4 rounded-md px-4 py-2 text-sm font-black transition ${
                      adopted
                        ? "cursor-default border border-white/15 bg-white/5 text-paper/40"
                        : "bg-gold text-ink hover:bg-cyan"
                    }`}
                  >
                    {adopted ? "In your lanes" : view.label === "Strong lane" || view.label === "Credible transition" ? "Make this lane active" : "Explore this lane"}
                  </button>
                </article>
              );
            })}
          </div>
        </div>

        <div id="forge-pack" className="mt-8 scroll-mt-28 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/5 p-4">
          <div><p className="text-sm font-bold text-paper">{activeLaneCount} active lane(s) · {Math.min(activeLaneCount, packLaneCap) * 2} baseline résumé(s)</p><p className="mt-1 text-xs text-paper/50">{dossierReadiness.level === "not-ready" ? "Add enough approved role or project evidence before forging; a vague sentence should not become a résumé." : "One operation creates ATS and Recruiter / Networking variants for each active lane."}</p>{commerceEnabled && activeLaneCount > packLaneCap && <p className="mt-1 text-xs font-bold text-gold">Your pack covers {packLaneCap} lane{packLaneCap === 1 ? "" : "s"}, so the first {packLaneCap} active lane{packLaneCap === 1 ? "" : "s"} will be forged. Larger packs cover up to three.</p>}</div>
          <div className="flex flex-col items-end gap-2">
            <button type="button" onClick={forgePack} disabled={activeLaneCount === 0 || dossierReadiness.level === "not-ready" || forging} aria-busy={forging} className="lab-pill-button px-5 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40">{forging ? "Forging your pack…" : "Forge complete résumé pack →"}</button>
            {activeLaneCount === 0 && state.lanes.length > 0 && (
              <p className="max-w-xs text-right text-xs font-bold text-gold">
                {state.lanes.length} lane{state.lanes.length === 1 ? "" : "s"} added, none active yet — use “Make this lane active” above to include one.
              </p>
            )}
            {activeLaneCount > 0 && state.lanes.some((lane) => lane.source === "custom" && lane.status !== "active") && (
              <p className="max-w-xs text-right text-xs text-paper/55">
                Not included: {state.lanes.filter((lane) => lane.source === "custom" && lane.status !== "active").map((lane) => lane.title).join(", ")} (not active).
              </p>
            )}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
