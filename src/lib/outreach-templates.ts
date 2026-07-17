import type { CareerProfile, OutreachContact, TargetLane } from "@/types/command-center";

export type OutreachTemplate = {
  key: string;
  label: string;
  scenario: string;
  body: string;
};

// Templates are deliberately short. They remain visibly incomplete until the
// user adds a real recipient, a specific reason, and approved evidence where
// the scenario calls for it. No template asserts results that the dossier does
// not contain.
export const outreachTemplates: OutreachTemplate[] = [
  {
    key: "recruiter_intro",
    label: "Recruiter intro",
    scenario: "First message to a recruiter at a company you want to work for.",
    body: `Hi [Name] — I'm targeting [lane title] roles, and [Company] is on my shortlist because [specific reason].

One piece of approved experience relevant to this work: [approved evidence].

If you have [lane title] openings now or soon, I'd be glad to send a résumé tailored to a specific requisition.`
  },
  {
    key: "hiring_manager",
    label: "Hiring manager (active posting)",
    scenario: "You applied, or are about to, and found the likely hiring manager.",
    body: `Hi [Name] — I just applied for the [Role title] opening on your team.

One specific match I can substantiate: [approved evidence].

I'm especially interested in [Company] because [specific reason]. Thanks for taking a look.`
  },
  {
    key: "referral_request",
    label: "Referral request",
    scenario: "Someone you actually know, even loosely, works at the target company.",
    body: `Hey [Name] — hope you're doing well. I'm applying for the [Role title] role at [Company].

No pressure at all, but if you're comfortable, a referral would mean a lot. I can send my résumé and a two-line, evidence-backed blurb to make it easy.

Either way, I'd value your honest read on the team.`
  },
  {
    key: "informational",
    label: "Informational chat",
    scenario: "Someone doing the job you want; you are asking for insight, not a job.",
    body: `Hi [Name] — I'm moving toward [lane title] work from [current background], and your path at [Company] stood out because [specific reason].

I'm not asking about openings. I'd value 15 minutes on what actually matters in your role and what you would focus on if you were starting today.

Happy to work around your schedule, or async by message if that's easier.`
  },
  {
    key: "follow_up_1",
    label: "Follow-up #1",
    scenario: "Four or more days of silence after your first message.",
    body: `Hi [Name] — following up in case my earlier note got buried.

I'm still interested in [Role title] at [Company]. One relevant detail I can substantiate: [approved evidence].

If the timing is wrong, no worries. A quick "not now" is useful too.`
  },
  {
    key: "follow_up_2",
    label: "Follow-up #2 (final)",
    scenario: "Second and last follow-up. After this, move on gracefully.",
    body: `Hi [Name] — last note from me.

If [Role title] conversations open at [Company] later, I'd be glad to be considered. I'll keep an eye on your postings in the meantime.

Thanks for your time either way.`
  },
  {
    key: "application_bump",
    label: "Post-interview thank you",
    scenario: "Within 24 hours after an interview.",
    body: `Hi [Name] — thank you for the conversation today. [one specific thing discussed] made me more confident this is the right kind of work for me.

One point I want to reinforce with approved evidence: [approved evidence].

I appreciate your time and look forward to the next step.`
  }
];

export function getTemplate(key: string): OutreachTemplate | undefined {
  return outreachTemplates.find((template) => template.key === key);
}

export function fillTemplate(
  template: OutreachTemplate,
  options: {
    contact?: Pick<OutreachContact, "name" | "company" | "role"> | null;
    lane?: Pick<TargetLane, "title"> | null;
    profile?: Pick<CareerProfile, "currentSituation" | "experienceSummary" | "proofPoints"> | null;
    specificReason?: string;
    approvedEvidence?: string;
  }
): string {
  let body = template.body;
  const { contact, lane, profile } = options;
  const roleTitle = lane?.title?.trim() || "";
  const approvedEvidence = options.approvedEvidence?.trim() || profile?.proofPoints
    ?.split(/\r?\n|;/)
    .map((item) => item.trim())
    .find(Boolean) || "";
  const background = profile?.experienceSummary?.trim() || profile?.currentSituation?.trim() || "";

  if (contact?.name?.trim()) body = body.replaceAll("[Name]", contact.name.trim());
  if (contact?.company?.trim()) body = body.replaceAll("[Company]", contact.company.trim());
  if (roleTitle) {
    body = body.replaceAll("[lane title]", roleTitle);
    body = body.replaceAll("[Role title]", roleTitle);
    body = body.replaceAll("[Role title / lane title]", roleTitle);
  }
  if (background) body = body.replaceAll("[current background]", background);
  if (options.specificReason?.trim()) body = body.replaceAll("[specific reason]", options.specificReason.trim());
  if (approvedEvidence) body = body.replaceAll("[approved evidence]", approvedEvidence);
  return body;
}

export function remainingPlaceholders(body: string): string[] {
  return [...new Set(body.match(/\[[^\]]+\]/g) ?? [])];
}
