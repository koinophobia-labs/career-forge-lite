"use client";

import { useEffect } from "react";
import Link from "next/link";
import { trackCareerEvent } from "@/lib/analytics";
import { PACKAGES, PACKAGE_ORDER, type EntitledFeature } from "@/lib/packages";

// Shown in place of a paid action when commerce is enabled and this browser
// has no entitling license. Never renders a dead button — it explains what the
// action is, which pack includes it, and links to pricing.

function cheapestTierWith(feature: EntitledFeature) {
  return PACKAGE_ORDER.map((tier) => PACKAGES[tier]).find((pack) => pack.features.includes(feature)) ?? PACKAGES["career-switch"];
}

export function LockedFeaturePanel({
  feature,
  title,
  description
}: {
  feature: EntitledFeature;
  title: string;
  description: string;
}) {
  const pack = cheapestTierWith(feature);

  useEffect(() => {
    trackCareerEvent("locked_feature_viewed");
  }, []);

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-gold">Included in the {pack.name}</p>
      <h3 className="mt-2 text-lg font-bold text-paper">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-paper/70">{description}</p>
      <p className="mt-2 text-sm leading-6 text-paper/70">
        Everything you have built here stays yours and stays free to edit — the {pack.name} (${pack.priceUsd}, one
        time) unlocks this on any device.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/pricing" className="rounded-md bg-gold px-4 py-2 text-sm font-black text-ink transition hover:bg-cyan">
          See the {pack.name} →
        </Link>
        <Link
          href="/unlock"
          className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-paper/70 transition hover:border-cyan hover:text-cyan"
        >
          I already have a key
        </Link>
      </div>
    </div>
  );
}

// Compact inline replacement for a gated button row.
export function LockedActionPill({ feature, label }: { feature: EntitledFeature; label: string }) {
  const pack = cheapestTierWith(feature);
  return (
    <Link
      href="/pricing"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold transition hover:bg-gold hover:text-ink"
      title={`${label} is included in the ${pack.name} ($${pack.priceUsd} one-time).`}
    >
      <span aria-hidden="true">🔒</span>
      {label} · ${pack.priceUsd} pack
    </Link>
  );
}
