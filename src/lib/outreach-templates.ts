import type { CareerProfile, OutreachContact, TargetLane } from "@/types/command-center";

export type OutreachTemplate = {
  key: string;
  label: string;
  scenario: string;
  body: string;
};

// Templates are deliberately short. Recruiters skim; long first messages read
// as spam. Placeholders in [brackets] must be replaced before sending.
export const outreachTemplates: OutreachTemplate[] = [
  {
    key: "recruiter_intro",
    label: "Recruiter intro",
    scenario: "First message to a recruiter at a company you want to work for.",
    body: `Hi [Name] — I'm targeting [lane title] roles and [Company] is on my shortlist because [one specific reason].

My background is [one-line experience summary], and I bring [top transferable skill] with real results behind it.

If you have [lane title] openings now or soon, I'd love to be considered. Happy to send my resume tailored to a specific req.`
  },
  {
    key: "hiring_manager",
    label: "Hiring manager (active posting)",
    scenario: "You applied (or are about to) and found the likely hiring manager.",
    body: `Hi [Name] — I just applied for the [Role title] opening on your team.

Quick reason to pull my application out of the pile: [one specific, true match between your experience and the post — with a number if you have one].

I know you're busy; even a "we saw it" would be appreciated. Thanks either way.`
  },
  {
    key: "referral_request",
    label: "Referral request",
    scenario: "Someone you actually know (even loosely) works at the target company.",
    body: `Hey [Name] — hope you're doing well. I'm applying for the [Role title] role at [Company] and saw you're there.

No pressure at all, but if you're comfortable, a referral would mean a lot. I can send you my resume and a two-line blurb to make it zero-effort.

Either way, would love to hear how [Company] has been for you.`
  },
  {
    key: "informational",
    label: "Informational chat",
    scenario: "Someone doing the job you want — you're asking for insight, not a job.",
    body: `Hi [Name] — I'm moving into [lane title] work from a [current background] background, and your path at [Company] stood out.

I'm not asking about openings — I'd just value 15 minutes on what actually matters in your role and what you'd focus on if you were starting today.

Happy to work around your schedule, or async by message if that's easier.`
  },
  {
    key: "follow_up_1",
    label: "Follow-up #1",
    scenario: "4+ days of silence after your first message.",
    body: `Hi [Name] — floating this back up in case it got buried (it happens to all of us).

Still very interested in [Role title / lane title] at [Company]. One thing I didn't mention: [one new, true detail — a result, a relevant project, a reason for fit].

If the timing's wrong, no worries — a quick "not now" is genuinely useful too.`
  },
  {
    key: "follow_up_2",
    label: "Follow-up #2 (final)",
    scenario: "Second and last follow-up. After this, move on gracefully.",
    body: `Hi [Name] — last note from me, promise.

If [Role title / lane title] conversations open up at [Company] down the line, I'd love to be on your list. I'll keep an eye on your postings in the meantime.

Thanks for your time either way.`
  },
  {
    key: "application_bump",
    label: "Post-interview thank you",
    scenario: "Within 24 hours after an interview.",
    body: `Hi [Name] — thank you for the conversation today. [One specific thing discussed] made me more confident this is the right kind of problem for me.

One thing I want to reinforce: [your strongest true point of fit, one sentence].

Looking forward to next steps, whatever they are.`
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
    profile?: Pick<CareerProfile, "currentSituation"> | null;
  }
): string {
  let body = template.body;
  const { contact, lane, profile } = options;

  if (contact?.name?.trim()) body = body.replaceAll("[Name]", contact.name.trim());
  if (contact?.company?.trim()) body = body.replaceAll("[Company]", contact.company.trim());
  if (lane?.title?.trim()) {
    body = body.replaceAll("[lane title]", lane.title.trim());
    body = body.replaceAll("[Role title / lane title]", lane.title.trim());
  }
  if (profile?.currentSituation?.trim()) {
    body = body.replaceAll("[current background]", profile.currentSituation.trim());
  }
  return body;
}

export function remainingPlaceholders(body: string): string[] {
  return [...new Set(body.match(/\[[^\]]+\]/g) ?? [])];
}
