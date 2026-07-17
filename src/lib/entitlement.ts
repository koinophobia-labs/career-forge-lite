"use client";

// Client-side entitlement state: which package (if any) this browser has
// unlocked. The stored license key is re-verified cryptographically on every
// load — localStorage tampering yields "invalid", never a grant. Deliberately
// stored apart from career data: "Clear local data" wipes work, not a
// purchase.

import { useSyncExternalStore } from "react";
import { verifyLicenseKey } from "@/lib/license";
import { tierHasFeature, tierLaneLimit, type EntitledFeature, type PackageTier } from "@/lib/packages";

export const LICENSE_STORAGE_KEY = "career-forge-license-v1";

export type CommerceMode = "off" | "test" | "live";

export function getCommerceMode(): CommerceMode {
  const raw = process.env.NEXT_PUBLIC_COMMERCE_MODE;
  if (raw === "test" || raw === "live") return raw;
  return "off";
}

export type EntitlementState = {
  // "checking" only while an actual stored key awaits verification.
  status: "none" | "checking" | "valid" | "invalid";
  tier: PackageTier | null;
  licenseKey: string | null;
};

const NONE: EntitlementState = { status: "none", tier: null, licenseKey: null };

const listeners = new Set<() => void>();
let snapshot: EntitlementState | null = null;
const serverSnapshot = NONE;

function notify() {
  listeners.forEach((listener) => listener());
}

function beginVerification(key: string): void {
  void verifyLicenseKey(key).then((result) => {
    // Ignore stale verifications: the stored key may have changed meanwhile.
    if (snapshot?.licenseKey !== key) return;
    snapshot = result.ok
      ? { status: "valid", tier: result.payload.tier, licenseKey: key }
      : { status: "invalid", tier: null, licenseKey: key };
    notify();
  });
}

function getSnapshot(): EntitlementState {
  if (snapshot === null) {
    const stored = typeof window === "undefined" ? null : window.localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!stored) {
      snapshot = NONE;
    } else {
      snapshot = { status: "checking", tier: null, licenseKey: stored };
      beginVerification(stored);
    }
  }
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Stores the key and starts async verification; resolves with the outcome so
// unlock UI can show success/failure directly.
export async function activateLicenseKey(key: string): Promise<EntitlementState> {
  const trimmed = key.trim();
  const result = await verifyLicenseKey(trimmed);
  if (result.ok) {
    try {
      window.localStorage.setItem(LICENSE_STORAGE_KEY, trimmed);
    } catch {
      // Storage full: the license still works for this tab session.
    }
    snapshot = { status: "valid", tier: result.payload.tier, licenseKey: trimmed };
  } else {
    snapshot = { status: "invalid", tier: null, licenseKey: trimmed };
  }
  notify();
  return snapshot;
}

export function removeLicense(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(LICENSE_STORAGE_KEY);
  snapshot = NONE;
  notify();
}

export function useEntitlement() {
  const entitlement = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  const commerceMode = getCommerceMode();
  const commerceEnabled = commerceMode !== "off";

  // With commerce off (free beta / no payment configured), nothing is gated —
  // exactly the product as it ships today.
  function hasFeature(feature: EntitledFeature): boolean {
    if (!commerceEnabled) return true;
    return entitlement.status === "valid" && tierHasFeature(entitlement.tier, feature);
  }

  function laneLimit(): number {
    if (!commerceEnabled) return 3;
    return entitlement.status === "valid" ? tierLaneLimit(entitlement.tier) : 1;
  }

  return { entitlement, commerceMode, commerceEnabled, hasFeature, laneLimit };
}
