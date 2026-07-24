import type { RoleSprintType } from "@/types/command-center";

export type SprintArtifactValidation = { ok: true } | { ok: false; error: string };
export type SprintArtifactCheck = { label: string; met: boolean };

function contentLines(value: string): string[] {
  return value.split(/\r?\n+/).map((line) => line.trim()).filter(Boolean);
}

function hasUrl(value: string): boolean {
  return /https?:\/\/\S+/i.test(value);
}

export function sprintArtifactChecks(userWork: string, sprintType: RoleSprintType): SprintArtifactCheck[] {
  const text = userWork.trim();
  const lines = contentLines(text);

  if (sprintType === "build") {
    const structured = lines.length >= 4 && /\b(column|field|section|template|query|select|from|where|formula|step|input|output|metric|table|dashboard|report)\b/i.test(text);
    const linked = hasUrl(text);
    const designExplanation = /\b(choice|chose|because|decid|defined|selected|included|tradeoff|improve|next time|with more time)\b/i.test(text);
    return [
      { label: "Artifact text, structure, or a working link included", met: linked || structured },
      // A URL may point anywhere. Require enough accompanying structure that a
      // reviewer can judge what was actually built without trusting the link.
      { label: "Fields, sections, steps, metrics, or query structure shown", met: structured },
      { label: "Design choices or next improvement explained", met: designExplanation }
    ];
  }

  if (sprintType === "evaluate") {
    return [
      { label: "Scenario included", met: /\b(scenario|example|sample|case|ticket|output)\b/i.test(text) },
      { label: "Rubric or evaluation criteria included", met: /\b(rubric|criteria|check|score)\b/i.test(text) },
      { label: "Verdict and reasoning included", met: /\b(pass|fail|verdict|finding|meets|misses)\b/i.test(text) && /\b(because|reason|why)\b/i.test(text) },
      { label: "Most important fix included", met: /\b(fix|recommend|improve|change|next step)\b/i.test(text) }
    ];
  }

  if (sprintType === "plan") {
    return [
      { label: "Ordered steps included", met: lines.length >= 4 || /(?:^|\n)\s*(?:\d+[.)]|[-*•])\s+/m.test(text) },
      { label: "Observable done conditions included", met: /\b(done|complete|success|measure|verify|checkpoint|result)\b/i.test(text) },
      { label: "Risks or early-warning checks included", met: /\b(risk|fail|warning|wrong|block|catch|watch)\b/i.test(text) }
    ];
  }

  if (sprintType === "simulate") {
    return [
      { label: "Scenario or context included", met: /\b(scenario|situation|customer|client|stakeholder|context)\b/i.test(text) },
      { label: "Full response or actions included", met: /\b(response|message|reply|action|step|would send|would do)\b/i.test(text) },
      { label: "Debrief and priorities included", met: /\b(debrief|priorit|deliberately|watch for|next|reason)\b/i.test(text) }
    ];
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  const examples = (text.match(/\b(example|situation|first|second|third|when|case)\b/gi) ?? []).length;
  return [
    { label: "Explanation is detailed enough to defend", met: words >= 80 },
    { label: "At least two concrete situations or examples included", met: examples >= 2 },
    { label: "Practical use is explained", met: /\b(apply|use|work|day-to-day|first month|decision)\b/i.test(text) }
  ];
}

export function validateSprintArtifact(userWork: string, sprintType: RoleSprintType): SprintArtifactValidation {
  const checks = sprintArtifactChecks(userWork, sprintType);
  const missing = checks.filter((check) => !check.met).map((check) => check.label);
  if (!missing.length) return { ok: true };
  return { ok: false, error: `Finish these parts before submitting: ${missing.join("; ")}.` };
}
