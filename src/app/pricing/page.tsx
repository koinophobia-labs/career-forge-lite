"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { trackCareerEvent } from "@/lib/analytics";
import { useEntitlement } from "@/lib/entitlement";
import { PACKAGES, PACKAGE_ORDER, type PackageTier } from "@/lib/packages";

const checkoutEventByTier: Record<PackageTier, "checkout_started_reset" | "checkout_started_job_search" | "checkout_started_career_switch"> = {
  reset: "checkout_started_reset",
  "job-search": "checkout_started_job_search",
  "career-switch": "checkout_started_career_switch"
};

const betaFaqs: Array<[string, string]> = [
  [
    "Is anything for sale during the public beta?",
    "No. Paid packaging and prices remain provisional. The complete workflow is open while production behavior, artifact quality, and real user value are being validated."
  ],
  [
    "What can I test for free?",
    "You can import or describe your history, review evidence, choose role lanes, generate résumé drafts, tailor against postings, use outreach and interview tools, and export your materials."
  ],
  [
    "Are generated materials ready to send?",
    "They are drafts. Review every claim, date, heading, company, and layout before using a résumé, LinkedIn section, message, or interview answer."
  ],
  [
    "Do I need an account?",
    "No. Career Forge has no accounts. Career data remains in this browser unless you download a backup and restore it elsewhere."
  ],
  [
    "What happens to the proposed package scopes?",
    "They remain product hypotheses. They may change or disappear after production re-audits and human testing; no current price or package should be treated as a commitment."
  ],
  [
    "How does Career Forge handle unsupported information?",
    "Professional evidence is separated from target preferences, constraints, uncertainty, separation reasons, and gaps. The system is designed to keep those context items out of professional drafts, but you must still review every output."
  ]
];

const purchaseFaqs: Array<[string, string]> = [
  [
    "What happens after I buy?",
    "You get a license key on the confirmation page and by email when supplied at checkout. Paste it once on the Unlock page and the selected feature grants become active in this browser."
  ],
  [
    "Is this a subscription?",
    "No. Each package is a one-time purchase. There is no renewal or trial conversion."
  ],
  [
    "Do I need an account?",
    "No. The license key contains no career data, and your career information remains on your device."
  ],
  [
    "What can I do before buying?",
    "You can build and review the dossier, explore lanes, and preview generated materials. The selected package determines which export and power features unlock."
  ],
  [
    "How should I use generated materials?",
    "Treat every generated item as a draft. Check the evidence receipt, review all claims and dates, and inspect the rendered PDF or DOCX before sending it."
  ],
  [
    "What if my payment goes through but I lose the key?",
    "Use the link in the Stripe receipt to reopen the confirmation page, or contact support with the receipt reference."
  ]
];

export default function PricingPage() {
  const { entitlement, commerceMode, commerceEnabled } = useEntitlement();
  const [pendingTier, setPendingTier] = useState<PackageTier | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const isPublicBeta = commerceMode === "off";
  const configuredPaidBetaTier = process.env.NEXT_PUBLIC_PAID_BETA_TIER;
  const paidBetaTier: PackageTier =
    commerceMode === "live"
      ? "reset"
      : configuredPaidBetaTier === "job-search" || configuredPaidBetaTier === "career-switch"
        ? configuredPaidBetaTier
        : "reset";
  const faqs = isPublicBeta ? betaFaqs : purchaseFaqs;

  useEffect(() => {
    trackCareerEvent("pricing_viewed");
  }, []);

  async function startCheckout(tier: PackageTier) {
    if (pendingTier || !commerceEnabled || (commerceMode === "live" && tier !== paidBetaTier)) return;
    setPendingTier(tier);
    setCheckoutError(null);
    trackCareerEvent(checkoutEventByTier[tier]);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier })
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (response.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setCheckoutError(data.error ?? "Checkout could not be started. Please try again.");
    } catch {
      setCheckoutError("Checkout could not be started. Check your connection and try again.");
    }
    setPendingTier(null);
  }

  return (
    <main>
      <CommandNav active="/pricing" />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">
          {isPublicBeta ? "Public beta · No purchases enabled" : commerceMode === "live" ? "Founding paid beta · Career Reset only" : "One-time purchase · No account · No subscription"}
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold text-paper sm:text-5xl">
          {isPublicBeta
            ? "Use the complete workflow free while the paid outcome is being validated."
            : "Choose the feature scope that matches your current search."}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-paper/70">
          {isPublicBeta
            ? "The scopes below show how Career Forge may eventually be packaged. They are not offers, the prices are not displayed, and no commercial-readiness claim is being made."
            : "Build and review first. When you are ready to export or use power features, choose a one-time package. Career data remains on your device."}
        </p>

        {isPublicBeta && (
          <div className="mt-6 max-w-3xl rounded-xl border border-cyan/25 bg-cyan/5 p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan">Release boundary</p>
            <p className="mt-2 text-sm leading-6 text-paper/75">
              Production re-audits and human use must independently support artifact quality, workflow value, and pricing before paid access opens. Every feature is included free during this period.
            </p>
            <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-6 text-paper/75">
              Available now, separately: a{" "}
              <Link href="/reviewed-service" className="font-bold text-gold underline">
                $149 human-reviewed résumé service
              </Link>{" "}
              where a person reviews your dossier, lanes, résumé, LinkedIn positioning, and final files before
              delivery. It is a different offer from the automated beta — automated outputs do not receive that
              review.
            </p>
          </div>
        )}
        {commerceMode === "test" && (
          <div className="mt-6 max-w-2xl rounded-xl border border-gold/30 bg-gold/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gold">
              Test mode. Checkout uses Stripe test cards and creates no real charge.
            </p>
          </div>
        )}
        {entitlement.status === "valid" && entitlement.tier && (
          <div className="mt-6 max-w-2xl rounded-xl border border-cyan/30 bg-cyan/10 p-4">
            <p className="text-sm font-bold text-cyan">
              {PACKAGES[entitlement.tier].name} is active on this device.{" "}
              <Link href="/unlock" className="underline hover:text-gold">
                Manage your license
              </Link>
            </p>
          </div>
        )}

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PACKAGE_ORDER.map((tier) => {
            const pack = PACKAGES[tier];
            const tierAvailable = commerceMode !== "live" || tier === paidBetaTier;
            const highlighted = commerceMode === "live" ? tier === paidBetaTier : tier === "job-search";
            const owned = entitlement.status === "valid" && entitlement.tier === tier;
            return (
              <article
                key={tier}
                className={`flex flex-col rounded-xl border p-6 ${
                  highlighted ? "border-gold/50 bg-gold/5" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                {highlighted && (
                  <p className="lab-mono mb-3 w-fit rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-gold">
                    {isPublicBeta ? "Proposed active-search scope" : "Active-search scope"}
                  </p>
                )}
                <h2 className="text-xl font-bold text-paper">{isPublicBeta ? `Proposed: ${pack.name}` : pack.name}</h2>
                <p className="mt-1 text-sm text-paper/60">{pack.audience}</p>
                <p className="mt-4 text-2xl font-black text-paper">
                  {isPublicBeta ? "Included in beta" : `$${pack.priceUsd}`}
                  {!isPublicBeta && <span className="ml-2 text-sm font-bold text-paper/50">once</span>}
                </p>
                <p className="mt-3 text-sm leading-6 text-paper/70">{pack.summary}</p>
                <ul className="mt-5 flex-1 space-y-2">
                  {pack.deliverables.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-6 text-paper/80">
                      <span aria-hidden="true" className="text-cyan">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                {commerceEnabled ? (
                  !tierAvailable ? (
                    <p className="mt-6 rounded-md border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-bold text-paper/60">
                      Not in the founding paid beta yet
                    </p>
                  ) : owned ? (
                    <p className="mt-6 rounded-md border border-cyan/30 bg-cyan/10 px-4 py-3 text-center text-sm font-black text-cyan">
                      Active on this device
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startCheckout(tier)}
                      disabled={pendingTier !== null}
                      className={`mt-6 rounded-md px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        highlighted ? "bg-gold text-ink hover:bg-cyan" : "bg-cyan text-ink hover:bg-gold"
                      }`}
                    >
                      {pendingTier === tier ? "Opening secure checkout…" : `Get the ${pack.name}`}
                    </button>
                  )
                ) : (
                  <p className="mt-6 rounded-md border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-bold text-paper/60">
                    Free during public beta
                  </p>
                )}
              </article>
            );
          })}
        </div>

        {checkoutError && (
          <p role="alert" className="mt-4 rounded-md border border-ember/40 bg-ember/10 px-4 py-3 text-sm font-bold text-ember">
            {checkoutError}
          </p>
        )}

        <div className="mt-12 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-bold text-paper">How this differs from a stateless chatbot or template site</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-paper/70">
            Career Forge keeps a reusable local history, records evidence decisions, separates professional claims from context, and links drafts back to reviewed sources. That structure reduces re-entry, but it does not remove the need for human review or guarantee a hiring outcome.
          </p>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-bold text-paper">{isPublicBeta ? "Public-beta questions" : "Questions before purchasing"}</h2>
          <dl className="mt-5 grid gap-4 md:grid-cols-2">
            {faqs.map(([question, answer]) => (
              <div key={question} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <dt className="text-sm font-black text-paper">{question}</dt>
                <dd className="mt-2 text-sm leading-6 text-paper/70">{answer}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-10 text-sm text-paper/50">
          Already have a license key?{" "}
          <Link href="/unlock" className="font-bold text-cyan underline hover:text-gold">
            Manage your key
          </Link>
          {" · "}
          <Link href="/terms" className="underline hover:text-cyan">Terms</Link>
          {" · "}
          <Link href="/privacy" className="underline hover:text-cyan">Privacy</Link>
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
