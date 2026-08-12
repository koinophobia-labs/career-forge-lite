"use client";

// A signed CF2 entitlement is necessary but not sufficient. Paid access also
// needs a successful server revocation check cached on this device for at most
// 24 hours. CF1 keys are accepted only as inputs to a one-time online exchange.

import { useSyncExternalStore } from "react";
import { getCommerceMode } from "@/lib/commerce-mode";
import { verifyAuthorizationReceipt, verifyLicenseKey, type AuthorizationPayload } from "@/lib/license";
import { tierHasFeature, tierLaneLimit, type EntitledFeature, type PackageTier } from "@/lib/packages";

export const LICENSE_STORAGE_KEY = "career-forge-license-v1";
export const AUTHORIZATION_STORAGE_KEY = "career-forge-entitlement-authorization-v1";

export { getCommerceMode } from "@/lib/commerce-mode";
export type { CommerceMode } from "@/lib/commerce-mode";

export type EntitlementState = {
  status: "none" | "checking" | "valid" | "invalid";
  tier: PackageTier | null;
  signedEntitlement: string | null;
};

type AuthorizationResponse = {
  authorized?: boolean;
  signedEntitlement?: string;
  tier?: PackageTier;
  entitlementId?: string;
  checkedAt?: number;
  expiresAt?: number;
  authorizationReceipt?: string;
};

const NONE: EntitlementState = { status: "none", tier: null, signedEntitlement: null };
const listeners = new Set<() => void>();
let snapshot: EntitlementState | null = null;
let verificationSequence = 0;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
const serverSnapshot = NONE;

function notify() {
  listeners.forEach((listener) => listener());
}

function readAuthorizationReceipt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTHORIZATION_STORAGE_KEY);
}

function clearAuthorizationCache(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(AUTHORIZATION_STORAGE_KEY);
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = null;
}

function scheduleExpiry(authorization: AuthorizationPayload): void {
  if (expiryTimer) clearTimeout(expiryTimer);
  const delay = Math.max(0, authorization.expiresAt - Date.now());
  expiryTimer = setTimeout(() => {
    if (authorization.expiresAt <= Date.now()) {
      clearAuthorizationCache();
      if (snapshot?.status === "valid") {
        snapshot = { ...snapshot, status: "invalid", tier: null };
        notify();
      }
    }
  }, Math.min(delay + 25, 2_147_483_647));
}

function cacheMatches(
  authorization: AuthorizationPayload,
  payload: { v: number; tier: PackageTier; entitlementId?: string },
  now = Date.now()
): boolean {
  return Boolean(
    payload.v === 2 &&
    payload.entitlementId === authorization.entitlementId &&
    payload.tier === authorization.tier &&
    authorization.expiresAt > now
  );
}

async function authorizeOnline(key: string, sequence: number): Promise<EntitlementState> {
  try {
    const response = await fetch("/api/entitlement/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedEntitlement: key }),
      cache: "no-store",
    });
    const data = (await response.json()) as AuthorizationResponse;
    if (sequence !== verificationSequence) return snapshot ?? NONE;
    if (
      response.ok &&
      data.authorized === true &&
      typeof data.signedEntitlement === "string" &&
      typeof data.entitlementId === "string" &&
      typeof data.checkedAt === "number" &&
      typeof data.expiresAt === "number" &&
      typeof data.authorizationReceipt === "string" &&
      data.tier
    ) {
      const [verifiedEntitlement, verifiedAuthorization] = await Promise.all([
        verifyLicenseKey(data.signedEntitlement),
        verifyAuthorizationReceipt(data.authorizationReceipt),
      ]);
      if (
        sequence !== verificationSequence ||
        !verifiedEntitlement.ok ||
        verifiedEntitlement.payload.v !== 2 ||
        !verifiedAuthorization.ok ||
        verifiedEntitlement.payload.entitlementId !== data.entitlementId ||
        verifiedEntitlement.payload.tier !== data.tier ||
        verifiedAuthorization.payload.entitlementId !== data.entitlementId ||
        verifiedAuthorization.payload.tier !== data.tier ||
        verifiedAuthorization.payload.checkedAt !== data.checkedAt ||
        verifiedAuthorization.payload.expiresAt !== data.expiresAt ||
        !cacheMatches(verifiedAuthorization.payload, verifiedEntitlement.payload)
      ) {
        clearAuthorizationCache();
        snapshot = { status: "invalid", tier: null, signedEntitlement: key };
        notify();
        return snapshot;
      }
      window.localStorage.setItem(LICENSE_STORAGE_KEY, data.signedEntitlement);
      window.localStorage.setItem(AUTHORIZATION_STORAGE_KEY, data.authorizationReceipt);
      snapshot = { status: "valid", tier: data.tier, signedEntitlement: data.signedEntitlement };
      scheduleExpiry(verifiedAuthorization.payload);
      notify();
      return snapshot;
    }
    if (response.status === 403) {
      clearAuthorizationCache();
      window.localStorage.removeItem(LICENSE_STORAGE_KEY);
      snapshot = { status: "invalid", tier: null, signedEntitlement: key };
      notify();
      return snapshot;
    }
  } catch {
    // A current cache remains valid during a network failure. It will expire
    // on its own timer; no exception can extend the server-issued window.
  }

  const receipt = readAuthorizationReceipt();
  const [verified, verifiedAuthorization] = await Promise.all([
    verifyLicenseKey(key),
    receipt ? verifyAuthorizationReceipt(receipt) : Promise.resolve(null),
  ]);
  if (sequence !== verificationSequence) return snapshot ?? NONE;
  if (verified.ok && verifiedAuthorization?.ok && cacheMatches(verifiedAuthorization.payload, verified.payload)) {
    snapshot = { status: "valid", tier: verified.payload.tier, signedEntitlement: key };
    scheduleExpiry(verifiedAuthorization.payload);
  } else {
    clearAuthorizationCache();
    snapshot = { status: "invalid", tier: null, signedEntitlement: key };
  }
  notify();
  return snapshot;
}

function beginVerification(key: string): void {
  const sequence = ++verificationSequence;
  void verifyLicenseKey(key).then(async (result) => {
    if (sequence !== verificationSequence || snapshot?.signedEntitlement !== key) return;
    if (!result.ok) {
      clearAuthorizationCache();
      snapshot = { status: "invalid", tier: null, signedEntitlement: key };
      notify();
      return;
    }
    const receipt = readAuthorizationReceipt();
    const authorization = receipt ? await verifyAuthorizationReceipt(receipt) : null;
    if (sequence !== verificationSequence || snapshot?.signedEntitlement !== key) return;
    if (authorization?.ok && cacheMatches(authorization.payload, result.payload)) {
      snapshot = { status: "valid", tier: result.payload.tier, signedEntitlement: key };
      scheduleExpiry(authorization.payload);
      notify();
    }
    // Launching online always revalidates. A network failure preserves only a
    // still-current cache; CF1 and expired CF2 stay closed until this succeeds.
    void authorizeOnline(key, sequence);
  });
}

function getSnapshot(): EntitlementState {
  if (snapshot === null) {
    const stored = typeof window === "undefined" ? null : window.localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!stored) snapshot = NONE;
    else {
      snapshot = { status: "checking", tier: null, signedEntitlement: stored };
      beginVerification(stored);
    }
  }
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** First activation and every restore/re-entry force a live revocation check. */
export async function activateSignedEntitlement(key: string): Promise<EntitlementState> {
  const trimmed = key.trim();
  const sequence = ++verificationSequence;
  clearAuthorizationCache();
  const verified = await verifyLicenseKey(trimmed);
  if (!verified.ok) {
    snapshot = { status: "invalid", tier: null, signedEntitlement: trimmed };
    notify();
    return snapshot;
  }
  snapshot = { status: "checking", tier: null, signedEntitlement: trimmed };
  notify();
  return authorizeOnline(trimmed, sequence);
}

export const activateLicenseKey = activateSignedEntitlement;

export function removeLicense(): void {
  verificationSequence += 1;
  if (typeof window !== "undefined") window.localStorage.removeItem(LICENSE_STORAGE_KEY);
  clearAuthorizationCache();
  snapshot = NONE;
  notify();
}

export function useEntitlement() {
  const entitlement = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  const commerceMode = getCommerceMode();
  const commerceEnabled = commerceMode !== "off";

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
