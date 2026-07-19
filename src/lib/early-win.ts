import { polishBullets } from "@/lib/resume-intelligence";
import type { CareerDossier } from "@/types/dossier";

export type EarlyWinPreview = { source: string; bullets: string[] };

// Early-win preview: clean the user's own approved accomplishment lines into
// résumé voice. Purely cosmetic polishing of text they already approved — no
// new claims, metrics, or credentials invented. Draws from manually-added role
// and project detail as well as approved evidence lifted during résumé import
// (imported bullets land as responsibility/metric/proof evidence, not on the
// role record), so the preview appears whichever way experience arrived.
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
  const raw = [...roleBullets, ...projectBullets, ...approvedBullets].filter(Boolean);
  const bullets = polishBullets(raw);
  if (bullets.length === 0) return null;
  const source =
    (dossier.roles[0] && [dossier.roles[0].title, dossier.roles[0].employer].filter(Boolean).join(" · ")) ||
    dossier.projects[0]?.name ||
    "your approved experience";
  return { source, bullets: bullets.slice(0, 3) };
}
