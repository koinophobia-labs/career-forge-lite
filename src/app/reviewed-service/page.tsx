import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";

// The $149 human-reviewed résumé service. This is deliberately and visibly a
// SEPARATE offer from the automated public beta: a human reviews every layer
// before anything is delivered. Nothing on this page implies that automated
// Career Forge output receives this review, and no automated-tier commerce is
// enabled here — the path is inquiry → founder replies with a payment link.

const humanReviewedLayers: Array<[string, string]> = [
  ["Career Dossier", "Every approved fact is read by a person: wrong-category items, weak phrasing, and missing context get flagged back to you."],
  ["Target lanes", "Your chosen role directions are sanity-checked against your actual evidence — including which lane to drop."],
  ["Résumé content", "Each claim, heading, and date is reviewed for defensibility and edited by hand where the generated draft is weak."],
  ["LinkedIn positioning", "Headline and About are rewritten to match the strongest reviewed evidence, not just generated text."],
  ["Generated files", "The final PDF and DOCX are opened and read page by page — layout, pagination, and wording."],
  ["Final delivery package", "Everything is checked against the delivery checklist before it is sent to you."]
];

const processSteps: Array<[string, string]> = [
  ["1. Inquire", "Send the inquiry email below with your target role. No payment yet."],
  ["2. Intake", "You get a short intake reply: what to export from Career Forge (or send any existing résumé) and 5 questions about your goals."],
  ["3. Payment link", "After intake, you receive a payment link for the flat $149. Nothing is charged before you have seen the scope in writing."],
  ["4. Human review & build", "A person reviews every layer listed above and assembles your package."],
  ["5. Delivery", "You receive the reviewed résumé (PDF + DOCX), LinkedIn positioning, and a note explaining every significant change."]
];

export default function ReviewedServicePage() {
  const inquiry = `mailto:hello@koinophobia.dev?subject=${encodeURIComponent("Human-reviewed résumé service ($149) — inquiry")}&body=${encodeURIComponent("Hi — I'm interested in the human-reviewed résumé service.\n\nTarget role or direction:\nRough timeline:\nDo you already use Career Forge? (yes/no):\n")}`;
  return (
    <main>
      <CommandNav active="/pricing" />

      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">A separate, human service</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Human-reviewed résumé service — $149</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          This is not the automated beta. A person reviews your material at every layer before anything is delivered.
          The free Career Forge beta generates drafts that <strong className="text-paper/90">you</strong> review;
          this service adds a human reviewer between the tool and the version you send.
        </p>

        <div className="trust-panel mt-8 p-5 sm:p-6" aria-labelledby="reviewed-layers-title">
          <h2 id="reviewed-layers-title" className="text-xl font-bold text-paper">What a human actually reviews</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {humanReviewedLayers.map(([layer, description]) => (
              <div key={layer} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <dt className="text-sm font-bold text-cyan">{layer}</dt>
                <dd className="mt-1 text-xs leading-5 text-paper/65">{description}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="trust-panel mt-6 p-5 sm:p-6" aria-labelledby="reviewed-process-title">
          <h2 id="reviewed-process-title" className="text-xl font-bold text-paper">How it works</h2>
          <ol className="mt-4 grid gap-3">
            {processSteps.map(([step, description]) => (
              <li key={step} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-bold text-paper">{step}</p>
                <p className="mt-1 text-xs leading-5 text-paper/65">{description}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4 grid gap-2 text-xs leading-5 text-paper/70 sm:grid-cols-2">
            <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2"><strong className="text-gold">Turnaround:</strong> delivery within 5 business days of payment and complete intake.</p>
            <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2"><strong className="text-gold">Revisions:</strong> one revision round included within 14 days of delivery.</p>
          </div>
          <a href={inquiry} className="lab-pill-button mt-5 inline-flex min-h-11 items-center px-6 py-2.5 text-sm font-black">
            Start an inquiry — no payment yet →
          </a>
        </div>

        <div className="mt-6 rounded-xl border border-coral/30 bg-coral/10 p-4 text-sm leading-6 text-paper/75">
          <p className="font-bold text-coral">What this is not</p>
          <p className="mt-1 text-xs leading-5">
            Automated Career Forge outputs do <strong>not</strong> receive this human review — they are drafts you
            review yourself, free during the beta. The proposed automated-tier prices on the{" "}
            <Link href="/pricing" className="font-bold text-cyan underline">pricing page</Link> remain hypotheses and
            are not for sale in this release.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
