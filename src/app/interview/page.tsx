"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InterviewMode } from "@/components/InterviewMode";
import { InterviewPrep } from "@/components/InterviewPrep";
import { useCommandCenter } from "@/lib/use-command-center";

function InterviewPageContent() {
  const [view, setView] = useState<"prep" | "intake">("prep");
  const searchParams = useSearchParams();
  const requestedApplicationId = searchParams.get("applicationId");
  const { hydrated, update } = useCommandCenter();

  useEffect(() => {
    if (!hydrated || !requestedApplicationId) return;
    // InterviewPrep historically defaults to the first interviewing record.
    // Put the explicitly requested record first without changing any dates,
    // status, or activity timestamps so the page opens the interview Today named.
    update((current) => {
      const index = current.applications.findIndex((application) => application.id === requestedApplicationId && application.status === "interviewing");
      if (index <= 0) return current;
      const applications = [...current.applications];
      const [target] = applications.splice(index, 1);
      return { ...current, applications: [target, ...applications] };
    });
  }, [hydrated, requestedApplicationId, update]);

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

  return <InterviewPrep onSwitchToIntake={() => setView("intake")} />;
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-obsidian" aria-busy="true" />}>
      <InterviewPageContent />
    </Suspense>
  );
}
