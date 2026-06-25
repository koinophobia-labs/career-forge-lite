"use client";

import Image from "next/image";

type LandingPageProps = {
  onStart: () => void;
};

const pathCards = [
  {
    eyebrow: "Free",
    title: "Guided Builder",
    body: "Answer simple prompts. Career Forge organizes your experience into a professional resume draft.",
    bestFor: ["quick resumes", "first-time users", "people who know their work history"],
    cta: "Build Resume"
  },
  {
    eyebrow: "Premium Preview",
    title: "Interview Mode",
    body: "Talk through your experience. Career Forge extracts proof while you answer naturally.",
    bestFor: ["resume-writing blockers", "career changers", "project-heavy backgrounds"],
    cta: "Try Interview Mode"
  }
];

const trustItems = [
  "No resume writing experience required",
  "Uses your real experience",
  "Doesn't invent achievements",
  "Built around recruiter-ready structure",
  "Supports projects and nontraditional careers",
  "Exports clean, single-column resume content"
];

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <section className="relative overflow-hidden border-b border-white/10" id="landing">
      <div className="absolute inset-0 opacity-28">
        <Image
          src="/career-forge-hero.png"
          alt=""
          priority
          fill
          sizes="100vw"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/94 to-obsidian/60" />

      <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-5 py-14 sm:px-8">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 text-xs font-bold uppercase tracking-[0.16em] text-paper/60">
          <span>Career Forge Lite</span>
          <span className="text-gold">Product Lab Module 05 - Live MVP</span>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <p className="trust-kicker mb-4 text-sm font-bold uppercase">
              Free builder + premium interview preview
            </p>
            <h1 className="text-4xl font-bold leading-[1.02] text-paper sm:text-6xl">
              Turn your experience into a <span className="text-cyan">recruiter-ready</span> resume.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-paper/75">
              Whether you prefer guided questions or a conversational interview, Career Forge helps you uncover your
              experience and transform it into professional resume content.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onStart}
                className="min-h-12 rounded-md bg-gold px-6 text-base font-bold text-ink shadow-soft transition hover:bg-cyan"
              >
                Build My Resume
              </button>
              <a
                href="/interview"
                className="inline-flex min-h-12 items-center rounded-md border border-cyan/25 bg-cyan/10 px-6 text-base font-bold text-cyan transition hover:border-gold hover:text-gold"
              >
                Try Interview Mode
                <span className="ml-3 rounded-sm border border-cyan/30 px-2 py-1 text-[0.65rem] uppercase tracking-[0.12em]">
                  Premium Preview
                </span>
              </a>
            </div>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-paper/58">
              No login. No fake ATS score. No invented achievements.
            </p>
          </div>

          <div className="trust-panel rounded-md p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <strong className="text-sm uppercase tracking-[0.16em] text-paper">sample://translation</strong>
              <span className="rounded-md bg-cyan/10 px-2 py-1 text-xs font-bold text-cyan">LIVE MVP</span>
            </div>
            <div className="space-y-4">
              <div className="trust-card rounded-md p-4">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-paper/50">Raw experience</span>
                <p className="mt-2 text-lg font-bold text-paper">helped customers</p>
              </div>
              <div className="trust-card rounded-md border-gold/30 bg-gold/10 p-4">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-gold">Resume language</span>
                <p className="mt-2 leading-7 text-paper">
                  Supported customer requests, documented issue status, and escalated complex cases to improve response consistency.
                </p>
              </div>
            </div>
            <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-paper/60">
              Built by Koinophobia Labs as a practical Product Lab utility for turning real work into clearer career documents.
            </p>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pb-14 sm:px-8" id="paths">
        <div className="mb-5 max-w-2xl">
          <p className="trust-kicker text-sm font-bold uppercase">Choose your path</p>
          <h2 className="mt-3 text-3xl font-bold text-paper">Two ways to build the same recruiter-ready package.</h2>
          <p className="mt-3 text-paper/68">
            Start with the free guided builder, or preview the conversational interview if writing from scratch feels hard.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {pathCards.map((path) => (
            <article key={path.title} className="trust-card rounded-md p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-gold">{path.eyebrow}</p>
              <h3 className="mt-3 text-2xl font-bold text-paper">{path.title}</h3>
              <p className="mt-3 text-sm leading-6 text-paper/70">{path.body}</p>
              <div className="mt-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-paper/45">Best for</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {path.bestFor.map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-paper/72">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              {path.title === "Guided Builder" ? (
                <button
                  type="button"
                  onClick={onStart}
                  className="mt-6 min-h-11 rounded-md bg-gold px-5 text-sm font-black text-ink transition hover:bg-cyan"
                >
                  {path.cta}
                </button>
              ) : (
                <a
                  href="/interview"
                  className="mt-6 inline-flex min-h-11 items-center rounded-md border border-cyan/30 bg-cyan/10 px-5 text-sm font-black text-cyan transition hover:border-gold hover:text-gold"
                >
                  {path.cta}
                </a>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pb-14 sm:px-8" id="trust">
        <div className="rounded-md border border-white/10 bg-white/5 p-5">
          <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <div>
              <p className="trust-kicker text-sm font-bold uppercase">Why Career Forge?</p>
              <h2 className="mt-3 text-3xl font-bold text-paper">Built for honest resume substance.</h2>
              <p className="mt-3 text-sm leading-6 text-paper/66">
                Career Forge is not a magic job machine. It helps you remember what you did, organize it clearly, and avoid generic filler.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {trustItems.map((item) => (
                <div key={item} className="rounded-md border border-white/10 bg-obsidian/35 p-3 text-sm font-semibold leading-6 text-paper/74">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
