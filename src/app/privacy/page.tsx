import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Privacy — Career Forge" };

export default function PrivacyPage() {
  return (
    <main>
      <CommandNav active="/privacy" />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Privacy</p>
        <h1 className="mt-3 text-3xl font-bold text-paper">The Career Forge app keeps your career data on your device.</h1>
        <p className="mt-2 text-sm text-paper/50">Last updated: July 18, 2026</p>
        <div className="mt-8 space-y-8 text-sm leading-7 text-paper/75">
          <section>
            <h2 className="text-lg font-bold text-paper">Local-first app data</h2>
            <p className="mt-2">Your work history, imported résumés, approved evidence, generated documents, applications, contacts, and interview practice live in your browser&apos;s local storage. There are no Career Forge accounts and no career-profile database. Imported résumé files are parsed in your browser and the raw files are not retained by the app. Koinophobia Labs cannot read this local career data.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Anonymous product events</h2>
            <p className="mt-2">Career Forge records content-free event names such as &quot;evidence approved&quot; or &quot;résumé exported&quot; through Vercel Analytics. Events contain no résumé text, employer names, job descriptions, personal details, or Career Forge account identifier.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Founding-user pilot summaries</h2>
            <p className="mt-2">Pilot summaries are never transmitted automatically. A participant must explicitly consent, generate the counts-and-timings JSON in Settings, review it, and send it manually. The summary contains no résumé content, name, employer, or contact information.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Optional $149 human service</h2>
            <p className="mt-2">The Career Forge Résumé Rebuild is separate from the local-first app. When you choose that service, you voluntarily email a résumé, Career Forge export, or other intake material to Koinophobia Labs so Blake Taylor can perform the work. Only Koinophobia Labs and the email/file providers used for delivery may access those files. Working files are deleted within 30 days after final delivery unless you request earlier deletion or longer retention in writing. Transaction records may be retained where required for accounting, fraud prevention, or legal compliance.</p>
            <p className="mt-2">Request early deletion or ask a service-data question at <a href="mailto:koinophobia999@gmail.com" className="text-cyan underline hover:text-gold">koinophobia999@gmail.com</a>.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Purchases</h2>
            <p className="mt-2">Checkout happens on Stripe. Stripe handles payment details and email under <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan underline hover:text-gold">Stripe&apos;s privacy policy</a>; Koinophobia Labs never sees your full card number. A Career Pack license contains the pack tier and an order reference, not your career data.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Deleting app data</h2>
            <p className="mt-2"><Link href="/settings" className="text-cyan underline hover:text-gold">Settings → Clear local data</Link> removes every Career Forge record from this browser. Clearing the site&apos;s browser storage does the same. Human-service files follow the separate deletion policy above.</p>
          </section>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
