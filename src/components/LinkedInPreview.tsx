"use client";

import { CopyButton } from "@/components/CopyButton";
import type { ResumePackage } from "@/types/career";

type LinkedInPreviewProps = {
  resume: ResumePackage;
  onChange: (resume: ResumePackage) => void;
};

export function LinkedInPreview({ resume, onChange }: LinkedInPreviewProps) {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="trust-kicker text-sm font-bold uppercase">linkedin://starter</p>
          <h2 className="mt-3 text-3xl font-bold text-paper">A searchable headline, not a full rewrite.</h2>
          <p className="mt-3 text-paper/70">
            Keep this focused for now: headline plus a short professional summary.
          </p>
        </div>

        <div className="dark-form-card rounded-md p-5 shadow-glow">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-ink">Headline</span>
            <textarea
              value={resume.linkedinHeadline}
              onChange={(event) => onChange({ ...resume, linkedinHeadline: event.target.value })}
              rows={2}
              className="w-full rounded-md border border-ink/12 bg-paper/60 p-3 text-ink outline-none focus:border-gold focus:ring-4 focus:ring-gold/15"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-bold text-ink">Professional summary</span>
            <textarea
              value={resume.linkedinSummary}
              onChange={(event) => onChange({ ...resume, linkedinSummary: event.target.value })}
              rows={5}
              className="w-full rounded-md border border-ink/12 bg-paper/60 p-3 leading-7 text-ink outline-none focus:border-gold focus:ring-4 focus:ring-gold/15"
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <CopyButton getText={() => resume.linkedinHeadline} label="Copy Headline" />
            <CopyButton
              getText={() => `${resume.linkedinHeadline}\n\n${resume.linkedinSummary}`}
              label="Copy LinkedIn Text"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
