"use client";

import { useState } from "react";
import { InterviewMode } from "@/components/InterviewMode";
import { InterviewPrep } from "@/components/InterviewPrep";

export default function InterviewPage() {
  const [view, setView] = useState<"prep" | "intake">("prep");

  if (view === "intake") {
    return (
      <>
        <div className="border-b border-white/10 bg-obsidian/84 px-5 py-2.5 text-center sm:px-8">
          <button
            type="button"
            onClick={() => setView("prep")}
            className="text-xs font-bold text-paper/60 transition hover:text-cyan"
          >
            ← Back to interview prep (practice questions &amp; answer coaching)
          </button>
        </div>
        <InterviewMode />
      </>
    );
  }

  return <InterviewPrep onSwitchToIntake={() => setView("intake")} />;
}
