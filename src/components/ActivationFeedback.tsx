"use client";

import { useState } from "react";
import { trackCareerEvent } from "@/lib/analytics";

export function ActivationFeedback({ milestone, question }: { milestone: "dossier" | "pack" | "export" | "tailor"; question: string }) {
  const [answer, setAnswer] = useState<"yes" | "not-yet" | null>(null);

  function record(next: "yes" | "not-yet") {
    setAnswer(next);
    trackCareerEvent("activation_feedback_submitted");
    const payload = JSON.stringify({ milestone, answer: next, createdAt: new Date().toISOString() }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `career-forge-${milestone}-feedback.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <aside className="rounded-xl border border-white/12 bg-white/5 p-4" aria-label="Optional product feedback">
      <p className="text-sm font-bold text-paper">{answer ? "Thanks—your local feedback file is ready to share with the owner." : question}</p>
      {!answer && <><p className="mt-1 text-xs leading-5 text-paper/50">Optional. Downloads a tiny feedback file containing only this answer and milestone—never career data.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => record("yes")} className="min-h-11 rounded-md bg-mint px-4 py-2 text-sm font-black text-ink">Yes</button><button type="button" onClick={() => record("not-yet")} className="min-h-11 rounded-md border border-gold/40 px-4 py-2 text-sm font-bold text-gold">Not yet</button></div></>}
    </aside>
  );
}
