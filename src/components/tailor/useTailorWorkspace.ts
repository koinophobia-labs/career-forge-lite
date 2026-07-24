"use client";
/* eslint-disable react-hooks/set-state-in-effect -- restoring one saved local job workspace after hydration */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { activationEventsForTransition } from "@/lib/activation";
import { trackCareerEvent } from "@/lib/analytics";
import { draftApplicationQuestion } from "@/lib/application-questions";
import { statusForWorkspaceSave } from "@/lib/application-workflow";
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
import type { ApplicationRecord } from "@/types/command-center";

type JobSource = "linkedin" | "company-site" | "referral" | "recruiter" | "other";

export type TailorForm = {
  jobPost: string;
  company: string;
  roleTitle: string;
  companyEdited: boolean;
  roleTitleEdited: boolean;
  laneId: string;
  baselineVariantId: string;
  source: JobSource;
  discoveryUrl: string;
  applicationUrl: string;
  postingDate: string;
  deadline: string;
  contactName: string;
  contactUrl: string;
  questionPrompts: string;
};

const EMPTY_FORM: TailorForm = {
  jobPost: "",
  company: "",
  roleTitle: "",
  companyEdited: false,
  roleTitleEdited: false,
  laneId: "",
  baselineVariantId: "",
  source: "linkedin",
  discoveryUrl: "",
  applicationUrl: "",
  postingDate: "",
  deadline: "",
  contactName: "",
  contactUrl: "",
  questionPrompts: ""
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

export function useTailorWorkspace() {
  const { state, update, hydrated } = useCommandCenter();
  const { hasFeature } = useEntitlement();
  const router = useRouter();
  const loadedApplicationRef = useRef<string | null>(null);
  const [form, setForm] = useState<TailorForm>(EMPTY_FORM);
  const [analysis, setAnalysis] = useState<JobPostAnalysis | null>(null);
  const [savedApplicationId, setSavedApplicationId] = useState<string | null>(null);

  const effectiveLane = useMemo(
    () => state.lanes.find((lane) => lane.id === form.laneId) ?? state.lanes.find((lane) => lane.status === "active") ?? state.lanes[0] ?? null,
    [form.laneId, state.lanes]
  );
  const currentPack = useMemo(() => [...state.resumePacks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null, [state.resumePacks]);
  const baselines = useMemo(
    () => currentPack?.variants.filter((variant) => variant.kind !== "job-specific" && (!effectiveLane || variant.laneId === effectiveLane.id)) ?? [],
    [currentPack, effectiveLane]
  );
  const effectiveBaseline = baselines.find((variant) => variant.id === form.baselineVariantId) ?? baselines.find((variant) => variant.kind === "ats") ?? baselines[0] ?? null;
  const currentApplication = savedApplicationId ? state.applications.find((item) => item.id === savedApplicationId) ?? null : null;
  const profileReady = hydrated && assessDossierReadiness(state.dossier).level !== "not-ready";

  useEffect(() => {
    if (!hydrated || loadedApplicationRef.current) return;
    const applicationId = new URLSearchParams(window.location.search).get("applicationId");
    const application = applicationId ? state.applications.find((item) => item.id === applicationId) : null;
    const savedPost = application ? applicationJobPost(application) : "";
    if (!application || !savedPost) return;

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
      postingDate: application.postingDate?.slice(0, 10) ?? "",
      deadline: application.deadline?.slice(0, 10) ?? "",
      contactName: application.contactName,
      contactUrl: application.contactUrl,
      questionPrompts: application.applicationQuestions.map((question) => question.prompt).join("\n")
    });
    setSavedApplicationId(application.id);
    const lane = state.lanes.find((item) => item.id === application.laneId) ?? effectiveLane;
    setAnalysis(analyzeJobPost(savedPost, state.profile, lane, state.dossier));
  }, [effectiveLane, hydrated, state.applications, state.dossier, state.lanes, state.profile]);

  function setField<K extends keyof TailorForm>(key: K, value: TailorForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleJobPostChange(nextPost: string, inputType = "") {
    const newPosting = Boolean(savedApplicationId && isLikelyNewJobPost(form.jobPost, nextPost, inputType));
    const inferred = inferJobIdentity(nextPost);
    setAnalysis(null);
    if (newPosting) {
      setSavedApplicationId(null);
      loadedApplicationRef.current = null;
      setForm((current) => ({
        ...current,
        jobPost: nextPost,
        company: inferred.company,
        roleTitle: inferred.roleTitle,
        companyEdited: false,
        roleTitleEdited: false,
        source: "linkedin",
        discoveryUrl: "",
        applicationUrl: "",
        postingDate: "",
        deadline: "",
        contactName: "",
        contactUrl: "",
        questionPrompts: ""
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
    const questions = form.questionPrompts.trim()
      ? form.questionPrompts.split(/\n+/).map((prompt) => prompt.trim()).filter(Boolean).map((prompt, index) => draftApplicationQuestion(prompt, state.dossier, `${id}-question-${index + 1}`))
      : current?.applicationQuestions ?? [];
    return {
      id,
      company: form.company.trim() || inferred.company || "Unknown company",
      roleTitle: form.roleTitle.trim() || inferred.roleTitle || effectiveLane?.title || "Untitled role",
      laneId: effectiveLane?.id ?? null,
      status,
      jobPostUrl: encodeJobPostText(form.jobPost),
      source: form.source,
      discoveryUrl: form.discoveryUrl.trim(),
      applicationUrl: form.applicationUrl.trim(),
      postingDate: form.postingDate ? new Date(form.postingDate).toISOString() : null,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      contactName: form.contactName.trim(),
      contactUrl: form.contactUrl.trim(),
      resumeVariantId: effectiveBaseline?.id ?? current?.resumeVariantId ?? null,
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
      createdAt: current?.createdAt ?? nowIso
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
      if (existing) {
        sprintId = existing.id;
        return current;
      }
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
    if (!analysis || !effectiveBaseline || !hasFeature("tailored_resume_export")) return;
    const applicationId = saveAsApplication("drafting");
    saveHandoff(buildHandoff({ analysis, lane: effectiveLane, company: form.company, roleTitle: form.roleTitle, applicationId, baselineVariantId: effectiveBaseline.id }));
    trackCareerEvent("application_pack_completed");
    router.push("/resume-builder");
  }

  const recommendation = analysis
    ? recommendRoleSprintRequirement(analysis.requirements, form.jobPost, {
        applicationStatus: currentApplication?.status,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : currentApplication?.deadline,
        hasResumeBaseline: Boolean(effectiveBaseline)
      })
    : null;

  return {
    state,
    hydrated,
    form,
    setField,
    handleJobPostChange,
    analysis,
    runAnalysis,
    saveAsApplication,
    startRoleSprint,
    startTailoredResume,
    effectiveLane,
    baselines,
    effectiveBaseline,
    savedApplicationId,
    profileReady,
    recommendation,
    canTailorResume: hasFeature("tailored_resume_export")
  };
}
