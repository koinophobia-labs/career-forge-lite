import { variantPlainText } from "@/lib/pack-export";
import type { CommandCenterState, ResumeVersionRecord } from "@/types/command-center";
import type { ResumePack } from "@/types/dossier";

export function syncBuilderVersionsWithPack(state: CommandCenterState, next: ResumePack): ResumeVersionRecord[] {
  return state.resumeVersions.map((version) => {
    const variant = next.variants.find((item) => item.id === version.id);
    if (!variant || version.source !== "builder") return version;
    const userEditNote = variant.userEdited && !version.notes.includes("User-edited")
      ? " User-edited fields require a final human recheck."
      : "";
    return {
      ...version,
      notes: `${version.notes}${userEditNote}`,
      resumeText: variantPlainText(state.dossier, variant.resume, variant.sectionOrder, variant.kind),
      resumeSnapshot: {
        fullName: state.dossier.identity.fullName,
        email: state.dossier.identity.email,
        phone: state.dossier.identity.phone,
        website: state.dossier.identity.links[0] ?? "",
        template: variant.template,
        resume: variant.resume
      }
    };
  });
}
