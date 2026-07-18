"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { trackCareerEvent } from "@/lib/analytics";
import { activateLicenseKey, removeLicense, useEntitlement } from "@/lib/entitlement";
import { PACKAGES } from "@/lib/packages";

type FulfillmentState =
  | { phase: "idle" }
  | { phase: "fetching" }
  | { phase: "issued"; license: string; packageName: string; source: "purchase" | "invite" }
  | { phase: "pending" }
  | { phase: "error"; message: string };

type InviteState =
  | { phase: "idle" }
  | { phase: "redeeming" }
  | { phase: "error"; message: string };

// Exchanges a completed checkout for the license key and activates it.
// Also the manual home for founder invites and keys used on a new device.
function UnlockContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { entitlement } = useEntitlement();
  const [fulfillment, setFulfillment] = useState<FulfillmentState>({ phase: "idle" });
  const [inviteCode, setInviteCode] = useState("");
  const [inviteState, setInviteState] = useState<InviteState>({ phase: "idle" });
  const [manualKey, setManualKey] = useState("");
  const [manualResult, setManualResult] = useState<"valid" | "invalid" | null>(null);
  const [copied, setCopied] = useState(false);
  const fetchedForSession = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId || fetchedForSession.current === sessionId) return;
    fetchedForSession.current = sessionId;
    setFulfillment({ phase: "fetching" });
    void fetch(`/api/license?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        const data = (await response.json()) as { license?: string; packageName?: string; error?: string; pending?: boolean };
        if (response.ok && data.license) {
          trackCareerEvent("checkout_completed");
          const outcome = await activateLicenseKey(data.license);
          trackCareerEvent(outcome.status === "valid" ? "license_activated" : "license_invalid");
          setFulfillment({
            phase: "issued",
            license: data.license,
            packageName: data.packageName ?? "your pack",
            source: "purchase"
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
      const data = (await response.json()) as { license?: string; packageName?: string; error?: string };
      if (!response.ok || !data.license) {
        setInviteState({ phase: "error", message: data.error ?? "That founder code could not be redeemed." });
        return;
      }

      const outcome = await activateLicenseKey(data.license);
      trackCareerEvent(outcome.status === "valid" ? "license_activated" : "license_invalid");
      if (outcome.status !== "valid") {
        setInviteState({ phase: "error", message: "The invite was accepted, but the issued license could not be activated." });
        return;
      }

      setInviteCode("");
      setInviteState({ phase: "idle" });
      setFulfillment({
        phase: "issued",
        license: data.license,
        packageName: data.packageName ?? "your pack",
        source: "invite"
      });
    } catch {
      setInviteState({ phase: "error", message: "Could not reach the founder invite service. Check your connection and try again." });
    }
  }

  async function handleManualActivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualKey.trim()) return;
    const outcome = await activateLicenseKey(manualKey);
    setManualResult(outcome.status === "valid" ? "valid" : "invalid");
    trackCareerEvent(outcome.status === "valid" ? "license_activated" : "license_invalid");
  }

  async function copyIssuedKey(license: string) {
    try {
      await navigator.clipboard.writeText(license);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Selection stays available for manual copy.
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
            <p className="text-sm font-bold text-paper/70">Confirming your purchase and issuing your license key…</p>
          </div>
        )}

        {fulfillment.phase === "issued" && (
          <div className="mt-6 rounded-xl border border-cyan/30 bg-cyan/5 p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan">
              {fulfillment.source === "invite" ? "Founder invite accepted" : "Purchase confirmed"}
            </p>
            <h2 className="mt-2 text-xl font-bold text-paper">Your {fulfillment.packageName} is unlocked.</h2>
            <p className="mt-3 text-sm leading-6 text-paper/70">
              This is your unique license key. It is already active in this browser.{" "}
              <span className="font-bold text-paper">Save it somewhere safe</span> so you can unlock any other device.
              {fulfillment.source === "purchase" && " Your Stripe receipt links back to this page if you ever lose it."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <code
                tabIndex={0}
                role="region"
                aria-label="Your license key. Scroll horizontally with arrow keys to read the full key, or use the Copy key button."
                className="lab-mono block max-w-full overflow-x-auto rounded-md border border-white/15 bg-obsidian px-4 py-3 text-xs text-gold"
              >
                {fulfillment.license}
              </code>
              <button
                type="button"
                onClick={() => copyIssuedKey(fulfillment.license)}
                className="rounded-md bg-cyan px-4 py-2 text-sm font-black text-ink transition hover:bg-gold"
              >
                {copied ? "Copied" : "Copy key"}
              </button>
            </div>
            <Link href="/" className="mt-5 inline-block rounded-md bg-gold px-5 py-3 text-sm font-black text-ink transition hover:bg-cyan">
              Continue where you left off →
            </Link>
          </div>
        )}

        {fulfillment.phase === "pending" && (
          <div className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-6">
            <p className="text-sm leading-6 text-paper/80">
              Your payment is still processing (some payment methods take a few minutes). Reload this page shortly. Your
              Stripe receipt email also links back here.
            </p>
          </div>
        )}

        {fulfillment.phase === "error" && (
          <div role="alert" className="mt-6 rounded-xl border border-ember/40 bg-ember/10 p-6">
            <p className="text-sm font-bold text-ember">{fulfillment.message}</p>
            <p className="mt-2 text-sm leading-6 text-paper/70">
              If you completed a purchase, use the link in your Stripe receipt email to return here, or reply to the
              receipt to reach support. Your purchase is safe. This page can always re-issue your key.
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
          <h2 className="text-lg font-bold text-paper">Have a license key? Paste it here.</h2>
          <p className="mt-2 text-sm leading-6 text-paper/60">
            Keys look like <span className="lab-mono text-xs">CF1.xxxx.xxxx</span> and work on any device. Nothing else
            is needed. No account, no sign-in.
          </p>
          <form onSubmit={handleManualActivate} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="license-key" className="sr-only">
              License key
            </label>
            <input
              id="license-key"
              type="text"
              value={manualKey}
              onChange={(event) => {
                setManualKey(event.target.value);
                setManualResult(null);
              }}
              placeholder="CF1.…"
              autoComplete="off"
              spellCheck={false}
              className="lab-mono min-h-11 flex-1 rounded-md border border-white/15 bg-obsidian px-4 py-2 text-sm text-paper placeholder:text-paper/30 focus:border-cyan focus:outline-none"
            />
            <button
              type="submit"
              disabled={!manualKey.trim()}
              className="min-h-11 rounded-md bg-cyan px-5 py-2 text-sm font-black text-ink transition hover:bg-gold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Activate
            </button>
          </form>
          {manualResult === "valid" && (
            <p className="mt-3 text-sm font-bold text-cyan">
              Key activated. Your pack is unlocked on this device.
            </p>
          )}
          {manualResult === "invalid" && (
            <p role="alert" className="mt-3 text-sm font-bold text-ember">
              That key didn&apos;t validate. Check for missing characters (keys are long) and paste the whole thing,
              including the CF1 prefix.
            </p>
          )}
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-bold text-paper">License on this device</h2>
          {entitlement.status === "valid" && entitlement.tier ? (
            <div className="mt-3">
              <p className="text-sm leading-6 text-paper/80">
                <span className="font-black text-cyan">{PACKAGES[entitlement.tier].name}</span> is active. Clearing
                your career data in Settings does <span className="font-bold">not</span> remove your license.
              </p>
              <button
                type="button"
                onClick={() => {
                  removeLicense();
                  setManualResult(null);
                }}
                className="mt-4 rounded-md border border-white/20 px-4 py-2 text-sm font-bold text-paper/70 transition hover:border-ember hover:text-ember"
              >
                Remove license from this device
              </button>
            </div>
          ) : entitlement.status === "checking" ? (
            <p className="mt-3 text-sm text-paper/60">Checking stored license…</p>
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
