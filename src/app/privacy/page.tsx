import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Privacy — Way In" };

export default function PrivacyPage() {
  return (
    <main>
      <CommandNav active="/privacy" />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Privacy</p>
        <h1 className="mt-3 text-3xl font-bold text-paper">The Way In app keeps your career data on your device.</h1>
        <p className="mt-2 text-sm text-paper/50">Last updated: September 2, 2026</p>
        <aside className="mt-6 rounded-2xl border border-cyan/40 bg-cyan/5 p-5" aria-label="Native app information">
          <h2 className="text-lg font-bold text-paper">Way In on iPhone or iPad</h2>
          <p className="mt-2 text-sm leading-7 text-paper/80">Read the current native-app privacy policy, including local storage, optional iCloud, Apple purchases, diagnostics, and deletion. The information below also covers the separate legacy web service and older features.</p>
          <a href="https://koinophobialabs.com/way-in/privacy" className="mt-3 inline-flex min-h-11 items-center font-bold text-cyan underline">Read the iPhone and iPad privacy policy →</a>
        </aside>
        <div className="mt-8 space-y-8 text-sm leading-7 text-paper/75">
          <section>
            <h2 className="text-lg font-bold text-paper">Local-first app data</h2>
            <p className="mt-2">Your work history, imported résumés, approved evidence, generated documents, applications, contacts, stories, and interview practice live in your browser&apos;s local storage or the iPhone app&apos;s on-device storage. Imported résumé files are parsed on the device and the raw files are not retained by Way In after import. The default app does not upload this career-document content to Koinophobia Labs.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Optional iPhone account</h2>
            <p className="mt-2">The iPhone app works without an account. If you choose Sign in with Apple, Way In receives Apple&apos;s account identifier and may receive your name the first time you authorize the app. Those details are used for account functionality, eligible past-purchase access, support, and account deletion—not advertising or tracking. Career résumé, job, story, and interview text remains on-device in the default configuration.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Anonymous product events</h2>
            <p className="mt-2">The web app records content-free event names such as &quot;evidence approved&quot; or &quot;résumé exported&quot; through Vercel Analytics. Events contain no résumé text, employer names, job descriptions, personal details, or Way In account identifier. The iPhone app&apos;s default diagnostics write typed event names to Apple unified logging on the device and do not transmit career-document content.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Optional product proof program</h2>
            <p className="mt-2">The iPhone app&apos;s product proof program is off by default. If you explicitly join, Way In begins a separate local record containing a random participant code, closed milestone names and dates, active days, and aggregate application outcomes from that moment forward. It does not backfill earlier activity or include your name, account identifier, résumé, job description, company, role, contact, note, transcript, feedback, or other career text.</p>
            <p className="mt-2">The record is not uploaded automatically. You may generate an aggregate JSON report and choose whether to share it, or stop the program and delete its local record and temporary report. Deleting local career data also deletes the local proof record. Copies you already exported are outside Way In&apos;s control.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Separate optional human service</h2>
            <p className="mt-2">The Way In Résumé Rebuild is separate from the local-first app. An availability inquiry does not require résumé files. After scope is confirmed, you may voluntarily email a résumé, Way In export, or other intake material to Koinophobia Labs so Blake Taylor can perform the work. Only Koinophobia Labs and the email/file providers used for delivery may access those files. Working files are deleted within 30 days after final delivery unless you request earlier deletion or longer retention in writing. Transaction records may be retained where required for accounting, fraud prevention, or legal compliance.</p>
            <p className="mt-2">Request early deletion or ask a service-data question at <a href="mailto:koinophobia999@gmail.com" className="text-cyan underline hover:text-gold">koinophobia999@gmail.com</a>.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Purchases</h2>
            <p className="mt-2">Stripe handles payment details and checkout email under <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan underline hover:text-gold">Stripe&apos;s privacy policy</a>; Koinophobia Labs never sees your full card number. Way In self-service web entitlements contain only the package tier, purchase time, an opaque order reference, and an expiration time when applicable—not résumé text or other career data. The separate human service uses a payment link only after availability and scope are confirmed.</p>
            <p className="mt-2">New digital purchases in the iPhone app are handled by Apple through the App Store. Way In verifies App Store-signed transactions to grant access and may reconcile transaction identifiers with its entitlement service when that service is enabled. Apple&apos;s privacy practices govern App Store payment processing.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Deleting app data and accounts</h2>
            <p className="mt-2"><Link href="/settings" className="text-cyan underline hover:text-gold">Web Settings → Clear local data</Link> removes Way In records from that browser. In the iPhone app, Profile → Settings &amp; Privacy → Delete account and local career data deletes the optional server account first, when configured, and then erases the on-device career workspace. If a server deletion cannot complete, local career data is left intact so the failure is visible and recoverable. Human-service files follow the separate deletion policy above.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Questions and requests</h2>
            <p className="mt-2">For privacy questions, account deletion help, or access requests, email <a href="mailto:koinophobia999@gmail.com" className="text-cyan underline hover:text-gold">koinophobia999@gmail.com</a>. Do not email passwords, private employer data, or full financial account information.</p>
          </section>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
