import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "Privacy — Career Forge"
};

export default function PrivacyPage() {
  return (
    <main>
      <CommandNav active="/privacy" />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Privacy</p>
        <h1 className="mt-3 text-3xl font-bold text-paper">Your career data never leaves your device.</h1>
        <p className="mt-2 text-sm text-paper/50">Last updated: July 16, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-paper/75">
          <section>
            <h2 className="text-lg font-bold text-paper">What stays on your device (everything that matters)</h2>
            <p className="mt-2">
              Your work history, imported résumés, approved evidence, generated documents, applications, contacts, and
              interview practice all live in your browser&apos;s local storage. There are no accounts and no server
              database. Imported résumé files are parsed in your browser and the raw files are not retained. We cannot
              read any of it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-paper">What we can observe (anonymous usage events)</h2>
            <p className="mt-2">
              Career Forge records anonymous product events — names like &quot;evidence approved&quot; or
              &quot;résumé exported&quot; — through Vercel Analytics to understand which parts of the product help.
              Events carry no résumé text, no employer names, no job descriptions, no personal details, and no user
              identifier that links events to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-paper">Purchases</h2>
            <p className="mt-2">
              Checkout happens on Stripe. Stripe handles your payment details and email under{" "}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan underline hover:text-gold"
              >
                Stripe&apos;s privacy policy
              </a>
              ; we never see your card number. Your license key contains only the pack tier and an order reference —
              no name, no email, nothing about your career.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-paper">Deleting your data</h2>
            <p className="mt-2">
              You hold all of it, so deletion is direct:{" "}
              <Link href="/settings" className="text-cyan underline hover:text-gold">
                Settings → Clear local data
              </Link>{" "}
              removes every Career Forge record from your browser, or clear this site&apos;s storage in your browser
              settings. There is nothing server-side to request deletion of.
            </p>
          </section>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
