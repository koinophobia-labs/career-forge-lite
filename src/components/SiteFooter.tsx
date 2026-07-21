import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 px-5 py-10 text-sm text-paper/64 sm:px-8" id="ecosystem">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.1fr_1fr_1fr]">
        <div>
          <div className="inline-flex items-center gap-3">
            <span className="logo-mark" aria-hidden="true">
              CF
            </span>
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.18em] text-gold">Career Forge</span>
              <span className="block text-[0.7rem] font-bold uppercase tracking-[0.2em] text-paper/50">
                by Koinophobia Labs
              </span>
            </span>
          </div>
          <p className="mt-4 max-w-sm leading-6">
            Built by Koinophobia Labs to turn reviewed career evidence into reusable draft materials. Career Forge stays
            local, editable, and review-first; every generated document still needs a human check before use.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold">
            <a
              href="https://koinophobialabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-coral transition hover:text-coral/80"
            >
              Built by Koinophobia Labs ↗
            </a>
            <a
              href="https://koinophobia.dev/connect"
              target="_blank"
              rel="noopener noreferrer"
              className="text-paper/70 transition hover:text-cyan"
            >
              Meet the founder ↗
            </a>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.16em] text-paper">Product</h2>
          <div className="mt-4 grid gap-2.5">
            <Link href="/pricing" className="inline-flex min-h-6 items-center py-1 text-paper/70 transition hover:text-cyan">
              Beta access &amp; future packaging
            </Link>
            <Link href="/unlock" className="inline-flex min-h-6 items-center py-1 text-paper/70 transition hover:text-cyan">
              Manage an access code
            </Link>
            <Link href="/settings" className="inline-flex min-h-6 items-center py-1 text-paper/70 transition hover:text-cyan">
              Backup &amp; restore
            </Link>
            <Link href="/terms" className="inline-flex min-h-6 items-center py-1 text-paper/70 transition hover:text-cyan">
              Terms of use
            </Link>
            <Link href="/privacy" className="inline-flex min-h-6 items-center py-1 text-paper/70 transition hover:text-cyan">
              Privacy
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.16em] text-paper">Current beta boundaries</h2>
          <div className="mt-4 grid gap-2 text-paper/66">
            <span>No account or login required</span>
            <span>Career data stays on your device</span>
            <span>No fake ATS score</span>
            <span>Imported facts remain reviewable</span>
            <span>Review every draft and export before use</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
