"use client";

import { useSyncExternalStore } from "react";
import {
  APPLICATION_ACTIVITY_KEY,
  persistApplicationActivity,
  restoreApplicationActivity
} from "@/lib/application-activity";
import { emptyState, loadState, saveState, STORAGE_KEY } from "@/lib/command-center-store";
import { sanitizeCommandCenterState } from "@/lib/evidence-admissibility";
import type { CommandCenterState } from "@/types/command-center";

// Single client-side store: one snapshot shared by every page, kept coherent
// across client-side navigation and persisted to localStorage on every update.
const listeners = new Set<() => void>();
let snapshot: CommandCenterState | null = null;
const serverSnapshot = emptyState();
let watchingOtherTabs = false;

function readSanitizedState(): CommandCenterState {
  const loaded = restoreApplicationActivity(loadState());
  const sanitized = sanitizeCommandCenterState(loaded);
  if (JSON.stringify(sanitized) !== JSON.stringify(loaded)) saveState(sanitized);
  persistApplicationActivity(sanitized);
  return sanitized;
}

// Storage events keep every open tab pointed at the newest durable state.
// Each write also rebases on localStorage immediately before applying its
// updater, so a stale tab cannot erase unrelated work from a newer tab.
function watchOtherTabs(): void {
  if (watchingOtherTabs || typeof window === "undefined") return;
  watchingOtherTabs = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== APPLICATION_ACTIVITY_KEY && event.key !== null) return;
    snapshot = readSanitizedState();
    listeners.forEach((listener) => listener());
  });
}

function getSnapshot(): CommandCenterState {
  if (snapshot === null) snapshot = readSanitizedState();
  return snapshot;
}

function getServerSnapshot(): CommandCenterState {
  return serverSnapshot;
}

function subscribe(listener: () => void): () => void {
  watchOtherTabs();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateCommandCenter(updater: (current: CommandCenterState) => CommandCenterState): void {
  const latest = readSanitizedState();
  const proposed = updater(latest);
  snapshot = sanitizeCommandCenterState(proposed, latest);
  saveState(snapshot);
  persistApplicationActivity(snapshot);
  listeners.forEach((listener) => listener());
}

export function useCommandCenter() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return { state, update: updateCommandCenter, hydrated };
}
