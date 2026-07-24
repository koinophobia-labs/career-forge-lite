"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InterviewMode } from "@/components/InterviewMode";
import { InterviewPrep } from "@/components/InterviewPrep";

function InterviewPageContent() {
  const [view, setView] = useState<"prep" | "intake">("prep");
  const searchParams = useSearchParams();
  const requestedApplicationId = searchParams.get("applicationId");

  if (view === "intake") {
    return (
      <>
        <div className="border-b border-white/10 bg-obsidian/84 px-5 py-2.5 text-center sm:px-8">
          <button type="button" onClick={() => setView("prep")} className="text-xs font-bold text-paper/60 transition hover:text-cyan">
            ← Back to interview prep (practice questions &amp; answer coaching)
          </button>
        </div>
        <InterviewMode />
      </>
    );
  }

  return <InterviewPrep requestedApplicationId={requestedApplicationId} onSwitchToIntake={() => setView("intake")} />;
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-obsidian" aria-busy="true" />}>
      <InterviewPageContent />
    </Suspense>
  );
}
