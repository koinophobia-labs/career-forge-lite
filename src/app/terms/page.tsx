import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Terms of Use — Career Forge" };

export default function TermsPage() {
  return (
    <main>
      <CommandNav active="/terms" />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Terms of Use</p>
        <h1 className="mt-3 text-3xl font-bold text-paper">Plain terms for Career Forge</h1>
        <p className="mt-2 text-sm text-paper/50">Last updated: July 18, 2026</p>
        <div className="mt-8 space-y-8 text-sm leading-7 text-paper/75">
          <section><h2 className="text-lg font-bold text-paper">What Career Forge is</h2><p className="mt-2">Career Forge, by Koinophobia Labs, helps you organize real work history into résumés, positioning, outreach, application records, and interview preparation. It is a writing and organization tool, not a recruiter, employer, legal adviser, or guarantee of a hiring outcome.</p></section>
          <section><h2 className="text-lg font-bold text-paper">Career Pack purchases and licenses</h2><p className="mt-2">Paid Career Packs are one-time purchases, not subscriptions. A purchase issues a personal license key that unlocks the stated pack features in a browser where you enter it. Do not publish, transfer, or resell a key. Payments are processed by Stripe. The exact tier scope shown at checkout controls the purchase.</p><p className="mt-2">If payment succeeds but the key is not delivered or does not activate, contact <a href="mailto:koinophobia999@gmail.com" className="text-cyan underline hover:text-gold">koinophobia999@gmail.com</a> with the Stripe receipt reference.</p></section>
          <section><h2 className="text-lg font-bold text-paper">Your content and responsibility</h2><p className="mt-2">Everything you enter remains yours. Career Forge is designed to build generated fields from approved evidence and clearly mark user-authored edits, but you remain responsible for reviewing every claim, date, heading, company, link, and layout before submitting material to an employer. No product can guarantee that every applicant-tracking system will parse a file identically.</p></section>
          <section><h2 className="text-lg font-bold text-paper">Local data and backups</h2><p className="mt-2">Career data lives in your browser&apos;s local storage. Koinophobia Labs cannot recover local data after you clear it or lose the device. Use the backup tools in <Link href="/settings" className="text-cyan underline hover:text-gold">Settings</Link>. See <Link href="/privacy" className="text-cyan underline hover:text-gold">Privacy</Link> for the separate rules that apply when you voluntarily use the human service.</p></section>
          <section>
            <h2 className="text-lg font-bold text-paper">$149 Career Forge Résumé Rebuild</h2>
            <p className="mt-2">The human service includes a diagnostic, one rebuilt résumé in PDF and DOCX, one LinkedIn headline, three target-role directions, a Loom walkthrough, and one focused revision requested within 14 days. Delivery is targeted within 48 hours after payment and complete intake. The service begins only after the scope is confirmed in writing.</p>
            <p className="mt-2">Cancel before work begins for a full refund. Once the human review or rebuild has begun, the fee is non-refundable except when Koinophobia Labs cannot deliver the agreed scope. Requests beyond the listed deliverables or included revision require a separate quote. Sending files for this service authorizes Koinophobia Labs to access them only for intake, delivery, revision, support, and the retention period described on the privacy page.</p>
          </section>
          <section><h2 className="text-lg font-bold text-paper">Warranty and liability</h2><p className="mt-2">Career Forge is provided as-is during beta. To the maximum extent the law allows, Koinophobia Labs is not liable for indirect damages, missed opportunities, employer decisions, or third-party outages. Total liability is limited to the amount paid for the affected product or service.</p></section>
          <section><h2 className="text-lg font-bold text-paper">Changes</h2><p className="mt-2">Material changes update the date above. A purchase remains governed by the tier scope and service terms presented when the order was placed.</p></section>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
