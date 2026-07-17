"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { trackCareerEvent } from "@/lib/analytics";
import { deriveTruthMap } from "@/lib/truth-map";
import { useCommandCenter } from "@/lib/use-command-center";

export default function TruthMapPage() {
  const { state, hydrated } = useCommandCenter();
  const map = useMemo(() => deriveTruthMap(state), [state]);
  return (
    <main>
      <CommandNav active="/truth-map" />
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Truth Map · where every claim comes from</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-5xl">See what supports every claim—and where each fact is used.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-paper/68">This map is rebuilt from your approved dossier, role lanes, résumé variants, and saved answers. Rejected and pending Truth Inbox facts never appear as support.</p>
        {hydrated && map.evidenceFirst.length === 0 && <section className="trust-panel mt-8 p-6"><h2 className="text-xl font-bold text-paper">Your Truth Map starts after approval</h2><p className="mt-2 text-sm leading-6 text-paper/60">Import old résumés or add a role or project, then approve the facts you recognize. Career Forge will show their lineage here.</p><Link href="/profile#import" className="mt-4 inline-flex min-h-11 items-center rounded bg-gold px-4 py-2 text-sm font-black text-ink">Build my Career Dossier →</Link></section>}
        {hydrated && map.evidenceFirst.length > 0 && <>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Approved facts" value={map.evidenceFirst.length}/><Metric label="Traced claims" value={map.outputFirst.length}/><Metric label="Answer citations" value={map.applicationAnswerCount}/><Metric label="Unused facts" value={map.evidenceFirst.filter((item) => item.unused).length}/></div>
          <section className="trust-panel mt-6 p-5 sm:p-6"><h2 className="text-2xl font-bold text-paper">Evidence-first</h2><p className="mt-1 text-sm text-paper/55">Start with a fact and follow it into roles, lanes, résumé claims, and application answers.</p><div className="mt-4 grid gap-3">{map.evidenceFirst.map((entry) => <details key={entry.evidence.id} onClick={(event) => { if ((event.target as HTMLElement).tagName === "SUMMARY") trackCareerEvent("evidence_usage_opened"); }} className="min-w-0 rounded-xl border border-white/12 bg-white/5 p-4"><summary className="cursor-pointer break-words text-sm font-bold text-paper"><span className="text-gold">{entry.evidence.kind}</span> · {entry.evidence.detail}{entry.unused ? <span className="ml-2 text-paper/40">unused</span> : null}{entry.stale ? <span className="ml-2 text-coral">may be stale</span> : null}</summary><div className="mt-3 grid gap-3 text-xs leading-5 text-paper/60 sm:grid-cols-2"><TruthList label="Direct role/project linkage" items={entry.linkedRecords}/><TruthList label="Role lanes supported" items={entry.laneTitles}/><TruthList label="Résumé claims using it" items={entry.resumeClaims.map((claim) => `${claim.supportType}: ${claim.claimText}${claim.stale ? " (stale)" : ""}`)}/><TruthList label="Application answers citing it" items={entry.applicationAnswers.map((answer) => `${answer.applicationLabel}: ${answer.prompt}`)}/><div className="sm:col-span-2"><p className="font-bold uppercase text-cyan">Source</p><p className="mt-1 break-words border-l-2 border-cyan/30 pl-2">{entry.evidence.sourceExcerpts[0] ?? entry.evidence.sourceText}</p></div></div></details>)}</div></section>
          <section className="trust-panel mt-6 p-5 sm:p-6"><h2 className="text-2xl font-bold text-paper">Output-first</h2><p className="mt-1 text-sm text-paper/55">Start with an exact résumé claim and inspect its direct, combined, or transferred proof.</p><div className="mt-4 grid gap-3">{map.outputFirst.map((claim, index) => <details key={`${claim.variantId}-${claim.claimPath}-${index}`} onClick={(event) => { if ((event.target as HTMLElement).tagName === "SUMMARY") trackCareerEvent("claim_provenance_opened"); }} className="min-w-0 rounded-xl border border-white/12 bg-white/5 p-4"><summary className="cursor-pointer break-words text-sm font-bold text-paper"><span className={claim.supportType === "direct" ? "text-mint" : claim.supportType === "combined" ? "text-cyan" : "text-gold"}>{claim.supportType}</span> · {claim.claimText}{claim.userEdited ? <span className="ml-2 text-coral">user-edited</span> : null}{claim.stale ? <span className="ml-2 text-coral">stale</span> : null}</summary><p className="mt-2 text-xs text-paper/50">{claim.laneTitle} · {claim.kind === "job-specific" ? "Job-specific" : "Baseline"} · {claim.variantTitle}</p><div className="mt-3 grid gap-2">{claim.evidence.length ? claim.evidence.map((evidence) => <div key={evidence.id} className="rounded border border-white/10 p-3 text-xs leading-5 text-paper/60"><p className="font-bold text-paper/75">{evidence.label}: {evidence.detail}</p><p className="mt-1 break-words border-l-2 border-cyan/30 pl-2">{evidence.sourceExcerpts[0] ?? evidence.sourceText}</p></div>) : <p className="rounded border border-coral/35 bg-coral/10 p-3 text-xs font-bold text-coral">Supporting evidence is missing or no longer approved. Recheck before use.</p>}</div></details>)}</div></section>
        </>}
      </section>
      <SiteFooter />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/12 bg-white/5 p-4"><p className="text-2xl font-black text-paper">{value}</p><p className="mt-1 text-xs font-bold uppercase text-paper/45">{label}</p></div>;
}

function TruthList({ label, items }: { label: string; items: string[] }) {
  return <div className="min-w-0"><p className="font-bold uppercase text-cyan">{label}</p>{items.length ? <ul className="mt-1 grid gap-1">{items.map((item, index) => <li key={`${item}-${index}`} className="break-words">· {item}</li>)}</ul> : <p className="mt-1 text-paper/40">None yet</p>}</div>;
}
