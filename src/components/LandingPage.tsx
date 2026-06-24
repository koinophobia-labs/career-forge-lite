import Image from "next/image";

type LandingPageProps = {
  onStart: () => void;
};

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <section className="relative min-h-[92vh] overflow-hidden border-b border-ink/10" id="landing">
      <Image
        src="/career-forge-hero.png"
        alt=""
        priority
        fill
        sizes="100vw"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/88 to-paper/20" />
      <div className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col justify-center px-5 py-12 sm:px-8">
        <div className="max-w-2xl">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-spruce">
            Career Forge Lite
          </p>
          <h1 className="text-5xl font-bold leading-[1.02] text-ink sm:text-6xl">
            Turn everyday experience into a polished resume and LinkedIn headline in minutes.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-ink/76">
            A lightweight career tool for early-career tech, business, operations,
            customer success, admin, sales, project coordination, and IT support candidates.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onStart}
              className="min-h-12 rounded-md bg-spruce px-6 text-base font-bold text-white shadow-soft transition hover:bg-ink"
            >
              Build Resume Package
            </button>
            <a
              href="#demo"
              className="inline-flex min-h-12 items-center rounded-md border border-ink/15 bg-white/85 px-6 text-base font-bold text-ink transition hover:border-spruce hover:text-spruce"
            >
              View Workflow
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
