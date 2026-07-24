"use client";

import { useSyncExternalStore } from "react";
import {
  APPLICATION_ACTIVITY_KEY,
  persistApplicationActivity,
  restoreApplicationActivity
} from "@/lib/application-activity";
import { emptyState, loadState, saveState, STORAGE_KEY } from "@/lib/command-center-store";
import { sanitizeCommandCenterState } from "@/lib/evidence-admissibility";
import type { ApplicationStatus, CommandCenterState } from "@/types/command-center";

const applicationStatuses = new Set<ApplicationStatus>(["drafting", "applied", "interviewing", "offer", "rejected", "closed"]);

// The legacy reviver intentionally enumerates its old schema. Restore additive,
// optional history fields from the same durable JSON until the next schema bump.
function restoreOptionalApplicationHistory(state: CommandCenterState): CommandCenterState {
  if (typeof window === "undefined") return state;
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as { applications?: unknown[] };
    const byId = new Map(
      (Array.isArray(raw.applications) ? raw.applications : [])
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item) && typeof (item as Record<string, unknown>).id === "string")
        .map((item) => [item.id as string, item])
    );
    return {
      ...state,
      applications: state.applications.map((application) => {
        const source = byId.get(application.id);
        if (!source) return application;
        const stageHistory = Array.isArray(source.stageHistory)
          ? source.stageHistory.flatMap((entry) => {
              if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
              const value = entry as Record<string, unknown>;
              if (typeof value.status !== "string" || !applicationStatuses.has(value.status as ApplicationStatus) || typeof value.at !== "string") return [];
              return [{ status: value.status as ApplicationStatus, at: value.at }];
            })
          : application.stageHistory;
        const interviewHistory = Array.isArray(source.interviewHistory)
          ? source.interviewHistory.filter((value): value is string => typeof value === "string")
          : application.interviewHistory;
        return { ...application, stageHistory, interviewHistory };
      })
    };
  } catch {
    return state;
  }
}

// Single client-side store: one snapshot shared by every page, kept coherent
// across client-side navigation and persisted to localStorage on every update.
const listeners = new Set<() => void>();
let snapshot: CommandCenterState | null = null;
const serverSnapshot = emptyState();
let watchingOtherTabs = false;

function readSanitizedState(): CommandCenterState {
  const loaded = restoreApplicationActivity(restoreOptionalApplicationHistory(loadState()));
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
