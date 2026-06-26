import type { RoleFamily } from "@/types/career";

export const aiToolCategories = {
  general: ["ChatGPT", "Claude", "Gemini", "Microsoft Copilot", "Perplexity", "Grok"],
  development: ["GitHub Copilot", "Cursor", "Windsurf", "OpenAI API", "Anthropic API", "Google AI Studio", "Continue.dev"],
  research: ["NotebookLM", "Elicit", "Consensus", "Semantic Scholar AI", "Perplexity"],
  automation: ["Zapier AI", "Make", "n8n", "Relay.app", "Lindy", "Relevance AI"],
  writingProductivity: ["Notion AI", "Grammarly AI", "Wispr Flow", "Raycast AI", "Granola", "Superhuman AI"],
  creative: ["Midjourney", "Adobe Firefly", "Leonardo AI", "Ideogram", "Runway", "Higgsfield"],
  voice: ["ElevenLabs", "Whisper", "AssemblyAI"]
};

export const aiToolOptions = Array.from(new Set(Object.values(aiToolCategories).flat()));

export const aiWorkflowOptions = [
  "Research",
  "Documentation",
  "Brainstorming",
  "Customer communication",
  "Coding assistance",
  "Debugging",
  "Resume writing",
  "Meeting summaries",
  "Knowledge management",
  "Workflow automation",
  "Prompt engineering",
  "Technical writing",
  "Data analysis",
  "Content creation",
  "Market research",
  "PRD writing",
  "Response drafting",
  "Template creation",
  "Reporting",
  "Process automation",
  "Script drafting",
  "Image generation",
  "Testing",
  "Code generation",
  "Project planning",
  "Rapid prototyping",
  "App development",
  "Quality assurance",
  "Translation"
];

export const aiWorkflowArsenalByContext: Record<string, string[]> = {
  developer: ["AI-assisted debugging", "Rapid prototyping", "Code generation", "Documentation", "Testing"],
  creator: ["Content ideation", "Script drafting", "Image generation", "Research", "Creative review"],
  founder: ["Market research", "PRD writing", "Workflow automation", "Meeting summaries", "Customer research"],
  "customer success": ["Knowledge retrieval", "Response drafting", "Documentation", "Customer communication", "Support workflow planning"],
  operations: ["Process automation", "Documentation", "Reporting", "Template creation", "Workflow planning"]
};

export const aiWorkflowSuggestionsByFamily: Record<RoleFamily, string[]> = {
  Tech: ["Coding assistance", "Debugging", "Documentation", "Rapid prototyping", "Quality assurance", "App development"],
  Business: ["Research", "Data analysis", "Documentation", "Knowledge management", "Meeting summaries", "Project planning"],
  Operations: ["Workflow automation", "Documentation", "Reporting", "Template creation", "Process planning", "Meeting summaries"],
  "Customer Success": ["Customer communication", "Knowledge management", "Documentation", "Research", "Meeting summaries", "Response drafting"],
  Admin: ["Documentation", "Meeting summaries", "Knowledge management", "Workflow automation", "Technical writing", "Translation"],
  Sales: ["Research", "Customer communication", "Content creation", "Documentation", "Meeting summaries", "Workflow automation"],
  Security: ["Documentation", "Technical writing", "Knowledge management", "Reporting", "Translation", "Research"],
  "Project Coordination": ["Project planning", "Meeting summaries", "Documentation", "Workflow automation", "Knowledge management", "Reporting"],
  "IT Support": ["Debugging", "Documentation", "Knowledge management", "Technical writing", "Workflow automation", "Quality assurance"]
};

export const aiAtsKeywordsByWorkflow: Record<string, string[]> = {
  Research: ["Generative AI", "Research Synthesis", "Knowledge Management"],
  Documentation: ["AI Productivity", "Documentation", "Knowledge Management"],
  Brainstorming: ["Generative AI", "AI Productivity"],
  "Customer communication": ["AI Productivity", "Documentation", "Customer Communication"],
  "Coding assistance": ["AI-assisted development", "Rapid Prototyping", "Documentation"],
  Debugging: ["AI-assisted development", "Quality Assurance", "Technical Documentation"],
  "Resume writing": ["AI Productivity", "Technical Writing"],
  "Meeting summaries": ["AI Productivity", "Knowledge Management", "Documentation"],
  "Knowledge management": ["Knowledge Management", "Research Synthesis", "AI Productivity"],
  "Workflow automation": ["Workflow Automation", "AI Productivity", "Process Improvement"],
  "Prompt engineering": ["Prompt Engineering", "Generative AI", "LLM"],
  "Technical writing": ["Technical Writing", "Documentation", "AI Productivity"],
  "Data analysis": ["Data Analysis", "Research Synthesis", "AI Productivity"],
  "Content creation": ["Content Creation", "Generative AI", "AI Productivity"],
  "Market research": ["Market Research", "Research Synthesis", "Generative AI"],
  "PRD writing": ["Product Documentation", "Technical Writing", "AI Productivity"],
  "Response drafting": ["Customer Communication", "AI Productivity", "Documentation"],
  "Template creation": ["Template Creation", "Workflow Automation", "Documentation"],
  Reporting: ["Reporting", "AI Productivity", "Documentation"],
  "Process automation": ["Process Improvement", "Workflow Automation", "AI Productivity"],
  "Script drafting": ["Content Creation", "Generative AI", "Technical Writing"],
  "Image generation": ["Image Generation", "Generative AI", "Content Creation"],
  Testing: ["Testing", "Quality Assurance", "AI-assisted development"],
  "Code generation": ["Code Generation", "AI-assisted development", "Rapid Prototyping"],
  "Project planning": ["Project Planning", "Workflow Automation", "AI Productivity"],
  "Rapid prototyping": ["Rapid Prototyping", "AI-assisted development", "Generative AI"],
  "App development": ["AI-assisted development", "Rapid Prototyping", "Documentation"],
  "Quality assurance": ["Quality Assurance", "Testing", "AI-assisted development"],
  Translation: ["Translation", "Documentation", "AI Productivity"]
};

export function isAiTool(tool: string) {
  const normalized = tool.trim().toLowerCase();
  return aiToolOptions.some((option) => option.toLowerCase() === normalized);
}

export function selectedAiTools(tools: string) {
  return tools
    .split(",")
    .map((tool) => tool.trim())
    .filter(Boolean)
    .filter(isAiTool);
}

export function normalizeAiWorkflow(workflow: string) {
  const normalized = workflow.trim().replace(/\s+/g, " ");
  const known = aiWorkflowOptions.find((option) => option.toLowerCase() === normalized.toLowerCase());
  return known ?? normalized;
}

export function buildAiAtsKeywords(workflows: string[]) {
  return Array.from(
    new Set(
      workflows.flatMap((workflow) => {
        const normalized = normalizeAiWorkflow(workflow);
        return aiAtsKeywordsByWorkflow[normalized] ?? [];
      })
    )
  );
}

export function getAiWorkflowArsenalForContext(context: string) {
  const normalized = context.toLowerCase();
  const matches = Object.entries(aiWorkflowArsenalByContext)
    .filter(([key]) => normalized.includes(key))
    .flatMap(([, workflows]) => workflows);
  if (/founder|operator|product lab|startup/.test(normalized)) matches.push(...aiWorkflowArsenalByContext.founder);
  if (/developer|engineer|software|technical|qa|app/.test(normalized)) matches.push(...aiWorkflowArsenalByContext.developer);
  if (/creator|content|media|design|video|script/.test(normalized)) matches.push(...aiWorkflowArsenalByContext.creator);
  if (/customer|support|success|service/.test(normalized)) matches.push(...aiWorkflowArsenalByContext["customer success"]);
  if (/operation|workflow|process|admin|coordinator/.test(normalized)) matches.push(...aiWorkflowArsenalByContext.operations);
  return Array.from(new Set(matches.map(normalizeAiWorkflow)));
}
