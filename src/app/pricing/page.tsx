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

const faqs: Array<[string, string]> = [
  [
    "What happens after I buy?",
    "You get a license key on the confirmation page (and by email if you enter one at checkout). Paste it once on the Unlock page and your pack is active in this browser. The same key works on any device — keep it."
  ],
  [
    "Is this a subscription?",
    "No. Each pack is a one-time purchase. There is no renewal, no trial that converts, and nothing to cancel."
  ],
  [
    "Do I need an account?",
    "No. Career Forge has no accounts. Your license key is the whole unlock — it contains no personal information, and your career data never leaves your device."
  ],
  [
    "What can I do before buying?",
    "Everything that builds trust: pick your goal, import or describe your history, approve your evidence, explore role lanes, and preview your résumé pack on screen. Buying unlocks exports, tailoring, outreach templates, and the rest of your pack."
  ],
  [
    "Will Career Forge invent things on my résumé?",
    "No — that is the point of the product. Every claim in an exported document traces back to evidence you explicitly approved. Missing experience stays missing; we help you say what is true, well."
  ],
  [
    "What if my payment goes through but I lose the key?",
    "Your Stripe receipt email contains a link back to the confirmation page, which always re-issues your key. You can also reply to the receipt to reach support."
  ]
];

export default function PricingPage() {
  const { entitlement, commerceMode, commerceEnabled } = useEntitlement();
  const [pendingTier, setPendingTier] = useState<PackageTier | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    trackCareerEvent("pricing_viewed");
  }, []);

  async function startCheckout(tier: PackageTier) {
    if (pendingTier) return; // double-click guard: one checkout at a time
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
      setCheckoutError("Checkout could not be started — check your connection and try again.");
    }
    setPendingTier(null);
  }

  return (
    <main>
      <CommandNav active="/pricing" />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">One-time purchase · No account · No subscription</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold text-paper sm:text-5xl">
          Pay once. Leave with a complete, truthful career package.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-paper/70">
          Build and review everything free. When you are ready to use it — export, tailor, reach out, practice — pick
          the pack that matches your situation. Your career data stays on your device either way.
        </p>

        {commerceMode === "off" && (
          <div className="mt-6 max-w-2xl rounded-xl border border-cyan/25 bg-cyan/5 p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan">Free beta</p>
            <p className="mt-2 text-sm leading-6 text-paper/75">
              Career Forge is currently free while in beta — every feature below is open. The packs and prices shown
              are what purchasing is planned to look like. Nothing is for sale yet.
            </p>
          </div>
        )}
        {commerceMode === "test" && (
          <div className="mt-6 max-w-2xl rounded-xl border border-gold/30 bg-gold/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gold">
              Test mode — checkout uses Stripe test cards. No real charges.
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
            const highlighted = tier === "job-search";
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
                    Most useful for active searches
                  </p>
                )}
                <h2 className="text-xl font-bold text-paper">{pack.name}</h2>
                <p className="mt-1 text-sm text-paper/60">{pack.audience}</p>
                <p className="mt-4 text-4xl font-black text-paper">
                  ${pack.priceUsd}
                  <span className="ml-2 text-sm font-bold text-paper/50">once</span>
                </p>
                <p className="mt-3 text-sm leading-6 text-paper/70">{pack.summary}</p>
                <ul className="mt-5 flex-1 space-y-2">
                  {pack.deliverables.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-6 text-paper/80">
                      <span aria-hidden="true" className="text-cyan">
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                {commerceEnabled ? (
                  owned ? (
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
                    Included free during beta
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
          <h2 className="text-lg font-bold text-paper">Why this is different from a chatbot or a template site</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-paper/70">
            Generic AI writers produce plausible-sounding résumés with details you never said. Career Forge works the
            other way: it collects what actually happened, asks you to approve every fact, and only writes from what
            you approved. The result is a package you can defend in an interview — because all of it is true.
          </p>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-bold text-paper">Questions people ask before buying</h2>
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
            Unlock your pack
          </Link>
          {" · "}
          <Link href="/terms" className="underline hover:text-cyan">
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="underline hover:text-cyan">
            Privacy
          </Link>
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
