"use client";

import { useMemo, useState } from "react";
import { CommandNav } from "@/components/CommandNav";
import { LockedFeaturePanel } from "@/components/LockedFeature";
import { SiteFooter } from "@/components/SiteFooter";
import { MAX_OUTREACH_FOLLOW_UPS, OUTREACH_FOLLOW_UP_DAYS, addDays, isDue } from "@/lib/command-center-insights";
import { useEntitlement } from "@/lib/entitlement";
import { createId } from "@/lib/command-center-store";
import { relationshipPhrases } from "@/lib/input-guidance";
import { fillTemplate, outreachTemplates, remainingPlaceholders } from "@/lib/outreach-templates";
import { useCommandCenter } from "@/lib/use-command-center";
import type { OutreachChannel, OutreachContact, OutreachStatus } from "@/types/command-center";

const channelLabels: Record<OutreachChannel, string> = {
  linkedin: "LinkedIn",
  email: "Email",
  recruiter: "Recruiter",
  referral: "Referral",
  community: "Community",
  other: "Other"
};

const statusLabels: Record<OutreachStatus, string> = {
  planned: "Planned",
  sent: "Sent",
  replied: "Replied",
  meeting_booked: "Meeting booked",
  dormant: "Dormant"
};

const statusStyles: Record<OutreachStatus, string> = {
  planned: "border-white/25 text-paper/60",
  sent: "border-cyan/50 bg-cyan/10 text-cyan",
  replied: "border-gold/50 bg-gold/10 text-gold",
  meeting_booked: "border-spruce/60 bg-mint/10 text-mint",
  dormant: "border-white/20 text-paper/40"
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function OutreachPage() {
  const { state, update, hydrated } = useCommandCenter();
  const { hasFeature } = useEntitlement();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [channel, setChannel] = useState<OutreachChannel>("linkedin");
  const [relationshipKey, setRelationshipKey] = useState("");
  const [nameIssue, setNameIssue] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState(outreachTemplates[0].key);
  const [templateContactId, setTemplateContactId] = useState("");
  const [copied, setCopied] = useState(false);
  const nowIso = useMemo(() => new Date().toISOString(), []);

  const activeLane = state.lanes.find((lane) => lane.status === "active") ?? state.lanes[0] ?? null;
  const template = outreachTemplates.find((item) => item.key === templateKey) ?? outreachTemplates[0];
  const templateContact = state.outreach.find((contact) => contact.id === templateContactId) ?? null;
  const renderedTemplate = fillTemplate(template, {
    contact: templateContact,
    lane: activeLane,
    profile: state.profile
  });
  const placeholders = remainingPlaceholders(renderedTemplate);

  function addContact() {
    if (!name.trim()) {
      setNameIssue("Add at least the contact's name — even \"Recruiter at Acme\" works until you find the real one.");
      return;
    }
    setNameIssue(null);
    const relationship = relationshipPhrases.find((item) => item.key === relationshipKey) ?? null;
    update((current) => ({
      ...current,
      outreach: [
        ...current.outreach,
        {
          id: createId("contact"),
          name: name.trim(),
          company: company.trim(),
          role: role.trim(),
          channel,
          status: "planned",
          laneId: activeLane?.id ?? null,
          lastContactedAt: null,
          nextFollowUpAt: null,
          followUpCount: 0,
          notes: relationship ? relationship.note : "",
          createdAt: new Date().toISOString()
        }
      ]
    }));
    // Point the template picker at the message that fits this relationship.
    if (relationship) setTemplateKey(relationship.templateKey);
    setName("");
    setCompany("");
    setRole("");
    setRelationshipKey("");
  }

  function patchContact(id: string, patch: Partial<OutreachContact>) {
    update((current) => ({
      ...current,
      outreach: current.outreach.map((contact) => (contact.id === id ? { ...contact, ...patch } : contact))
    }));
  }

  function setStatus(contact: OutreachContact, status: OutreachStatus) {
    const now = new Date().toISOString();
    const patch: Partial<OutreachContact> = { status };
    if (status === "sent") {
      patch.lastContactedAt = now;
      patch.nextFollowUpAt =
        contact.followUpCount < MAX_OUTREACH_FOLLOW_UPS ? addDays(now, OUTREACH_FOLLOW_UP_DAYS) : null;
    }
    if (status === "replied" || status === "meeting_booked" || status === "dormant") {
      patch.nextFollowUpAt = null;
    }
    patchContact(contact.id, patch);
  }

  function logFollowUpSent(contact: OutreachContact) {
    const now = new Date().toISOString();
    const nextCount = contact.followUpCount + 1;
    patchContact(contact.id, {
      followUpCount: nextCount,
      lastContactedAt: now,
      nextFollowUpAt: nextCount < MAX_OUTREACH_FOLLOW_UPS ? addDays(now, OUTREACH_FOLLOW_UP_DAYS) : null,
      status: nextCount >= MAX_OUTREACH_FOLLOW_UPS ? "dormant" : "sent"
    });
  }

  function removeContact(id: string) {
    update((current) => ({
      ...current,
      outreach: current.outreach.filter((contact) => contact.id !== id)
    }));
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(renderedTemplate);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; user can select the text manually.
    }
  }

  return (
    <main>
      <CommandNav active="/outreach" />

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Step 05 · Outreach</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Get out of the resume pile.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          Applications alone put you in a stack of hundreds. A short, specific message to a recruiter or hiring manager
          puts a person behind your name. The system here is simple: send, follow up once after{" "}
          {OUTREACH_FOLLOW_UP_DAYS} days, follow up a second time, then move on. No spam, no vanity networking.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid content-start gap-6">
            <div className="trust-panel flex flex-wrap items-end gap-3 p-5">
              <label className="min-w-36 flex-1">
                <span className="text-sm font-bold text-paper">Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Contact name"
                  className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
                />
              </label>
              <label className="min-w-36 flex-1">
                <span className="text-sm font-bold text-paper">Company</span>
                <input
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder="Company"
                  className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
                />
              </label>
              <label className="min-w-36 flex-1">
                <span className="text-sm font-bold text-paper">Their role</span>
                <input
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  placeholder="e.g., Recruiter"
                  className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
                />
              </label>
              <label className="min-w-32">
                <span className="text-sm font-bold text-paper">Channel</span>
                <select
                  value={channel}
                  onChange={(event) => setChannel(event.target.value as OutreachChannel)}
                  className="trust-input mt-2 w-full border px-3 py-2.5 text-sm text-ink"
                >
                  {Object.entries(channelLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={addContact}
                className="rounded-md bg-gold px-5 py-2.5 text-sm font-black text-ink transition hover:bg-cyan"
              >
                Add contact
              </button>
              <div className="w-full">
                <span className="text-xs font-bold text-paper/70">How do you know them?</span>
                <span className="ml-1.5 text-xs text-paper/45">Sets the right message template and gets saved in plain language.</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {relationshipPhrases.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setRelationshipKey(relationshipKey === item.key ? "" : item.key)}
                      className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                        relationshipKey === item.key
                          ? "border-gold/50 bg-gold/10 text-gold"
                          : "border-white/15 bg-white/5 text-paper/60 hover:border-cyan hover:text-cyan"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {nameIssue && <p className="mt-2 text-xs leading-5 text-gold">{nameIssue}</p>}
              </div>
            </div>

            {hydrated && !state.outreach.length && (
              <div className="rounded-xl border border-cyan/25 bg-cyan/10 p-5 text-sm leading-6 text-paper/72">
                <p>
                  No contacts yet. Start with companies you’ve already applied to: find the recruiter or a team member
                  on LinkedIn, add them here, and use the hiring-manager template. Warm-ish beats cold.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRole("Recruiter");
                    setChannel("recruiter");
                    setRelationshipKey("applied");
                    const applied = state.applications.find((app) => app.status === "applied" || app.status === "interviewing");
                    if (applied && applied.company !== "Unknown company") setCompany(applied.company);
                  }}
                  className="mt-3 rounded-md bg-cyan px-4 py-2 text-sm font-black text-ink transition hover:bg-gold"
                >
                  Start with a recruiter at a company I applied to
                </button>
              </div>
            )}

            {hydrated && state.outreach.length > 0 && (
              <div className="grid gap-3">
                {state.outreach.map((contact) => {
                  const followUpDue =
                    contact.status === "sent" &&
                    contact.followUpCount < MAX_OUTREACH_FOLLOW_UPS &&
                    isDue(contact.nextFollowUpAt, nowIso);
                  return (
                    <article key={contact.id} className={`trust-panel p-4 ${followUpDue ? "border-cyan/40" : ""}`}>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="mr-auto">
                          <h2 className="text-base font-bold text-paper">
                            {contact.name}
                            {contact.company && <span className="font-normal text-paper/55"> · {contact.company}</span>}
                          </h2>
                          <p className="lab-mono mt-1 text-[0.65rem] font-bold uppercase text-paper/45">
                            {channelLabels[contact.channel]}
                            {contact.role ? ` · ${contact.role}` : ""} · Last contact: {formatDate(contact.lastContactedAt)} ·
                            Follow-up: <span className={followUpDue ? "text-cyan" : ""}>{formatDate(contact.nextFollowUpAt)}</span>{" "}
                            ({contact.followUpCount}/{MAX_OUTREACH_FOLLOW_UPS} sent)
                          </p>
                          {contact.notes && <p className="mt-1 text-[0.72rem] leading-4 text-paper/55">{contact.notes}</p>}
                        </div>

                        <select
                          value={contact.status}
                          onChange={(event) => setStatus(contact, event.target.value as OutreachStatus)}
                          className={`lab-mono rounded-full border bg-obsidian/60 px-3 py-1.5 text-[0.65rem] font-bold uppercase ${statusStyles[contact.status]}`}
                        >
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>

                        {followUpDue && (
                          <button
                            type="button"
                            onClick={() => logFollowUpSent(contact)}
                            className="rounded-md bg-cyan px-3 py-1.5 text-xs font-black text-ink transition hover:bg-gold"
                          >
                            Follow-up sent
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => removeContact(contact.id)}
                          className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-paper/50 transition hover:border-coral hover:text-coral"
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="trust-panel h-fit p-5 sm:p-6">
            <h2 className="text-xl font-bold text-paper">Message templates</h2>
            <p className="mt-1 text-sm text-paper/60">
              Short on purpose. Personalize the [bracketed] parts — a generic message is worse than none.
            </p>

            <div className="mt-4 grid gap-3">
              <select
                value={templateKey}
                onChange={(event) => setTemplateKey(event.target.value)}
                className="trust-input w-full border px-3 py-2.5 text-sm text-ink"
              >
                {outreachTemplates.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-5 text-paper/55">{template.scenario}</p>

              {state.outreach.length > 0 && (
                <select
                  value={templateContactId}
                  onChange={(event) => setTemplateContactId(event.target.value)}
                  className="trust-input w-full border px-3 py-2.5 text-sm text-ink"
                >
                  <option value="">Fill for contact… (optional)</option>
                  {state.outreach.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                      {contact.company ? ` — ${contact.company}` : ""}
                    </option>
                  ))}
                </select>
              )}

              {hasFeature("outreach_toolkit") ? (
                <>
                  <pre className="whitespace-pre-wrap rounded-lg border border-white/12 bg-obsidian/50 p-4 font-sans text-sm leading-6 text-paper/85">
                    {renderedTemplate}
                  </pre>

                  {placeholders.length > 0 && (
                    <p className="text-xs leading-5 text-gold">
                      Still to personalize: {placeholders.join(", ")}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={copyTemplate}
                    className="rounded-md bg-gold px-4 py-2.5 text-sm font-black text-ink transition hover:bg-cyan"
                  >
                    {copied ? "Copied" : "Copy message"}
                  </button>
                </>
              ) : (
                <LockedFeaturePanel
                  feature="outreach_toolkit"
                  title="Ready-to-send recruiter and hiring-manager messages"
                  description="Each template is short, specific, and fills itself in from your saved contacts and lanes. Contact tracking above stays free — the message library comes with the Job Search Pack."
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
