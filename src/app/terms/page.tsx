import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "Terms of Use — Career Forge"
};

// Plain-language terms matching how the product actually works. Reviewed copy
// belongs to the owner: see docs/PAYMENTS.md go-live checklist before selling.

export default function TermsPage() {
  return (
    <main>
      <CommandNav active="/terms" />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Terms of Use</p>
        <h1 className="mt-3 text-3xl font-bold text-paper">Plain terms for a simple product</h1>
        <p className="mt-2 text-sm text-paper/50">Last updated: July 16, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-paper/75">
          <section>
            <h2 className="text-lg font-bold text-paper">What Career Forge is</h2>
            <p className="mt-2">
              Career Forge, by Koinophobia Labs, helps you turn your real work history into résumés, positioning, and
              application materials. It runs in your browser and stores your career data on your own device.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-paper">Purchases and licenses</h2>
            <p className="mt-2">
              Paid packs are one-time purchases, not subscriptions. A purchase issues a license key that unlocks your
              pack&apos;s features in any browser where you enter it. Keys are for your personal use — don&apos;t
              publish or resell them. Payments are processed by Stripe; we never see or store your card details.
            </p>
            <p className="mt-2">
              If something went wrong with a purchase, reply to your Stripe receipt email and we will make it right.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-paper">Your content and responsibility</h2>
            <p className="mt-2">
              Everything you enter stays yours. Career Forge only writes from facts you approve, but you are
              responsible for what you submit to employers — review every document before you send it. Career Forge is
              a writing and organization tool: it does not guarantee interviews, offers, salaries, or that any
              particular applicant-tracking system will parse a document a particular way.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-paper">Your data, your device</h2>
            <p className="mt-2">
              Career data lives in your browser&apos;s local storage. We cannot see it, recover it, or delete it for
              you — use the backup tools in{" "}
              <Link href="/settings" className="text-cyan underline hover:text-gold">
                Settings
              </Link>{" "}
              to protect your work. Clearing your browser data erases it. See the{" "}
              <Link href="/privacy" className="text-cyan underline hover:text-gold">
                privacy page
              </Link>{" "}
              for exactly what we can and cannot observe.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-paper">Warranty and liability</h2>
            <p className="mt-2">
              Career Forge is provided as-is. To the maximum extent the law allows, Koinophobia Labs is not liable for
              indirect damages or lost opportunities arising from use of the product, and total liability is limited
              to what you paid for it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-paper">Changes</h2>
            <p className="mt-2">
              If these terms change materially, the date above changes with them and the substance stays this plain.
            </p>
          </section>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
