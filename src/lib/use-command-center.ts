"use client";

import { useSyncExternalStore } from "react";
import { emptyState, loadState, saveState } from "@/lib/command-center-store";
import type { CommandCenterState } from "@/types/command-center";

// Single client-side store: one snapshot shared by every page, kept coherent
// across client-side navigation and persisted to localStorage on every update.
const listeners = new Set<() => void>();
let snapshot: CommandCenterState | null = null;
const serverSnapshot = emptyState();

function getSnapshot(): CommandCenterState {
  if (snapshot === null) snapshot = loadState();
  return snapshot;
}

function getServerSnapshot(): CommandCenterState {
  return serverSnapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateCommandCenter(updater: (current: CommandCenterState) => CommandCenterState): void {
  snapshot = updater(getSnapshot());
  saveState(snapshot);
  listeners.forEach((listener) => listener());
}

export function useCommandCenter() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  // updateCommandCenter is a stable module-level function, safe to hand out directly.
  return { state, update: updateCommandCenter, hydrated };
}
