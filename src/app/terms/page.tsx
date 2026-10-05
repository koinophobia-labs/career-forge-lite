import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Terms of Use — Way In" };

export default function TermsPage() {
  return (
    <main>
      <CommandNav active="/terms" />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Terms of Use</p>
        <h1 className="mt-3 text-3xl font-bold text-paper">Plain terms for Way In</h1>
        <p className="mt-2 text-sm text-paper/50">Last updated: September 2, 2026</p>
        <aside className="mt-6 rounded-2xl border border-cyan/40 bg-cyan/5 p-5" aria-label="Native app information">
          <h2 className="text-lg font-bold text-paper">Way In on iPhone or iPad</h2>
          <p className="mt-2 text-sm leading-7 text-paper/80">Read the current native-app purchase and use information for Resume Toolkit and the 30-Day Career Pass. Neither purchase auto-renews. The information below also covers the separate legacy web service and older features.</p>
          <a href="https://koinophobialabs.com/way-in/terms" className="mt-3 inline-flex min-h-11 items-center font-bold text-cyan underline">See iPhone and iPad purchase information →</a>
        </aside>
        <div className="mt-8 space-y-8 text-sm leading-7 text-paper/75">
          <section><h2 className="text-lg font-bold text-paper">What Way In is</h2><p className="mt-2">Way In, by Koinophobia Labs, helps you organize real work history into résumés, positioning, outreach, application records, and interview preparation. It is a writing and organization tool, not a recruiter, employer, legal adviser, or guarantee of a hiring outcome.</p></section>
          <section><h2 className="text-lg font-bold text-paper">Free access and self-service packs</h2><p className="mt-2">Free web access includes local career-history entry or import, evidence review, one active role direction, editable draft previews, job analysis, application tracking, and a limited interview preview. Paid web packs unlock the specific exports, workflows, and role-direction limits shown at checkout: $9 Resume Pack, $15 Job Pack, $25 Career Pack, or $39 30-Day All Access.</p><p className="mt-2">Web Resume, Job, and Career Packs are one-time purchases with no automatic renewal. Web 30-Day All Access is also a one-time purchase and expires 30 days after Stripe records the purchase; it does not renew automatically. Previously downloaded files and local career data remain yours after access expires.</p><p className="mt-2">New digital access in the iPhone app is purchased only through Apple&apos;s In-App Purchase system. The Resume Toolkit is a non-consumable purchase. The 30-Day Career Pass is a non-renewing, time-limited purchase that expires 30 days after purchase and does not renew automatically. The product name, price, duration, and included features shown by the App Store purchase screen control the iPhone purchase.</p><p className="mt-2">Past web purchases use a separate access system and do not automatically unlock the current iPhone app. Contact support with a receipt reference for help. The iPhone app does not accept license keys as a new purchase or alternate unlock method. If payment succeeds but access is missing, use Restore Purchases in the iPhone app or contact <a href="mailto:koinophobia999@gmail.com" className="text-cyan underline hover:text-gold">koinophobia999@gmail.com</a> with the applicable App Store or Stripe receipt reference.</p></section>
          <section><h2 className="text-lg font-bold text-paper">Your content and responsibility</h2><p className="mt-2">Everything you enter remains yours. Way In is designed to build generated fields from approved evidence and clearly mark user-authored edits, but you remain responsible for reviewing every claim, date, heading, company, link, and layout before submitting material to an employer. No product can guarantee that every applicant-tracking system will parse a file identically.</p></section>
          <section><h2 className="text-lg font-bold text-paper">Local data, optional accounts, and backups</h2><p className="mt-2">Career data lives in the web browser&apos;s local storage or in the iPhone app&apos;s on-device store. An optional Sign in with Apple account does not automatically move career-document content to a server. Koinophobia Labs cannot recover local career data after you clear it or lose the device unless a separately described sync service is enabled. Use the backup tools in <Link href="/settings" className="text-cyan underline hover:text-gold">web Settings</Link> or the iPhone app&apos;s Settings &amp; Privacy screen. See <Link href="/privacy" className="text-cyan underline hover:text-gold">Privacy</Link> for account deletion and the separate rules that apply when you voluntarily use the human service.</p></section>
          <section>
            <h2 className="text-lg font-bold text-paper">Separate optional human résumé service</h2>
            <p className="mt-2">The human service includes a diagnostic, one rebuilt résumé in PDF and DOCX, one LinkedIn headline, three target-role directions, a Loom walkthrough, and one focused revision requested within 14 days. Delivery is targeted within 5 business days after payment and complete intake. The service begins only after availability, scope, and the delivery date are confirmed in writing.</p>
            <p className="mt-2">Founding capacity is one active paid rebuild at a time. If the slot is occupied, you may join a no-payment waitlist. Koinophobia Labs will not send a payment link until a start date is available.</p>
            <p className="mt-2">Cancel before work begins for a full refund. Once the human review or rebuild has begun, the fee is non-refundable except when Koinophobia Labs cannot deliver the agreed scope. Requests beyond the listed deliverables or included revision require a separate quote. Sending files for this service authorizes Koinophobia Labs to access them only for intake, delivery, revision, support, and the retention period described on the privacy page.</p>
          </section>
          <section><h2 className="text-lg font-bold text-paper">Warranty and liability</h2><p className="mt-2">Way In is provided as-is. To the maximum extent the law allows, Koinophobia Labs is not liable for indirect damages, missed opportunities, employer decisions, or third-party outages. Total liability is limited to the amount paid for the affected product or service.</p></section>
          <section><h2 className="text-lg font-bold text-paper">Changes</h2><p className="mt-2">Material changes update the date above. A purchase remains governed by the tier scope and service terms presented when the order was placed.</p></section>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
