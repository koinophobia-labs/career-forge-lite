import { polishBulletsVerbatim } from "@/lib/resume-intelligence";
import type { CareerDossier } from "@/types/dossier";

export type EarlyWinPreview = { source: string; bullets: string[] };

// Early-win preview: show the user's own approved accomplishment lines back to
// them, tidied. The panel tells the user "Nothing here was invented", so this
// path is held to verbatim fidelity: spelling, casing and punctuation only.
// It must never reword, never substitute an opening verb, and never emit more
// bullets than the user supplied.
//
// Draws from manually-added role and project detail as well as approved
// evidence lifted during résumé import (imported bullets land as
// responsibility/metric/proof evidence, not on the role record), so the preview
// appears whichever way experience arrived. Manual entry writes each
// responsibility to BOTH places, so `raw` is deduplicated before any
// transformation runs — see polishBulletsVerbatim.
export function earlyWinBullets(dossier: CareerDossier): EarlyWinPreview | null {
  const roleBullets = dossier.roles.flatMap((role) => role.responsibilities);
  const projectBullets = dossier.projects.flatMap((project) => [
    ...project.responsibilities,
    project.description,
    ...project.outcomes
  ]);
  const approvedBullets = dossier.evidence
    .filter((item) => item.approved && !item.rejected && (item.kind === "responsibility" || item.kind === "metric" || item.kind === "proof"))
    .map((item) => item.detail);
  const seen = new Set<string>();
  const raw = [...roleBullets, ...projectBullets, ...approvedBullets].filter((line) => {
    const trimmed = (line ?? "").trim();
    if (!trimmed) return false;
    const key = trimmed.toLowerCase().replace(/[.,;:!?]+$/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const bullets = polishBulletsVerbatim(raw);
  if (bullets.length === 0) return null;
  const source =
    (dossier.roles[0] && [dossier.roles[0].title, dossier.roles[0].employer].filter(Boolean).join(" · ")) ||
    dossier.projects[0]?.name ||
    "your approved experience";
  return { source, bullets: bullets.slice(0, 3) };
}
