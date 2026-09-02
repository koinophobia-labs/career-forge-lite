import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "Support — Way In",
  description: "Get help with Way In, purchases, privacy, backups, and account deletion.",
};

const supportEmail = "koinophobia999@gmail.com";

export default function SupportPage() {
  return (
    <main>
      <CommandNav active="/support" />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Support</p>
        <h1 className="mt-3 text-3xl font-bold text-paper">Help with Way In</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-paper/75">
          Way In works without an account and keeps career documents on your device by default. If something is not
          working, email us with the app version, build number, device model, iOS version, and the step that failed.
        </p>

        <a
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-cyan px-5 py-3 text-sm font-black text-ink transition hover:bg-cyan/85"
          href={`mailto:${supportEmail}?subject=${encodeURIComponent("Way In support request")}`}
        >
          Email Way In support
        </a>
        <p className="mt-3 text-sm text-paper/64">
          {supportEmail}. Do not send passwords, full payment-card details, or private career documents unless support
          specifically asks for a limited example.
        </p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-paper/75">
          <section>
            <h2 className="text-lg font-bold text-paper">Purchases and restore</h2>
            <p className="mt-2">
              Open Profile → Settings &amp; Privacy → Restore Purchases. Include the App Store receipt reference in a
              support email if access is still missing; never send full card details.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Backups and local data</h2>
            <p className="mt-2">
              Use Settings &amp; Privacy in the iPhone app to create or restore a local backup. Exported copies are
              readable files, so store them somewhere you trust. Koinophobia Labs cannot recover an on-device
              workspace that was deleted without a backup.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Privacy and account deletion</h2>
            <p className="mt-2">
              The app&apos;s deletion controls are in Profile → Settings &amp; Privacy. See the{" "}
              <Link href="/privacy" className="text-cyan underline hover:text-gold">
                privacy policy
              </Link>{" "}
              for the exact data boundaries, or email support for account-deletion help.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Accessibility</h2>
            <p className="mt-2">
              Tell us which accessibility feature you use, what you expected, and what happened. Please omit private
              résumé, employer, interview, or contact information from the report.
            </p>
          </section>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
