"use client";
/* eslint-disable react-hooks/set-state-in-effect -- restoring one saved local job workspace after hydration */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { activationEventsForTransition } from "@/lib/activation";
import { trackCareerEvent } from "@/lib/analytics";
import { draftApplicationQuestion } from "@/lib/application-questions";
import { statusForWorkspaceSave } from "@/lib/application-workflow";
import { calendarDateInputValue } from "@/lib/calendar-date";
import { APPLICATION_FOLLOW_UP_DAYS, addDays } from "@/lib/command-center-insights";
import { createId } from "@/lib/command-center-store";
import { assessDossierReadiness } from "@/lib/dossier";
import { useEntitlement } from "@/lib/entitlement";
import { analyzeJobPost, type JobPostAnalysis, type RequirementMatch } from "@/lib/job-post-analyzer";
import { applicationJobPost, encodeJobPostText, isLikelyNewJobPost } from "@/lib/job-workspace";
import { createRoleSprint } from "@/lib/role-sprint";
import { recommendRoleSprintRequirement } from "@/lib/role-sprint-ux";
import { buildHandoff, saveHandoff } from "@/lib/tailor-handoff";
import { useCommandCenter } from "@/lib/use-command-center";
import type { ApplicationQuestion, ApplicationRecord } from "@/types/command-center";

export type JobSource = "linkedin" | "company-site" | "referral" | "recruiter" | "other";
export type TailorForm = {
  jobPost: string; company: string; roleTitle: string; companyEdited: boolean; roleTitleEdited: boolean;
  laneId: string; baselineVariantId: string; source: JobSource; discoveryUrl: string; applicationUrl: string;
  postingDate: string; deadline: string; contactName: string; contactUrl: string; questionPrompts: string;
};

const EMPTY_FORM: TailorForm = {
  jobPost: "", company: "", roleTitle: "", companyEdited: false, roleTitleEdited: false,
  laneId: "", baselineVariantId: "", source: "linkedin", discoveryUrl: "", applicationUrl: "",
  postingDate: "", deadline: "", contactName: "", contactUrl: "", questionPrompts: ""
};

function inferJobIdentity(jobPost: string): { roleTitle: string; company: string } {
  const lines = jobPost.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 8);
  for (const line of lines) {
    const atMatch = line.match(/^(.{3,80}?)\s+at\s+(.{2,80})$/i);
    if (atMatch) return { roleTitle: atMatch[1].trim(), company: atMatch[2].trim() };
    const dividerMatch = line.match(/^(.{3,80}?)\s+(?:—|\||–)\s+(.{2,80})$/);
    if (dividerMatch) return { roleTitle: dividerMatch[1].trim(), company: dividerMatch[2].trim() };
  }
  return { roleTitle: lines[0] ?? "", company: "" };
}

function normalizePrompt(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function mergeApplicationQuestions(
  questionPrompts: string,
  currentQuestions: ApplicationQuestion[],
  dossier: Parameters<typeof draftApplicationQuestion>[1],
  applicationId: string
): ApplicationQuestion[] {
  const prompts = questionPrompts.split(/\n+/).map((prompt) => prompt.trim()).filter(Boolean);
  // The saved prompts are loaded into the form, so an empty field here is an
  // intentional clear rather than an automatic-save ambiguity.
  if (!prompts.length) return [];
  const existing = new Map(currentQuestions.map((question) => [normalizePrompt(question.prompt), question]));
  return prompts.map((prompt, index) => {
    const saved = existing.get(normalizePrompt(prompt));
    if (saved) return { ...saved, prompt };
    return draftApplicationQuestion(prompt, dossier, `${applicationId}-question-${index + 1}`);
  });
}

export function useTailorWorkspace() {
  const { state, update, hydrated } = useCommandCenter();
  const { hasFeature } = useEntitlement();
  const router = useRouter();
  const loadedApplicationRef = useRef<string | null>(null);
  const [form, setForm] = useState<TailorForm>(EMPTY_FORM);
  const [analysis, setAnalysis] = useState<JobPostAnalysis | null>(null);
  const [savedApplicationId, setSavedApplicationId] = useState<string | null>(null);

  const currentApplication = savedApplicationId ? state.applications.find((item) => item.id === savedApplicationId) ?? null : null;
  const effectiveLane = useMemo(
    () => state.lanes.find((lane) => lane.id === form.laneId) ?? state.lanes.find((lane) => lane.status === "active") ?? state.lanes[0] ?? null,
    [form.laneId, state.lanes]
  );
  const allBaselines = useMemo(() => {
    const seen = new Set<string>();
    return [...state.resumePacks]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .flatMap((pack) => [...pack.variants].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
      .filter((variant) => variant.kind !== "job-specific")
      .filter((variant) => !seen.has(variant.id) && Boolean(seen.add(variant.id)));
  }, [state.resumePacks]);
  const savedBaseline = currentApplication?.resumeVariantId
    ? allBaselines.find((variant) => variant.id === currentApplication.resumeVariantId) ?? null
    : null;
  const laneBaselines = allBaselines.filter((variant) => !effectiveLane || variant.laneId === effectiveLane.id);
  const baselines = savedBaseline && !laneBaselines.some((variant) => variant.id === savedBaseline.id)
    ? [savedBaseline, ...laneBaselines]
    : laneBaselines;
  const effectiveBaseline = baselines.find((variant) => variant.id === form.baselineVariantId)
    ?? savedBaseline
    ?? baselines.find((variant) => variant.kind === "ats")
    ?? baselines[0]
    ?? null;
  const baselineIssue = currentApplication?.resumeVariantId && !savedBaseline
    ? "The résumé baseline originally attached to this job no longer exists. Choose a replacement before generating a tailored résumé."
    : savedBaseline && effectiveLane && savedBaseline.laneId !== effectiveLane.id
      ? "This job is attached to a résumé from a different target lane. Choose the intended baseline before generating a new tailored résumé."
      : null;
  const profileReady = hydrated && assessDossierReadiness(state.dossier).level !== "not-ready";

  useEffect(() => {
    if (!hydrated || loadedApplicationRef.current) return;
    const applicationId = new URLSearchParams(window.location.search).get("applicationId");
    const application = applicationId ? state.applications.find((item) => item.id === applicationId) : null;
    if (!application) return;
    const savedPost = applicationJobPost(application);
    loadedApplicationRef.current = application.id;
    setForm({
      jobPost: savedPost,
      company: application.company === "Unknown company" ? "" : application.company,
      roleTitle: application.roleTitle === "Untitled role" ? "" : application.roleTitle,
      companyEdited: true,
      roleTitleEdited: true,
      laneId: application.laneId ?? "",
      baselineVariantId: application.resumeVariantId ?? "",
      source: application.source,
      discoveryUrl: application.discoveryUrl,
      applicationUrl: application.applicationUrl,
      postingDate: calendarDateInputValue(application.postingDate),
      deadline: calendarDateInputValue(application.deadline),
      contactName: application.contactName,
      contactUrl: application.contactUrl,
      questionPrompts: application.applicationQuestions.map((question) => question.prompt).join("\n")
    });
    setSavedApplicationId(application.id);
    if (savedPost) {
      const lane = state.lanes.find((item) => item.id === application.laneId) ?? effectiveLane;
      setAnalysis(analyzeJobPost(savedPost, state.profile, lane, state.dossier));
    }
  }, [effectiveLane, hydrated, state.applications, state.dossier, state.lanes, state.profile]);

  function setField<K extends keyof TailorForm>(key: K, value: TailorForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleJobPostChange(nextPost: string, inputType = "") {
    const newPosting = Boolean(savedApplicationId && form.jobPost && isLikelyNewJobPost(form.jobPost, nextPost, inputType));
    const inferred = inferJobIdentity(nextPost);
    setAnalysis(null);
    if (newPosting) {
      setSavedApplicationId(null);
      loadedApplicationRef.current = null;
      window.history.replaceState({}, "", "/tailor");
      setForm((current) => ({
        ...current, jobPost: nextPost, company: inferred.company, roleTitle: inferred.roleTitle,
        companyEdited: false, roleTitleEdited: false, source: "linkedin", discoveryUrl: "", applicationUrl: "",
        postingDate: "", deadline: "", contactName: "", contactUrl: "", questionPrompts: ""
      }));
      return;
    }
    setForm((current) => ({
      ...current,
      jobPost: nextPost,
      company: current.companyEdited ? current.company : inferred.company,
      roleTitle: current.roleTitleEdited ? current.roleTitle : inferred.roleTitle
    }));
  }

  function runAnalysis() {
    if (!form.jobPost.trim()) return;
    const inferred = inferJobIdentity(form.jobPost);
    setForm((current) => ({
      ...current,
      company: current.companyEdited ? current.company : inferred.company,
      roleTitle: current.roleTitleEdited ? current.roleTitle : inferred.roleTitle
    }));
    trackCareerEvent("job_tailor_started");
    trackCareerEvent("tailor_started");
    setAnalysis(analyzeJobPost(form.jobPost, state.profile, effectiveLane, state.dossier));
  }

  function buildApplication(id: string, requestedStatus: "drafting" | "applied", current?: ApplicationRecord): ApplicationRecord {
    const nowIso = new Date().toISOString();
    const inferred = inferJobIdentity(form.jobPost);
    const status = statusForWorkspaceSave(current?.status, requestedStatus);
    const questions = mergeApplicationQuestions(form.questionPrompts, current?.applicationQuestions ?? [], state.dossier, id);
    const chosenBaselineId = form.baselineVariantId || current?.resumeVariantId || effectiveBaseline?.id || null;
    return {
      id,
      company: form.company.trim() || inferred.company || current?.company || "Unknown company",
      roleTitle: form.roleTitle.trim() || inferred.roleTitle || current?.roleTitle || effectiveLane?.title || "Untitled role",
      laneId: effectiveLane?.id ?? current?.laneId ?? null,
      status,
      jobPostUrl: form.jobPost.trim() ? encodeJobPostText(form.jobPost) : current?.jobPostUrl ?? "",
      source: form.source,
      discoveryUrl: form.discoveryUrl.trim(),
      applicationUrl: form.applicationUrl.trim(),
      postingDate: form.postingDate || current?.postingDate || null,
      deadline: form.deadline || current?.deadline || null,
      contactName: form.contactName.trim(),
      contactUrl: form.contactUrl.trim(),
      resumeVariantId: chosenBaselineId,
      applicationQuestions: questions,
      resumeVersionId: current?.resumeVersionId ?? null,
      appliedAt: status === "applied" || status === "interviewing" || status === "offer" ? current?.appliedAt ?? nowIso : null,
      nextFollowUpAt: status === "applied" ? current?.nextFollowUpAt ?? addDays(nowIso, APPLICATION_FOLLOW_UP_DAYS) : current?.nextFollowUpAt ?? null,
      followUpsSent: current?.followUpsSent ?? [],
      interviewAt: current?.interviewAt ?? null,
      notes: current?.notes || (analysis ? `Tailoring notes — top keywords: ${analysis.keywords.slice(0, 6).map((hit) => hit.term).join(", ")}` : ""),
      analysisKeywords: analysis ? analysis.keywords.slice(0, 10).map((hit) => hit.term) : current?.analysisKeywords ?? [],
      analysisGaps: analysis ? analysis.requirements.filter((item) => item.status !== "covered").map((item) => item.requirement).slice(0, 6) : current?.analysisGaps ?? [],
      analysisWeakSpots: analysis ? analysis.weakSpots.slice(0, 4) : current?.analysisWeakSpots ?? [],
      createdAt: current?.createdAt ?? nowIso,
      updatedAt: nowIso
    };
  }

  function saveAsApplication(status: "drafting" | "applied"): string {
    const id = savedApplicationId ?? createId("app");
    let events: ReturnType<typeof activationEventsForTransition> = [];
    update((current) => {
      const existing = current.applications.find((item) => item.id === id);
      const record = buildApplication(id, status, existing);
      const next = { ...current, applications: existing ? current.applications.map((item) => item.id === id ? record : item) : [...current.applications, record] };
      events = activationEventsForTransition(current, next);
      return next;
    });
    setSavedApplicationId(id);
    loadedApplicationRef.current = id;
    events.forEach(trackCareerEvent);
    return id;
  }

  function startRoleSprint(requirement: RequirementMatch) {
    const applicationId = saveAsApplication("drafting");
    const nowIso = new Date().toISOString();
    let sprintId = "";
    update((current) => {
      const existing = current.roleSprints.find((item) => item.requirement === requirement.requirement && item.applicationId === applicationId);
      if (existing) { sprintId = existing.id; return current; }
      const application = current.applications.find((item) => item.id === applicationId);
      const sprint = createRoleSprint({
        requirement,
        company: application?.company ?? form.company,
        roleTitle: application?.roleTitle ?? (form.roleTitle || effectiveLane?.title || ""),
        applicationId,
        nowIso
      });
      sprintId = sprint.id;
      return { ...current, roleSprints: [...current.roleSprints, sprint] };
    });
    trackCareerEvent("role_sprint_started");
    router.push(`/role-sprint?id=${sprintId}`);
  }

  function startTailoredResume() {
    if (!analysis || !effectiveBaseline || baselineIssue || !hasFeature("tailored_resume_export")) return;
    const applicationId = saveAsApplication("drafting");
    saveHandoff(buildHandoff({ analysis, lane: effectiveLane, company: form.company, roleTitle: form.roleTitle, applicationId, baselineVariantId: effectiveBaseline.id }));
    trackCareerEvent("application_pack_completed");
    router.push("/resume-builder");
  }

  const recommendation = analysis
    ? recommendRoleSprintRequirement(analysis.requirements, form.jobPost, {
        applicationStatus: currentApplication?.status,
        deadline: form.deadline || currentApplication?.deadline,
        hasResumeBaseline: Boolean(effectiveBaseline)
      })
    : null;

  return {
    state, hydrated, form, setField, handleJobPostChange, analysis, runAnalysis, saveAsApplication,
    startRoleSprint, startTailoredResume, effectiveLane, baselines, effectiveBaseline, savedApplicationId,
    currentApplication, profileReady, recommendation, baselineIssue,
    canTailorResume: hasFeature("tailored_resume_export")
  };
}
