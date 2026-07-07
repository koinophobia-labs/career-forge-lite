"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";
import { useCommandCenter } from "@/lib/use-command-center";
import { computeWeeklyReview, type TrendDirection } from "@/lib/weekly-review";

const trendDisplay: Record<TrendDirection, { symbol: string; className: string; title: string }> = {
  up: { symbol: "▲", className: "text-mint", title: "More than the previous 7 days" },
  down: { symbol: "▼", className: "text-coral", title: "Less than the previous 7 days" },
  same: { symbol: "＝", className: "text-paper/50", title: "Same as the previous 7 days" },
  none: { symbol: "—", className: "text-paper/35", title: "No activity in either week yet" }
};

export default function WeeklyPage() {
  const { state, hydrated } = useCommandCenter();
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const review = useMemo(() => computeWeeklyReview(state, nowIso), [state, nowIso]);

  return (
    <main>
      <CommandNav active="/weekly" />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Rhythm</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">This week&rsquo;s momentum</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          What moved in the last 7 days, what stalled, and the three moves that keep the search alive. Everything here
          is computed from your real activity — nothing is estimated.
        </p>

        {hydrated && !review.hasAnyData && (
          <div className="mt-8 rounded-xl border border-cyan/25 bg-cyan/10 p-5 text-sm leading-6 text-paper/72">
            <p>
              Nothing to review yet — the weekly rhythm starts once there&rsquo;s a search to run. Set up your profile
              and first lanes; this page becomes useful the same week.
            </p>
            <Link href="/profile" className="mt-3 inline-block rounded-md bg-cyan px-4 py-2 text-sm font-black text-ink transition hover:bg-gold">
              Start with your profile
            </Link>
          </div>
        )}

        {hydrated && review.hasAnyData && !review.hasApplications && (
          <div className="mt-8 rounded-xl border border-gold/30 bg-gold/10 p-5 text-sm leading-6 text-paper/75">
            Your setup is in place but no applications are tracked yet — the metrics below stay at zero until the first
            one goes out.{" "}
            <Link href="/tailor" className="font-bold text-gold underline-offset-2 hover:underline">
              Paste a job post and send the first application.
            </Link>
          </div>
        )}

        {hydrated && review.hasAnyData && (
          <>
            {review.hasApplications && review.totalThisWeek === 0 && (
              <div className="mt-8 rounded-xl border border-coral/30 bg-coral/10 p-5 text-sm leading-6 text-paper/75">
                Quiet week — no tracked activity in the last 7 days. That happens; the fix is small. The three moves
                below restart the rhythm without requiring a big push.
              </div>
            )}

            <div className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-xl font-bold text-paper">Last 7 days vs. the 7 before</h2>
                <span className="lab-mono text-xs text-paper/45">— means no activity recorded in either week</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {review.metrics.map((item) => {
                  const trend = trendDisplay[item.trend];
                  return (
                    <div key={item.key} className="trust-card p-4">
                      <span className="lab-mono block text-[0.68rem] font-bold uppercase text-paper/55">{item.label}</span>
                      <span className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-paper">{item.thisWeek}</span>
                        <span className={`text-sm font-bold ${trend.className}`} title={trend.title}>
                          {trend.symbol}
                        </span>
                        {item.trend !== "none" && (
                          <span className="lab-mono text-[0.68rem] text-paper/45">prev: {item.lastWeek}</span>
                        )}
                      </span>
                      <span className="mt-1 block text-[0.72rem] text-paper/50">{item.detail}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-xl font-bold text-paper">This week&rsquo;s three moves</h2>
              <p className="mt-1 text-sm text-paper/60">One application move, one people move, one prep move. Do these and the week counts.</p>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {review.moves.map((move, index) => (
                  <div key={move.title} className="trust-panel flex flex-col p-5">
                    <span className="lab-mono text-xs font-bold text-gold">Move {index + 1}</span>
                    <h3 className="mt-2 text-base font-bold text-paper">{move.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-paper/68">{move.detail}</p>
                    <Link href={move.href} className="lab-pill-button mt-4 self-start px-4 py-2 text-sm font-black transition">
                      {move.actionLabel}
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {review.stalled.length > 0 && (
              <div className="mt-10">
                <h2 className="text-xl font-bold text-paper">Stalled pipeline</h2>
                <p className="mt-1 text-sm text-paper/60">Things sitting still that shouldn&rsquo;t be.</p>
                <div className="mt-4 grid gap-2.5">
                  {review.stalled.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/25 bg-gold/5 px-4 py-3 transition hover:border-gold/60"
                    >
                      <span>
                        <span className="block text-sm font-bold text-paper">{item.label}</span>
                        <span className="mt-0.5 block text-[0.78rem] leading-5 text-paper/60">{item.detail}</span>
                      </span>
                      <span className="lab-mono text-xs font-bold text-gold">Fix →</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {review.stalled.length === 0 && review.totalThisWeek > 0 && (
              <div className="mt-10 rounded-xl border border-spruce/40 bg-mint/10 p-4 text-sm leading-6 text-mint">
                Nothing stalled. Pipeline is moving — protect the streak with the three moves above.
              </div>
            )}
          </>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
