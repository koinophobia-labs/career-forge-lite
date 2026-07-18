import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";

const deliverables: Array<[string, string]> = [
  ["Career diagnostic", "A human reviews your current résumé, goals, and strongest evidence before rebuilding anything."],
  ["Rebuilt résumé", "One professionally reviewed résumé delivered in editable DOCX and finished PDF formats."],
  ["LinkedIn headline", "A concise headline aligned with the reviewed résumé and your strongest credible direction."],
  ["Three target-role directions", "Three realistic role directions with a short explanation of why each fits your evidence."],
  ["Loom walkthrough", "A recorded walkthrough explaining the changes, positioning decisions, and how to use the files."],
  ["One revision", "One focused revision round included when requested within 14 days of delivery."]
];

const processSteps: Array<[string, string]> = [
  ["1. Inquire", "Email your current background, target roles, and what is not working in your résumé. No payment is collected yet."],
  ["2. Confirm scope", "Koinophobia Labs confirms the deliverables, intake needs, privacy terms, and 48-hour delivery window in writing."],
  ["3. Pay", "You receive a secure payment link for the flat $149 after the scope is confirmed."],
  ["4. Review and rebuild", "Blake reviews the supplied material, rebuilds the package, and checks the PDF and DOCX page by page."],
  ["5. Delivery", "You receive the files, three target-role directions, LinkedIn headline, Loom walkthrough, and revision instructions."]
];

export default function ReviewedServicePage() {
  const inquiryBody = [
  "Hi Blake — I'm interested in the Career Forge Résumé Rebuild.",
  "",
  "Name:",
  "Current role or background:",
  "Target roles:",
  "What is not working in my current résumé:"
].join(String.fromCharCode(10));
const inquiry = `mailto:koinophobia999@gmail.com?subject=${encodeURIComponent("Career Forge Résumé Rebuild ($149) — inquiry")}&body=${encodeURIComponent(inquiryBody)}`;
  return (
    <main>
      <CommandNav active="/pricing" />
      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Human service · Separate from the SaaS beta</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Career Forge Résumé Rebuild — $149 flat</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          This is the same done-for-you offer shown by Koinophobia Labs: a diagnostic, rebuilt résumé, LinkedIn headline,
          three target-role directions, Loom walkthrough, and one revision. It is not an automated Career Pack and does
          not imply that public-beta output received human review.
        </p>

        <div className="trust-panel mt-8 p-5 sm:p-6" aria-labelledby="reviewed-deliverables-title">
          <h2 id="reviewed-deliverables-title" className="text-xl font-bold text-paper">What the $149 includes</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {deliverables.map(([item, description]) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <dt className="text-sm font-bold text-cyan">{item}</dt>
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
            <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2"><strong className="text-gold">Turnaround:</strong> within 48 hours after payment and complete intake.</p>
            <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2"><strong className="text-gold">Revision:</strong> one focused round included within 14 days of delivery.</p>
          </div>
          <a href={inquiry} className="lab-pill-button mt-5 inline-flex min-h-11 items-center px-6 py-2.5 text-sm font-black">
            Request the rebuild — no payment yet →
          </a>
        </div>

        <div className="mt-6 rounded-xl border border-cyan/25 bg-cyan/5 p-4 text-xs leading-5 text-paper/70">
          Choosing this human service means voluntarily sending your résumé or Career Forge export to Koinophobia Labs.
          That is a separate data flow from the local-first app. Read the <Link href="/privacy" className="font-bold text-cyan underline">service privacy terms</Link> and <Link href="/terms" className="font-bold text-cyan underline">service terms</Link> before sending files.
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
