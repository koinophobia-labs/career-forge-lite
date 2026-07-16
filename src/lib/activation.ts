import { assessDossierReadiness } from "@/lib/dossier";
import type { CommandCenterState } from "@/types/command-center";
import type { ResumeVariantKind } from "@/types/dossier";

export type ActivationStage = {
  id: "history" | "review" | "lanes" | "pack" | "application";
  label: string;
  detail: string;
  href: string;
  action: string;
  complete: boolean;
};

export function activationStages(state: CommandCenterState): ActivationStage[] {
  const approved = state.dossier.evidence.filter((item) => item.approved && !item.rejected);
  const hasHistory = state.dossier.roles.length > 0 || state.dossier.projects.length > 0 || state.dossier.evidence.length > 0;
  const activeLanes = state.lanes.filter((lane) => lane.status === "active");
  const currentPack = [...state.resumePacks]
    .filter((pack) => pack.status !== "archived")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return [
    {
      id: "history",
      label: "Import or add history",
      detail: hasHistory ? `${state.dossier.roles.length} roles and ${state.dossier.projects.length} projects found` : "Bring old résumés or describe your work",
      href: "/profile#import",
      action: "Import my résumés",
      complete: hasHistory
    },
    {
      id: "review",
      label: "Review the facts",
      detail: approved.length ? `${approved.length} facts approved for reuse` : "Approve only facts you recognize as true",
      href: "/profile#review",
      action: "Review proposed facts",
      complete: approved.length > 0
    },
    {
      id: "lanes",
      label: "Choose role lanes",
      detail: activeLanes.length ? `${activeLanes.length} active role lane${activeLanes.length === 1 ? "" : "s"}` : "Pick a credible direction for each baseline",
      href: "/targets",
      action: "Choose a role lane",
      complete: activeLanes.length > 0
    },
    {
      id: "pack",
      label: "Forge the Résumé Pack",
      detail: currentPack ? `${currentPack.variants.length} baseline résumés ready` : "Create ATS and recruiter versions for every active lane",
      href: currentPack ? "/versions" : "/targets#forge-pack",
      action: currentPack ? "Open my Résumé Pack" : "Forge my Résumé Pack",
      complete: Boolean(currentPack?.variants.length)
    },
    {
      id: "application",
      label: "Use it on a real application",
      detail: state.applications.length ? `${state.applications.length} application${state.applications.length === 1 ? "" : "s"} saved` : "Tailor the right baseline to a real posting",
      href: "/tailor",
      action: "Tailor to a real job",
      complete: state.applications.length > 0
    }
  ];
}

export function currentActivationStage(state: CommandCenterState): ActivationStage {
  const stages = activationStages(state);
  return stages.find((stage) => !stage.complete) ?? stages[stages.length - 1];
}

export function activationSummary(state: CommandCenterState) {
  const approved = state.dossier.evidence.filter((item) => item.approved && !item.rejected);
  const readiness = assessDossierReadiness(state.dossier);
  return {
    approved: approved.length,
    roles: state.dossier.roles.length,
    projects: state.dossier.projects.length,
    proofPoints: approved.filter((item) => ["proof", "metric", "responsibility", "project"].includes(item.kind)).length,
    activeLanes: state.lanes.filter((lane) => lane.status === "active").length,
    resumeReady: readiness.level !== "not-ready",
    readiness
  };
}

export function variantPurpose(kind: ResumeVariantKind): { label: string; purpose: string; difference: string } {
  if (kind === "ats") {
    return {
      label: "ATS Submission",
      purpose: "Use for employer portals and direct applications where parsing and relevant terminology matter most.",
      difference: "Compact, scan-friendly structure leads with evidence-backed skills and conventional experience sections."
    };
  }
  if (kind === "recruiter") {
    return {
      label: "Recruiter / Networking",
      purpose: "Use for recruiter outreach, referrals, networking, and hiring-manager introductions.",
      difference: "Human-first narrative leads with positioning and selected proof so the career story is easier to grasp."
    };
  }
  return {
    label: "Job-specific",
    purpose: "Use only for the real posting it was tailored against.",
    difference: "Starts from a trusted lane baseline and reflects the posting without claiming unsupported qualifications."
  };
}
