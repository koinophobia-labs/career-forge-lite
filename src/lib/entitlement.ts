"use client";

// The browser stores server-signed entitlements, never a trusted "paid" flag.
// Multiple purchases coexist so activating a Job Pack cannot erase an earlier
// Resume Pack, and an expired All Access grant falls back to any permanent
// package that is still owned.

import { useSyncExternalStore } from "react";
import { entitlementIdentity, verifyLicenseKey } from "@/lib/license";
import {
  highestPackageTier,
  tierHasFeature,
  tierLaneLimit,
  type EntitledFeature,
  type PackageTier
} from "@/lib/packages";

export const LICENSE_STORAGE_KEY = "career-forge-entitlements-v2";
export const LEGACY_LICENSE_STORAGE_KEY = "career-forge-license-v1";

export type CommerceMode = "off" | "test" | "live";

export function getCommerceMode(): CommerceMode {
  const raw = process.env.NEXT_PUBLIC_COMMERCE_MODE;
  if (raw === "test" || raw === "live") return raw;
  return "off";
}

export type ActiveEntitlement = {
  tier: PackageTier;
  signedEntitlement: string;
  issuedAt: number;
  expiresAt: number | null;
};

export type EntitlementState = {
  status: "none" | "checking" | "valid" | "invalid" | "expired";
  tier: PackageTier | null;
  signedEntitlement: string | null;
  activeEntitlements: ActiveEntitlement[];
  expiredEntitlements: ActiveEntitlement[];
};

export type EntitlementActivation = {
  status: "valid" | "invalid" | "expired";
  tier: PackageTier | null;
  expiresAt: number | null;
};

const NONE: EntitlementState = {
  status: "none",
  tier: null,
  signedEntitlement: null,
  activeEntitlements: [],
  expiredEntitlements: []
};

const listeners = new Set<() => void>();
let snapshot: EntitlementState | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
let verificationGeneration = 0;
const serverSnapshot = NONE;

function notify() {
  listeners.forEach((listener) => listener());
}

function storedKeys(): string[] {
  if (typeof window === "undefined") return [];
  const keys: string[] = [];
  const current = window.localStorage.getItem(LICENSE_STORAGE_KEY);
  if (current) {
    try {
      const parsed = JSON.parse(current) as unknown;
      if (Array.isArray(parsed)) {
        for (const value of parsed) if (typeof value === "string" && value.trim()) keys.push(value.trim());
      } else if (typeof parsed === "string" && parsed.trim()) {
        keys.push(parsed.trim());
      }
    } catch {
      if (current.trim().startsWith("CF1.")) keys.push(current.trim());
    }
  }
  const legacy = window.localStorage.getItem(LEGACY_LICENSE_STORAGE_KEY)?.trim();
  if (legacy) keys.push(legacy);
  return [...new Set(keys)];
}

function persistKeys(keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify([...new Set(keys)]));
    window.localStorage.removeItem(LEGACY_LICENSE_STORAGE_KEY);
  } catch {
    // A verified entitlement still works in this tab if storage is full.
  }
}

function grantFrom(payload: { tier: PackageTier; iat: number; exp?: number }, signedEntitlement: string): ActiveEntitlement {
  return {
    tier: payload.tier,
    signedEntitlement,
    issuedAt: payload.iat,
    expiresAt: payload.exp ?? null
  };
}

function scheduleExpiryRefresh(entitlements: ActiveEntitlement[]): void {
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = null;
  const expirations = entitlements
    .map((entitlement) => entitlement.expiresAt)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (!expirations.length || typeof window === "undefined") return;

  const delayMs = Math.max(1_000, expirations[0] * 1_000 - Date.now() + 250);
  expiryTimer = setTimeout(() => {
    beginVerification(storedKeys());
  }, Math.min(delayMs, 2_147_000_000));
}

/** Pure wallet evaluation used by the browser and regression coverage. */
export async function resolveEntitlementKeys(
  keys: string[],
  publicKeyB64?: string | null,
  nowUnixSeconds?: number
): Promise<EntitlementState> {
  if (!keys.length) return NONE;
  const results = await Promise.all(
    keys.map(async (key) => ({
      key,
      verification: await verifyLicenseKey(key, publicKeyB64, nowUnixSeconds)
    }))
  );
  const activeByIdentity = new Map<string, ActiveEntitlement>();
  const expiredByIdentity = new Map<string, ActiveEntitlement>();
  let invalidCount = 0;

  for (const { key, verification } of results) {
    if (verification.ok) {
      activeByIdentity.set(entitlementIdentity(verification.payload), grantFrom(verification.payload, key));
      continue;
    }
    if (verification.reason === "expired" && verification.payload) {
      expiredByIdentity.set(entitlementIdentity(verification.payload), grantFrom(verification.payload, key));
      continue;
    }
    invalidCount += 1;
  }

  const activeEntitlements = [...activeByIdentity.values()];
  const expiredEntitlements = [...expiredByIdentity.values()];
  const tier = highestPackageTier(activeEntitlements.map((entry) => entry.tier));
  const primary = tier
    ? activeEntitlements.find((entry) => entry.tier === tier) ?? null
    : null;

  if (activeEntitlements.length) {
    return {
      status: "valid",
      tier,
      signedEntitlement: primary?.signedEntitlement ?? null,
      activeEntitlements,
      expiredEntitlements
    };
  }
  if (expiredEntitlements.length) {
    return {
      status: "expired",
      tier: null,
      signedEntitlement: null,
      activeEntitlements: [],
      expiredEntitlements
    };
  }
  return invalidCount ? { ...NONE, status: "invalid" } : NONE;
}

function beginVerification(keys: string[]): void {
  const generation = ++verificationGeneration;
  void resolveEntitlementKeys(keys).then((next) => {
    if (generation !== verificationGeneration) return;
    snapshot = next;
    if (keys.length) persistKeys(keys);
    scheduleExpiryRefresh(next.activeEntitlements);
    notify();
  });
}

function getSnapshot(): EntitlementState {
  if (snapshot === null) {
    const keys = storedKeys();
    if (!keys.length) {
      snapshot = NONE;
    } else {
      snapshot = { ...NONE, status: "checking" };
      beginVerification(keys);
    }
  }
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function activateSignedEntitlement(key: string): Promise<EntitlementActivation> {
  const trimmed = key.trim();
  const result = await verifyLicenseKey(trimmed);
  if (!result.ok) {
    if (result.reason === "expired" && result.payload) {
      const keys = [...storedKeys(), trimmed];
      persistKeys(keys);
      verificationGeneration += 1;
      snapshot = await resolveEntitlementKeys(keys);
      scheduleExpiryRefresh(snapshot.activeEntitlements);
      notify();
      return { status: "expired", tier: result.payload.tier, expiresAt: result.payload.exp ?? null };
    }
    return { status: "invalid", tier: null, expiresAt: null };
  }

  const keys = [...storedKeys(), trimmed];
  persistKeys(keys);
  verificationGeneration += 1;
  snapshot = await resolveEntitlementKeys(keys);
  scheduleExpiryRefresh(snapshot.activeEntitlements);
  notify();
  return {
    status: "valid",
    tier: result.payload.tier,
    expiresAt: result.payload.exp ?? null
  };
}

/** Legacy internal name retained for existing callers. */
export const activateLicenseKey = activateSignedEntitlement;

export function removeLicense(): void {
  verificationGeneration += 1;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LICENSE_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_LICENSE_STORAGE_KEY);
  }
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = null;
  snapshot = NONE;
  notify();
}

export function useEntitlement() {
  const entitlement = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  const commerceMode = getCommerceMode();
  // Package boundaries remain real even when checkout is temporarily paused.
  // "off" controls whether money may be taken; it is not a hidden client-side
  // switch that grants every paid feature.
  const commerceEnabled = true;

  function hasFeature(feature: EntitledFeature): boolean {
    return entitlement.activeEntitlements.some((grant) => tierHasFeature(grant.tier, feature));
  }

  function laneLimit(): number {
    return entitlement.activeEntitlements.reduce(
      (limit, grant) => Math.max(limit, tierLaneLimit(grant.tier)),
      1
    );
  }

  return { entitlement, commerceMode, commerceEnabled, hasFeature, laneLimit };
}
