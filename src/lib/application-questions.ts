import type { ApplicationQuestion } from "@/types/command-center";
import type { CareerDossier, DossierEvidenceRecord } from "@/types/dossier";

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
}

function rankEvidence(prompt: string, evidence: DossierEvidenceRecord[]): DossierEvidenceRecord[] {
  const promptWords = words(prompt);
  const customerQuestion = /customer|client|user|support|problem/i.test(prompt);
  const motivationQuestion = /excites|interested|opportunity|value|why/i.test(prompt);
  return [...evidence].sort((a, b) => {
    const score = (item: DossierEvidenceRecord) => {
      const detail = item.detail.toLowerCase();
      let value = promptWords.filter((word) => detail.includes(word)).length * 3;
      if (customerQuestion && /customer|client|user|support|dispute|resolution|service/i.test(detail)) value += 4;
      if (motivationQuestion && ["project", "proof", "role", "responsibility"].includes(item.kind)) value += 2;
      return value;
    };
    return score(b) - score(a);
  });
}

export function draftApplicationQuestion(prompt: string, dossier: CareerDossier, id = `question-${Date.now().toString(36)}`): ApplicationQuestion {
  const approved = dossier.evidence.filter((item) => item.approved && !item.rejected);
  const supporting = rankEvidence(prompt, approved).slice(0, 2).filter((item, index) => index === 0 || item.kind !== approved[0]?.kind);
  const evidenceIds = supporting.map((item) => item.id);
  const draftAnswer = supporting.length
    ? /describe a time|tell (?:us|me) about|difficult customer/i.test(prompt)
      ? `A relevant example from my approved experience is: ${supporting.map((item) => item.detail).join("; ")}. I would refine this with the specific situation, action I personally took, and the verified result before submitting.`
      : `What draws me to this opportunity is the chance to apply experience I can substantiate: ${supporting.map((item) => item.detail).join("; ")}. That connection is more meaningful to me than making a broad claim I cannot prove.`
    : "I do not yet have approved dossier evidence to answer this honestly. Add or approve a relevant example before submitting.";
  return { id, prompt: prompt.trim(), draftAnswer, evidenceIds, userEdited: false };
}
