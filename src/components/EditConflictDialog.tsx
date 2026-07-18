"use client";

import { useEffect, useRef, useState } from "react";
import type { FieldConflict } from "@/lib/edit-conflicts";

// Explicit same-field conflict resolution: shown when this tab's edit started
// from a stored value that another tab has since changed. The user always
// sees both versions and chooses — never silent last-write-wins.
export function EditConflictDialog({
  conflict,
  onKeepMine,
  onKeepStored,
  onMerge
}: {
  conflict: FieldConflict;
  onKeepMine: () => void;
  onKeepStored: () => void;
  onMerge: (merged: string) => void;
}) {
  const [merged, setMerged] = useState(conflict.mine);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/80 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-conflict-title"
        data-testid="edit-conflict-dialog"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gold/40 bg-ink p-5 shadow-glow sm:p-6"
      >
        <p className="trust-kicker text-xs font-bold uppercase">Same field changed in another tab</p>
        <h2 id="edit-conflict-title" ref={headingRef} tabIndex={-1} className="mt-2 text-xl font-bold text-paper outline-none">
          {conflict.label} was edited somewhere else while you were editing it here.
        </h2>
        <p className="mt-2 text-sm leading-6 text-paper/65">
          Nothing has been overwritten. Choose which version to keep, or merge them by editing the text below before saving.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-cyan/30 bg-cyan/5 p-3">
            <p className="lab-mono text-[0.65rem] font-bold uppercase text-cyan">Your edit in this tab</p>
            <p data-testid="conflict-mine" className="mt-2 whitespace-pre-wrap text-sm leading-6 text-paper/80">{conflict.mine || "(empty)"}</p>
          </div>
          <div className="rounded-lg border border-gold/30 bg-gold/5 p-3">
            <p className="lab-mono text-[0.65rem] font-bold uppercase text-gold">Newer saved version</p>
            <p data-testid="conflict-stored" className="mt-2 whitespace-pre-wrap text-sm leading-6 text-paper/80">{conflict.stored || "(empty)"}</p>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-bold text-paper/60">Merge manually (starts from your edit — combine what you want to keep, then save)</span>
          <textarea
            data-testid="conflict-merge-input"
            value={merged}
            onChange={(event) => setMerged(event.target.value)}
            rows={5}
            className="trust-input mt-1.5 w-full border p-3 text-sm text-ink"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="conflict-keep-mine"
            onClick={onKeepMine}
            className="min-h-11 rounded-md border border-cyan/40 bg-cyan/10 px-4 py-2 text-sm font-bold text-cyan transition hover:bg-cyan hover:text-ink"
          >
            Keep mine
          </button>
          <button
            type="button"
            data-testid="conflict-keep-stored"
            onClick={onKeepStored}
            className="min-h-11 rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-bold text-gold transition hover:bg-gold hover:text-ink"
          >
            Keep stored version
          </button>
          <button
            type="button"
            data-testid="conflict-save-merge"
            onClick={() => onMerge(merged)}
            className="min-h-11 rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold text-paper/80 transition hover:border-mint hover:text-mint"
          >
            Save manual merge
          </button>
        </div>
      </div>
    </div>
  );
}
