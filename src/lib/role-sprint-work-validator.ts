import type { RoleSprintType } from "@/types/command-center";

export type SprintArtifactValidation = { ok: true } | { ok: false; error: string };

function contentLines(value: string): string[] {
  return value.split(/\r?\n+/).map((line) => line.trim()).filter(Boolean);
}

function hasUrl(value: string): boolean {
  return /https?:\/\/\S+/i.test(value);
}

export function validateSprintArtifact(userWork: string, sprintType: RoleSprintType): SprintArtifactValidation {
  const text = userWork.trim();
  const lines = contentLines(text);

  if (sprintType === "build") {
    const structured = lines.length >= 4 && /\b(column|field|section|template|query|select|from|where|formula|step|input|output|metric|table|dashboard|report)\b/i.test(text);
    if (!hasUrl(text) && !structured) {
      return { ok: false, error: "Paste the artifact itself, its full structure, or a working link. A description of what you would build is not enough." };
    }
  }

  if (sprintType === "evaluate") {
    const hasRubric = /\b(rubric|criteria|check|score)\b/i.test(text);
    const hasVerdict = /\b(pass|fail|verdict|finding|meets|misses)\b/i.test(text);
    const hasFix = /\b(fix|recommend|improve|change|next step)\b/i.test(text);
    if (!(hasRubric && hasVerdict && hasFix)) {
      return { ok: false, error: "Include the scenario, evaluation criteria, verdicts, and the most important fix so the work can be judged." };
    }
  }

  if (sprintType === "plan") {
    const ordered = lines.length >= 4 || /(?:^|\n)\s*(?:\d+[.)]|[-*•])\s+/m.test(text);
    const doneCondition = /\b(done|complete|success|measure|verify|checkpoint|result)\b/i.test(text);
    const risk = /\b(risk|fail|warning|wrong|block|catch|watch)\b/i.test(text);
    if (!(ordered && doneCondition && risk)) {
      return { ok: false, error: "Include ordered steps, observable done conditions, and the main risks or early-warning checks." };
    }
  }

  if (sprintType === "simulate") {
    const hasScenario = /\b(scenario|situation|customer|client|stakeholder|context)\b/i.test(text);
    const hasResponse = /\b(response|message|reply|action|step|would send|would do)\b/i.test(text);
    const hasDebrief = /\b(debrief|priorit|deliberately|watch for|next|reason)\b/i.test(text);
    if (!(hasScenario && hasResponse && hasDebrief)) {
      return { ok: false, error: "Include the scenario, your full response, and a short debrief explaining your priorities and what you would watch next." };
    }
  }

  if (sprintType === "explain") {
    const words = text.split(/\s+/).filter(Boolean).length;
    const examples = (text.match(/\b(example|situation|first|second|third|when|case)\b/gi) ?? []).length;
    if (words < 80 || examples < 2) {
      return { ok: false, error: "Explain the idea in enough depth to defend it, then include at least two concrete situations or examples." };
    }
  }

  return { ok: true };
}
