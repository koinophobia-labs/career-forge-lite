"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { trackCareerEvent } from "@/lib/analytics";
import { useEntitlement } from "@/lib/entitlement";
import { FREE_OFFER, PACKAGES, PACKAGE_ORDER, type PackageTier } from "@/lib/packages";

const checkoutEventByTier = {
  resume: "checkout_started_resume",
  job: "checkout_started_job",
  career: "checkout_started_career",
  "all-access": "checkout_started_all_access"
} as const;

const faqs: Array<[string, string]> = [
  [
    "What stays free?",
    "Import or enter your history, review evidence, build and edit one role direction, inspect résumé drafts, analyze jobs, track applications, and try six conversational interview answers. You do not need a card or account."
  ],
  [
    "What am I paying for?",
    "The paid packs remove specific workflow limits and unlock finished PDF, DOCX, ZIP, or tailored résumé exports. You are paying for a faster structured workflow and reusable files—not a hiring guarantee or vague AI credits."
  ],
  [
    "Is this a subscription?",
    "No. Resume, Job, and Career Packs are one-time purchases. 30-Day All Access is also a one-time purchase: it expires after 30 days and does not renew automatically."
  ],
  [
    "What happens after checkout?",
    "Stripe returns you to Career Forge, the server verifies the paid Price ID and amount, and a signed entitlement activates this browser. A short recovery code is also sent to the checkout email for another device."
  ],
  [
    "Can changing browser storage unlock paid access?",
    "No. The browser stores a server-signed entitlement rather than a paid=true flag. Changing its package or expiration invalidates the signature."
  ],
  [
    "What happens to my work if access expires?",
    "Your local career data, edits, and previously downloaded files remain yours. Expiration only re-locks the paid workflows; any permanent pack you also own stays active."
  ],
  [
    "Do generated materials still need review?",
    "Yes. Check every claim, date, employer, heading, and rendered file before sending it. Career Forge structures evidence and saves effort, but it cannot guarantee a hiring outcome or identical ATS parsing."
  ],
  [
    "What if payment succeeds but access does not arrive?",
    "Reload the Stripe return page or use the emailed recovery code. If that still fails, contact koinophobia999@gmail.com with the Stripe receipt reference so the purchase can be verified."
  ]
];

function formatExpiry(unixSeconds: number): string {
  return new Date(unixSeconds * 1_000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function PricingContent() {
  const searchParams = useSearchParams();
  const { entitlement, commerceMode } = useEntitlement();
  const [canSellSafely, setCanSellSafely] = useState<boolean | null>(null);
  const [pendingTier, setPendingTier] = useState<PackageTier | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const checkoutInFlightRef = useRef(false);
  const checkoutRequestRef = useRef<{ tier: PackageTier; requestId: string } | null>(null);
  const checkoutCancelled = searchParams.get("checkout") === "cancelled";

  useEffect(() => {
    trackCareerEvent("pricing_viewed");
  }, []);

  useEffect(() => {
    if (commerceMode !== "live") return;
    let active = true;
    fetch("/api/commerce-health", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active) setCanSellSafely(Boolean(data?.canSellSafely));
      })
      .catch(() => {
        if (active) setCanSellSafely(false);
      });
    return () => {
      active = false;
    };
  }, [commerceMode]);

  const checkoutAvailable = commerceMode === "test" || (commerceMode === "live" && canSellSafely === true);

  async function startCheckout(tier: PackageTier) {
    if (checkoutInFlightRef.current || !checkoutAvailable) return;
    checkoutInFlightRef.current = true;
    setPendingTier(tier);
    setCheckoutError(null);
    trackCareerEvent(checkoutEventByTier[tier]);
    if (checkoutRequestRef.current?.tier !== tier) {
      checkoutRequestRef.current = { tier, requestId: window.crypto.randomUUID() };
    }
    const requestId = checkoutRequestRef.current.requestId;
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, requestId })
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
    checkoutInFlightRef.current = false;
    setPendingTier(null);
  }

  return (
    <main>
      <CommandNav active="/pricing" />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">
          {commerceMode === "test"
            ? "Stripe test mode · No real charges"
            : commerceMode === "live" && canSellSafely === false
              ? "Checkout paused · Free tools stay open"
              : "Start free · Upgrade only when it saves you work"}
        </p>
        <h1 className="mt-3 max-w-4xl text-3xl font-bold text-paper sm:text-5xl">
          Build for free. Pay once when you need finished files or a faster job-search workflow.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-paper/70">
          Career Forge turns reviewed career evidence into reusable résumé and application materials. Choose the smallest
          pack that matches what you are doing now—there is no subscription, auto-renewal, or fake AI-credit meter.
        </p>

        {commerceMode === "test" && (
          <div className="mt-6 max-w-3xl rounded-xl border border-gold/30 bg-gold/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gold">
              Test checkout only. Stripe test cards create no real charge.
            </p>
          </div>
        )}

        {checkoutCancelled && (
          <div role="status" className="mt-6 max-w-3xl rounded-xl border border-white/15 bg-white/5 p-4">
            <p className="text-sm font-bold text-paper">Checkout cancelled. Nothing was charged and your work is still here.</p>
          </div>
        )}

        {entitlement.activeEntitlements.length > 0 && (
          <div className="mt-6 max-w-3xl rounded-xl border border-cyan/30 bg-cyan/10 p-4">
            <p className="text-sm font-bold text-cyan">Active on this device</p>
            <ul className="mt-2 space-y-1 text-sm text-paper/75">
              {entitlement.activeEntitlements.map((grant) => (
                <li key={`${grant.tier}:${grant.issuedAt}`}>
                  {PACKAGES[grant.tier].name}
                  {grant.expiresAt ? ` · expires ${formatExpiry(grant.expiresAt)}` : " · permanent pack access"}
                </li>
              ))}
            </ul>
            <Link href="/unlock" className="mt-3 inline-block text-sm font-bold text-cyan underline hover:text-gold">
              Manage access codes
            </Link>
          </div>
        )}

        {entitlement.expiredEntitlements.length > 0 && (
          <div className="mt-6 max-w-3xl rounded-xl border border-gold/30 bg-gold/10 p-4">
            <p className="text-sm font-bold text-gold">
              Your 30-Day All Access window ended. Your local work remains saved; choose another pack only when you need a paid workflow again.
            </p>
          </div>
        )}

        <div className="mt-10 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <article className="flex flex-col rounded-xl border border-cyan/35 bg-cyan/[0.04] p-6">
            <p className="lab-mono mb-3 w-fit rounded-full border border-cyan/35 bg-cyan/10 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-cyan">
              Useful before you pay
            </p>
            <h2 className="text-xl font-bold text-paper">{FREE_OFFER.name}</h2>
            <p className="mt-1 text-sm text-paper/60">{FREE_OFFER.audience}</p>
            <p className="mt-4 text-3xl font-black text-paper">$0</p>
            <p className="mt-3 text-sm leading-6 text-paper/70">{FREE_OFFER.summary}</p>
            <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-5 text-paper/70">
              <p><strong className="text-paper">Limit:</strong> {FREE_OFFER.usageLimit}</p>
              <p className="mt-2"><strong className="text-paper">Start:</strong> {FREE_OFFER.afterPurchase}</p>
            </div>
            <Link href="/" className="mt-6 rounded-md bg-cyan px-4 py-3 text-center text-sm font-black text-ink transition hover:bg-gold">
              Continue with Free →
            </Link>
          </article>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-xl font-bold text-paper">What paid access changes</h2>
            <p className="mt-2 text-sm leading-6 text-paper/70">
              Your dossier, editing, and previews stay free. Paid packs unlock export formats and the focused workflows that save the most repetitive work.
            </p>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Resume files", "Export reviewed ATS and recruiter versions as PDF, DOCX, and ZIP."],
                ["Target-job tailoring", "Turn one reviewed baseline into a job-specific résumé and application foundation."],
                ["Search support", "Use outreach drafting, deeper interview practice, and career-transition tools."],
                ["Simple ownership", "Permanent pack licenses or one clearly dated 30-day pass—never an auto-renewing subscription."]
              ].map(([term, detail]) => (
                <div key={term} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <dt className="text-sm font-bold text-cyan">{term}</dt>
                  <dd className="mt-1 text-xs leading-5 text-paper/65">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {PACKAGE_ORDER.map((tier) => {
            const pack = PACKAGES[tier];
            const owned = entitlement.activeEntitlements.some((grant) => grant.tier === tier);
            const activeGrant = entitlement.activeEntitlements.find((grant) => grant.tier === tier);
            return (
              <article
                key={tier}
                className={`flex flex-col rounded-xl border p-6 ${pack.badge ? "border-gold/50 bg-gold/5" : "border-white/10 bg-white/[0.03]"}`}
              >
                {pack.badge && (
                  <p className="lab-mono mb-3 w-fit rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-gold">
                    {pack.badge}
                  </p>
                )}
                <h2 className="text-xl font-bold text-paper">{pack.name}</h2>
                <p className="mt-1 text-sm text-paper/60">{pack.audience}</p>
                <p className="mt-4 text-3xl font-black text-paper">
                  ${pack.priceUsd}
                  <span className="ml-2 text-sm font-bold text-paper/50">
                    {pack.durationDays ? "for 30 days" : "once"}
                  </span>
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
                <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-5 text-paper/70">
                  <p><strong className="text-paper">Limit:</strong> {pack.usageLimit}</p>
                  <p className="mt-2"><strong className="text-paper">After purchase:</strong> {pack.afterPurchase}</p>
                </div>

                {owned ? (
                  <p className="mt-6 rounded-md border border-cyan/30 bg-cyan/10 px-4 py-3 text-center text-sm font-black text-cyan">
                    Active{activeGrant?.expiresAt ? ` until ${formatExpiry(activeGrant.expiresAt)}` : " on this device"}
                  </p>
                ) : checkoutAvailable ? (
                  <button
                    type="button"
                    onClick={() => startCheckout(tier)}
                    disabled={pendingTier !== null}
                    className={`mt-6 rounded-md px-4 py-3 text-sm font-black text-ink transition disabled:cursor-not-allowed disabled:opacity-60 ${pack.badge ? "bg-gold hover:bg-cyan" : "bg-cyan hover:bg-gold"}`}
                  >
                    {pendingTier === tier ? "Opening secure checkout…" : `Get the ${pack.name}`}
                  </button>
                ) : (
                  <div className="mt-6 rounded-md border border-white/15 bg-white/5 px-4 py-3 text-center">
                    <p className="text-sm font-bold text-paper/70">
                      {commerceMode === "live" && canSellSafely === null
                        ? "Checking secure checkout…"
                        : "Checkout is temporarily unavailable. Free tools remain open."}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {checkoutError && (
          <p role="alert" className="mt-5 rounded-md border border-ember/40 bg-ember/10 px-4 py-3 text-sm font-bold text-ember">
            {checkoutError}
          </p>
        )}

        <div className="mt-12 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-bold text-paper">Why use this instead of repeatedly prompting a general chatbot?</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-paper/70">
            Career Forge keeps one reusable local history, separates approved evidence from private context, maintains job and application state, formats repeatable exports, and links drafts back to reviewed sources. The value is less re-entry, fewer disconnected prompts, and a clearer next action—not a claim that the underlying writing is magical.
          </p>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-bold text-paper">Questions before purchasing</h2>
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
          Already have an access code?{" "}
          <Link href="/unlock" className="font-bold text-cyan underline hover:text-gold">Manage access</Link>
          {" · "}<Link href="/terms" className="underline hover:text-cyan">Terms</Link>
          {" · "}<Link href="/privacy" className="underline hover:text-cyan">Privacy</Link>
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingContent />
    </Suspense>
  );
}
