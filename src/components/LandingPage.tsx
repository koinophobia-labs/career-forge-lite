"use client";

import Image from "next/image";
import { trackCtaClick } from "@/lib/analytics";

type LandingPageProps = {
  onStart: () => void;
};

const pathCards = [
  {
    eyebrow: "Free",
    title: "Guided Builder",
    body: "Answer focused prompts for your target role, work history, projects, skills, and proof. Best first stop for most visitors.",
    bestFor: ["retail and service workers", "warehouse or logistics workers", "recent graduates"],
    cta: "Build Resume"
  },
  {
    eyebrow: "Beta",
    title: "Tell My Story",
    body: "Paste or write your work story in plain language. Career Forge extracts a structured dossier before generating resume content.",
    bestFor: ["gig workers and career switchers", "messy work history", "self-taught builders or founders"],
    cta: "Tell My Story"
  }
];

const trustItems = [
  "No resume writing experience required",
  "Uses your real experience",
  "Doesn't invent achievements",
  "Built around recruiter-ready structure",
  "Supports gig, service, retail, warehouse, and project-based paths",
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
      <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/94 to-obsidian/66" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:56px_56px] opacity-35" />

      <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-5 py-14 sm:px-8">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 text-xs font-bold uppercase tracking-[0.16em] text-paper/60">
          <span>Career Forge Lite</span>
          <span className="text-gold">Product Lab Module 05 - Live MVP</span>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <p className="trust-kicker mb-4 text-sm font-bold uppercase">
              Free resume builder for real experience
            </p>
            <h1 className="text-4xl font-bold leading-[1.02] text-paper sm:text-6xl">
              Turn your experience into a <span className="text-cyan">recruiter-ready</span> resume.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-paper/75">
              Career Forge helps career switchers, gig workers, service workers, retail workers, warehouse/logistics workers,
              recent grads, and self-taught builders turn plain work history into editable resume bullets, a LinkedIn headline,
              and an ATS-safe draft without inventing achievements.
            </p>
            <div className="mt-5 flex flex-wrap gap-2" aria-label="Career Forge is built for">
              {["Gig workers", "Retail & service", "Warehouse/logistics", "Recent grads", "Self-taught builders"].map((item) => (
                <span key={item} className="rounded-full border border-white/12 bg-white/5 px-3 py-2 text-xs font-bold text-paper/68">
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  trackCtaClick("hero_build_resume", "#demo");
                  onStart();
                }}
                className="lab-pill-button min-h-12 px-6 text-base font-bold shadow-soft transition"
              >
                Build My Resume
              </button>
              <a
                href="/story"
                onClick={() => trackCtaClick("hero_tell_my_story", "/story")}
                className="lab-secondary-button inline-flex min-h-12 items-center px-6 text-base font-bold transition"
              >
                Tell My Story
                <span className="ml-3 rounded-sm border border-cyan/30 px-2 py-1 text-[0.65rem] uppercase tracking-[0.12em]">
                  Beta
                </span>
              </a>
            </div>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-paper/58">
              No login. No fake ATS score. No invented achievements.
            </p>
          </div>

          <div className="trust-panel p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <strong className="text-sm uppercase tracking-[0.16em] text-paper">sample://translation</strong>
              <span className="rounded-full bg-cyan/10 px-2 py-1 text-xs font-bold text-cyan">LIVE MVP</span>
            </div>
            <div className="space-y-4">
              <div className="trust-card p-4">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-paper/50">Raw experience</span>
                <p className="mt-2 text-lg font-bold text-paper">helped customers</p>
              </div>
              <div className="trust-card border-gold/30 bg-gold/10 p-4">
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
            Start with the guided builder if you want structure. Use Tell My Story if you already have a rough work history to paste in.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {pathCards.map((path) => (
            <article key={path.title} className="trust-card p-5">
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
                  onClick={() => {
                    trackCtaClick("path_build_resume", "#demo");
                    onStart();
                  }}
                  className="lab-pill-button mt-6 min-h-11 px-5 text-sm font-black transition"
                >
                  {path.cta}
                </button>
              ) : (
                <a
                  href="/story"
                  onClick={() => trackCtaClick("path_tell_my_story", "/story")}
                  className="lab-secondary-button mt-6 inline-flex min-h-11 items-center px-5 text-sm font-black transition"
                >
                  {path.cta}
                </a>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pb-14 sm:px-8" id="system">
        <div className="rounded-md border border-gold/25 bg-gold/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-gold">The bigger system</p>
              <h2 className="mt-2 text-2xl font-bold text-paper">
                The builder is one station. Career Forge is a job-search campaign system.
              </h2>
              <p className="mt-2 text-sm leading-6 text-paper/70">
                Paste any job post and get the resume angle that fits it, a Match Brief, a ready outreach message,
                tracked follow-ups, and interview prep built from the same analysis — all local, no login. The full
                command center is in paid beta.
              </p>
            </div>
            <a
              href="/beta"
              onClick={() => trackCtaClick("landing_beta_offer", "/beta")}
              className="lab-pill-button inline-flex min-h-11 items-center px-5 text-sm font-black transition"
            >
              See the paid beta
            </a>
          </div>
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
