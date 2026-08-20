"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { trackCareerEvent } from "@/lib/analytics";
import { activateSignedEntitlement, removeLicense, useEntitlement } from "@/lib/entitlement";
import { PACKAGES } from "@/lib/packages";
import { formatAccessCodeInput, isLegacyLicenseKey } from "@/lib/redemption-code";

type FulfillmentState =
  | { phase: "idle" }
  | { phase: "fetching" }
  | { phase: "issued"; packageName: string; source: "purchase" | "invite"; expiresAt: number | null }
  | { phase: "pending" }
  | { phase: "error"; message: string };

type InviteState =
  | { phase: "idle" }
  | { phase: "redeeming" }
  | { phase: "error"; message: string };

type ManualState =
  | { phase: "idle" }
  | { phase: "redeeming" }
  | { phase: "valid"; packageName: string }
  | { phase: "expired"; packageName: string; expiresAt: number | null }
  | { phase: "invalid" };

// A purchase or short redemption returns a signed entitlement that is verified
// and stored offline. The long token never needs to be shown to the customer.
function UnlockContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { entitlement } = useEntitlement();
  const [fulfillment, setFulfillment] = useState<FulfillmentState>({ phase: "idle" });
  const [inviteCode, setInviteCode] = useState("");
  const [inviteState, setInviteState] = useState<InviteState>({ phase: "idle" });
  const [accessCode, setAccessCode] = useState("");
  const [manualState, setManualState] = useState<ManualState>({ phase: "idle" });
  const fetchedForSession = useRef<string | null>(null);
  useEffect(() => {
    if (!sessionId || fetchedForSession.current === sessionId) return;
    fetchedForSession.current = sessionId;
    setFulfillment({ phase: "fetching" });
    void fetch(`/api/license?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        const data = (await response.json()) as { signedEntitlement?: string; packageName?: string; error?: string; pending?: boolean };
        if (response.ok && data.signedEntitlement) {
          trackCareerEvent("checkout_completed");
          const outcome = await activateSignedEntitlement(data.signedEntitlement);
          trackCareerEvent(outcome.status === "valid" ? "license_activated" : "license_invalid");
          if (outcome.status !== "valid") {
            setFulfillment({
              phase: "error",
              message: outcome.status === "expired"
                ? "This 30-Day All Access purchase has expired. Your saved work is still available."
                : "The purchase was verified, but its signed access could not be activated."
            });
            return;
          }
          setFulfillment({
            phase: "issued",
            packageName: data.packageName ?? "your pack",
            source: "purchase",
            expiresAt: outcome.expiresAt
          });
          return;
        }
        if (data.pending) {
          setFulfillment({ phase: "pending" });
          return;
        }
        setFulfillment({ phase: "error", message: data.error ?? "Something went wrong issuing your key." });
      })
      .catch(() => setFulfillment({ phase: "error", message: "Could not reach the license service. Check your connection and reload this page." }));
  }, [sessionId]);

  async function handleFounderInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteCode.trim() || inviteState.phase === "redeeming") return;
    setInviteState({ phase: "redeeming" });

    try {
      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode })
      });
      const data = (await response.json()) as { signedEntitlement?: string; packageName?: string; error?: string };
      if (!response.ok || !data.signedEntitlement) {
        setInviteState({ phase: "error", message: data.error ?? "That founder code could not be redeemed." });
        return;
      }

      const outcome = await activateSignedEntitlement(data.signedEntitlement);
      trackCareerEvent(outcome.status === "valid" ? "license_activated" : "license_invalid");
      if (outcome.status !== "valid") {
        setInviteState({ phase: "error", message: "The invite was accepted, but the issued license could not be activated." });
        return;
      }

      setInviteCode("");
      setInviteState({ phase: "idle" });
      setFulfillment({
        phase: "issued",
        packageName: data.packageName ?? "your pack",
        source: "invite",
        expiresAt: outcome.expiresAt
      });
    } catch {
      setInviteState({ phase: "error", message: "Could not reach the founder invite service. Check your connection and try again." });
    }
  }

  async function handleManualActivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = accessCode.trim();
    if (!submitted || manualState.phase === "redeeming") return;
    setManualState({ phase: "redeeming" });

    try {
      let signedEntitlement: string | null = null;
      let packageName = "Career Forge pack";
      if (isLegacyLicenseKey(submitted)) {
        // Existing CF1 keys stay valid and are verified offline exactly as before.
        signedEntitlement = submitted;
      } else {
        const response = await fetch("/api/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: submitted }),
        });
        const data = (await response.json()) as {
          signedEntitlement?: string;
          packageName?: string;
        };
        if (!response.ok || !data.signedEntitlement) {
          setManualState({ phase: "invalid" });
          trackCareerEvent("license_invalid");
          return;
        }
        signedEntitlement = data.signedEntitlement;
        packageName = data.packageName ?? packageName;
      }

      const outcome = await activateSignedEntitlement(signedEntitlement);
      if (outcome.status === "expired") {
        setManualState({
          phase: "expired",
          packageName: outcome.tier ? PACKAGES[outcome.tier].name : packageName,
          expiresAt: outcome.expiresAt
        });
        trackCareerEvent("license_invalid");
        return;
      }
      if (outcome.status !== "valid" || !outcome.tier) {
        setManualState({ phase: "invalid" });
        trackCareerEvent("license_invalid");
        return;
      }
      setManualState({
        phase: "valid",
        packageName: isLegacyLicenseKey(submitted) ? PACKAGES[outcome.tier].name : packageName,
      });
      setAccessCode("");
      trackCareerEvent("license_activated");
    } catch {
      setManualState({ phase: "invalid" });
      trackCareerEvent("license_invalid");
    }
  }

  async function pasteAccessCode() {
    try {
      const pasted = await navigator.clipboard.readText();
      setAccessCode(formatAccessCodeInput(pasted));
      setManualState({ phase: "idle" });
    } catch {
      // Clipboard permission can be declined; ordinary paste remains available.
    }
  }

  return (
    <main>
      <CommandNav active="/unlock" />

      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Unlock</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Activate your Career Forge pack</h1>

        {fulfillment.phase === "fetching" && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm font-bold text-paper/70">Confirming your purchase and activating Career Forge…</p>
          </div>
        )}

        {fulfillment.phase === "issued" && (
          <div className="mt-6 rounded-xl border border-cyan/30 bg-cyan/5 p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan">
              {fulfillment.source === "invite" ? "Founder invite accepted" : "Purchase confirmed"}
            </p>
            <h2 className="mt-2 text-xl font-bold text-paper">{fulfillment.packageName} activated</h2>
            <p className="mt-3 text-sm leading-6 text-paper/70">
              Career Forge is active in this browser.
              {fulfillment.source === "purchase" && " Your short access code was sent to the email used at Checkout for unlocking another device."}
            </p>
            {fulfillment.expiresAt && (
              <p className="mt-2 text-sm font-bold text-gold">
                All Access expires {new Date(fulfillment.expiresAt * 1_000).toLocaleDateString()} and does not renew automatically.
              </p>
            )}
            <Link href="/" className="mt-5 inline-block rounded-md bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-cyan">
              Continue where you left off →
            </Link>
          </div>
        )}

        {fulfillment.phase === "pending" && (
          <div className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-6">
            <p className="text-sm leading-6 text-paper/80">
              Your payment is still processing (some payment methods take a few minutes). Reload this page shortly. Your
              Career Forge access-code email will arrive after Stripe confirms payment.
            </p>
          </div>
        )}

        {fulfillment.phase === "error" && (
          <div role="alert" className="mt-6 rounded-xl border border-ember/40 bg-ember/10 p-6">
            <p className="text-sm font-bold text-ember">{fulfillment.message}</p>
            <p className="mt-2 text-sm leading-6 text-paper/70">
              If you completed a purchase, use the direct unlock link in your Career Forge access email. If it did not
              arrive, contact koinophobia999@gmail.com with your Stripe receipt reference so support can verify the purchase.
            </p>
          </div>
        )}

        <div className="mt-8 rounded-xl border border-cyan/25 bg-cyan/[0.04] p-6">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan">Founder access</p>
          <h2 className="mt-2 text-lg font-bold text-paper">Have a founder code?</h2>
          <p className="mt-2 text-sm leading-6 text-paper/60">
            Redeem it here for your own Career Forge license. No checkout or account is required.
          </p>
          <form onSubmit={handleFounderInvite} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="founder-code" className="sr-only">
              Founder code
            </label>
            <input
              id="founder-code"
              type="text"
              value={inviteCode}
              onChange={(event) => {
                setInviteCode(event.target.value);
                setInviteState({ phase: "idle" });
              }}
              placeholder="Founder code"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="lab-mono min-h-11 flex-1 rounded-md border border-white/15 bg-obsidian px-4 py-2 text-sm text-paper placeholder:text-paper/30 focus:border-cyan focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inviteCode.trim() || inviteState.phase === "redeeming"}
              className="min-h-11 rounded-md bg-cyan px-5 py-2 text-sm font-black text-ink transition hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {inviteState.phase === "redeeming" ? "Redeeming…" : "Redeem code"}
            </button>
          </form>
          {inviteState.phase === "error" && (
            <p role="alert" className="mt-3 text-sm font-bold text-ember">
              {inviteState.message}
            </p>
          )}
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-bold text-paper">Enter your Career Forge access code</h2>
          <p className="mt-2 text-sm leading-6 text-paper/60">
            Use the short code from your purchase email. Hyphens, spaces, and letter case do not matter. No account or
            sign-in is required.
          </p>
          <form onSubmit={handleManualActivate} className="mt-4 min-w-0">
            <label htmlFor="access-code" className="text-sm font-bold text-paper">
              Access code
            </label>
            <div className="mt-2 flex min-w-0 flex-col gap-3 sm:flex-row">
              <input
                id="access-code"
                type="text"
                value={accessCode}
                onChange={(event) => {
                  setAccessCode(formatAccessCodeInput(event.target.value));
                  setManualState({ phase: "idle" });
                }}
                placeholder="CF-7K9M-P4TX-W8Q2R"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby="access-code-help"
                className="lab-mono min-h-12 min-w-0 flex-1 rounded-md border border-white/15 bg-obsidian px-3 py-2 text-base uppercase tracking-[0.08em] text-paper placeholder:text-paper/30 focus:border-cyan focus:outline-none sm:px-4"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={pasteAccessCode}
                  className="min-h-12 flex-1 rounded-md border border-white/20 px-4 py-2 text-sm font-bold text-paper transition hover:border-cyan sm:flex-none"
                >
                  Paste code
                </button>
                <button
                  type="submit"
                  disabled={!accessCode.trim() || manualState.phase === "redeeming"}
                  className="min-h-12 flex-1 rounded-md bg-cyan px-5 py-2 text-sm font-black text-ink transition hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                >
                  {manualState.phase === "redeeming" ? "Activating…" : "Activate"}
                </button>
              </div>
            </div>
            <p id="access-code-help" className="mt-2 text-xs leading-5 text-paper/50">
              Example: CF-7K9M-P4TX-W8Q2R
            </p>
          </form>
          {manualState.phase === "valid" && (
            <p role="status" className="mt-3 text-sm font-bold text-cyan">
              {manualState.packageName} activated
            </p>
          )}
          {manualState.phase === "invalid" && (
            <p role="alert" className="mt-3 text-sm font-bold text-ember">
              That access code could not be activated. Check the code and try again.
            </p>
          )}
          {manualState.phase === "expired" && (
            <p role="status" className="mt-3 text-sm font-bold text-gold">
              {manualState.packageName} expired{manualState.expiresAt ? ` on ${new Date(manualState.expiresAt * 1_000).toLocaleDateString()}` : ""}. Your saved work remains on this device.
            </p>
          )}
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-bold text-paper">License on this device</h2>
          {entitlement.activeEntitlements.length > 0 ? (
            <div className="mt-3">
              <ul className="space-y-2 text-sm leading-6 text-paper/80">
                {entitlement.activeEntitlements.map((grant) => (
                  <li key={`${grant.tier}:${grant.issuedAt}`}>
                    <span className="font-black text-cyan">{PACKAGES[grant.tier].name}</span>
                    {grant.expiresAt ? ` · expires ${new Date(grant.expiresAt * 1_000).toLocaleDateString()}` : " · permanent pack access"}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm leading-6 text-paper/60">Clearing career data in Settings does not remove these access grants.</p>
              <button
                type="button"
                onClick={() => {
                  removeLicense();
                  setManualState({ phase: "idle" });
                }}
                className="mt-4 rounded-md border border-white/20 px-4 py-2 text-sm font-bold text-paper/70 transition hover:border-ember hover:text-ember"
              >
                Remove all access codes from this device
              </button>
            </div>
          ) : entitlement.status === "checking" ? (
            <p className="mt-3 text-sm text-paper/60">Checking stored license…</p>
          ) : entitlement.status === "expired" ? (
            <p className="mt-3 text-sm leading-6 text-paper/60">
              Your time-limited access has expired. Your saved work remains here.{" "}
              <Link href="/pricing" className="font-bold text-cyan underline hover:text-gold">See current packs</Link>
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-paper/60">
              No license is active on this device.{" "}
              <Link href="/pricing" className="font-bold text-cyan underline hover:text-gold">
                See the packs
              </Link>
            </p>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

export default function UnlockPage() {
  return (
    <Suspense fallback={null}>
      <UnlockContent />
    </Suspense>
  );
}
