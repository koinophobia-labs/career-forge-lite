import { matchRequirement } from "@/lib/job-post-analyzer";
import type { ApplicationRecord, CareerProfile, TargetLane } from "@/types/command-center";
import type { CareerDossier, DossierEvidenceRecord } from "@/types/dossier";

export type PrepCategory = "role" | "behavioral" | "gap_defense" | "transition";

export type PrepQuestion = {
  id: string;
  category: PrepCategory;
  question: string;
  why: string;
  coaching: string[];
  basedOn: string;
};

// Questions the candidate asks the interviewer. No practice/coaching UI —
// they are a checklist to bring, so they are a separate shape from PrepQuestion.
export type ReverseQuestion = {
  question: string;
  why: string;
  basedOn: string;
};

export type InterviewPrepPack = {
  laneTitle: string | null;
  applicationLabel: string | null;
  questions: PrepQuestion[];
  reverseQuestions: ReverseQuestion[];
  answerFramework: string[];
  honestyNote: string;
};

export type CoachingFeedback = {
  tone: "good" | "fix";
  message: string;
};

export const ANSWER_FRAMEWORK = [
  "Situation — one sentence of context: where, when, what was at stake.",
  "Task — what you specifically were responsible for (say \"I\", not just \"we\").",
  "Action — the 2–3 concrete things you did, in order.",
  "Result — what changed, with a number or observable outcome if you have one.",
  "Bridge — one sentence connecting it to the role you're interviewing for."
];

export const HONESTY_NOTE =
  "Questions are built from your profile, lanes, approved evidence, and job-post analyses where you've added them; the generic staples every interviewer asks are labeled as generic. Practice honest answers: name real gaps, use real numbers, and never claim credentials, titles, or metrics you don't have. Interviewers probe — a truthful \"here's how I'd close that gap\" outlasts a bluff.";

// ---------------------------------------------------------------------------
// Role-specific question banks, keyed by lane. Matched against lane titles so
// both library lanes and similarly-named custom lanes get the right bank.
// ---------------------------------------------------------------------------

type RoleBankEntry = {
  pattern: RegExp;
  questions: Array<{ question: string; why: string; coaching: string[] }>;
};

const roleBanks: RoleBankEntry[] = [
  {
    pattern: /ai\s*support|ai\s*specialist/i,
    questions: [
      {
        question: "A user says the AI gave them a confidently wrong answer. Walk me through how you'd handle the ticket.",
        why: "Tests whether you understand hallucination and can keep a frustrated user calm without over-promising.",
        coaching: [
          "Show the sequence: acknowledge, reproduce the issue, explain plainly why models can be confidently wrong, offer a workaround, escalate with a clean repro.",
          "Use a real de-escalation story from your service work as the backbone — the AI part is vocabulary, the calm is proof."
        ]
      },
      {
        question: "How do you explain a model limitation — like a context window or knowledge cutoff — to a non-technical customer?",
        why: "The job is translation. They want plain language, not jargon recital.",
        coaching: [
          "Pick one limitation and actually explain it in two sentences a grandparent would follow.",
          "Mention how you check your own explanation landed: asking the user to confirm, offering a concrete example."
        ]
      },
      {
        question: "Tell me about how you use AI tools in your own work today.",
        why: "Daily fluency separates real candidates from keyword-matchers.",
        coaching: [
          "Describe an actual workflow you run — inputs, what the tool does, how you verify output.",
          "Verification is the differentiator: say how you catch the tool being wrong."
        ]
      },
      {
        question: "When would you escalate a ticket to the engineering team instead of resolving it yourself?",
        why: "Support teams live or die by escalation judgment.",
        coaching: [
          "Give a rule, not a vibe: reproducible bug, safety issue, or anything policy-ambiguous.",
          "Show you write escalations others can act on: steps to reproduce, expected vs. actual."
        ]
      }
    ]
  },
  {
    pattern: /trust\s*(&|and)\s*safety|t&s|content\s*moderation/i,
    questions: [
      {
        question: "A post sits in a policy gray area — it doesn't clearly violate the rules but feels harmful. What do you do?",
        why: "Gray-area judgment under a written policy is the core skill.",
        coaching: [
          "Anchor to process: check the written policy first, decide on the closest clause, document your reasoning, flag for policy review if the gap is real.",
          "Use a real example of applying rules consistently under pushback — retail returns, venue rules, anything true."
        ]
      },
      {
        question: "How would you handle reviewing disturbing content day after day?",
        why: "They ask this every time. Resilience without bravado is what they want.",
        coaching: [
          "Be honest about it being hard; name concrete habits — breaks, rotation, talking to someone, using wellness resources.",
          "Point to real high-volume, emotionally demanding work you've already sustained."
        ]
      },
      {
        question: "A user appeals your enforcement decision and they're furious. Walk me through your response.",
        why: "Tests consistency plus communication — can you hold a line kindly?",
        coaching: [
          "Structure: re-review with fresh eyes, explain the specific policy clause, don't take the anger personally, escalate if the appeal reveals real ambiguity.",
          "A true story of enforcing an unpopular rule fairly is worth more than theory."
        ]
      },
      {
        question: "How do you keep your decisions consistent across hundreds of similar cases?",
        why: "Consistency is measurable in this job; they want your mechanism.",
        coaching: [
          "Name mechanisms: decision logs, checklists, calibration against examples, asking when unsure instead of drifting.",
          "Quantify any accuracy or compliance track record you actually have."
        ]
      }
    ]
  },
  {
    pattern: /fraud|risk\s*op|chargeback/i,
    questions: [
      {
        question: "A transaction looks suspicious but the account has a clean two-year history. Block it or let it through?",
        why: "Fraud ops is trading false positives against losses — they want to hear you weigh both.",
        coaching: [
          "Reason out loud: what signals matter, what extra data you'd check, when friction (step-up verification) beats a hard block.",
          "Tie it to real discrepancy-catching you've done — reconciliation, returns fraud, billing errors."
        ]
      },
      {
        question: "Tell me about a time you caught an error or loss that others missed.",
        why: "Direct proof of the core aptitude: pattern recognition plus follow-through.",
        coaching: [
          "Name what made you look twice, the check you ran, and what it protected — with a number if true.",
          "Process matters as much as the catch: show you documented and reported it properly."
        ]
      },
      {
        question: "How would you write up a fraud case so someone else could act on it?",
        why: "The daily artifact of this job is the case note.",
        coaching: [
          "Structure: facts observed, timeline, evidence, your assessment, recommended action — clearly separated.",
          "Emphasize factual over speculative language; say why that separation matters."
        ]
      },
      {
        question: "What fraud patterns do you know about, and how did you learn them?",
        why: "Checks whether you've done the self-study the lane plan calls for.",
        coaching: [
          "Only name typologies you can actually explain — account takeover, friendly fraud, synthetic identity.",
          "Saying \"I've been studying X and here's what I understand so far\" is honest and lands well."
        ]
      }
    ]
  },
  {
    pattern: /community/i,
    questions: [
      {
        question: "Two long-time community members are publicly fighting and other members are taking sides. What do you do?",
        why: "Public conflict resolution is the job at its hardest.",
        coaching: [
          "Sequence: cool the public thread fast, move the parties private, apply rules evenly regardless of status, post a calm public close-out.",
          "A true story of defusing conflict in front of an audience — regulars, customers, a group chat — is your proof."
        ]
      },
      {
        question: "How would you turn community complaints into something the product team can use?",
        why: "Community managers are a signal pipeline, not just hosts.",
        coaching: [
          "Show the loop: collect, deduplicate, quantify (how many, how often), translate feelings into specific product asks.",
          "Any real example of routing feedback to a decision counts, even informal ones."
        ]
      },
      {
        question: "What community have you built or grown, and what did you learn from it?",
        why: "They want evidence you can hold a room over time.",
        coaching: [
          "Numbers help: members, retention, event turnout. Use real ones only.",
          "Include one thing that failed and what you changed — it reads as experience, not luck."
        ]
      }
    ]
  },
  {
    pattern: /product\s*support/i,
    questions: [
      {
        question: "A customer reports something 'broken' but you can't reproduce it. Walk me through your next steps.",
        why: "Methodical diagnosis under ambiguity is the core skill.",
        coaching: [
          "Show a method: exact steps and environment, screenshots or recordings, isolate variables, check known issues, set expectations while you dig.",
          "Say what you do when it's still unreproducible — you don't just close it."
        ]
      },
      {
        question: "How do you handle a queue when tickets are coming in faster than you can resolve them?",
        why: "Volume management with quality is what support leads screen for.",
        coaching: [
          "Name your triage rule: severity and breadth first, quick wins batched, honest holding replies for the rest.",
          "Quantify your real throughput from any high-volume work — customers, calls, orders per day."
        ]
      },
      {
        question: "Tell me about a time you turned an angry customer into a satisfied one.",
        why: "The universal support question — they want the mechanics, not the happy ending.",
        coaching: [
          "Break down the de-escalation: acknowledge, own what you can, give a concrete next step with a time.",
          "End with the result and what it taught you about prevention."
        ]
      },
      {
        question: "How would you write a help-center article for a feature you just learned yourself?",
        why: "Support is a writing job; fresh eyes are actually an asset.",
        coaching: [
          "Structure: what the reader wants to do, numbered steps, the one gotcha, where to go if stuck.",
          "Mention testing your own steps before publishing."
        ]
      }
    ]
  },
  {
    pattern: /\bqa\b|quality\s*assurance|tester/i,
    questions: [
      {
        question: "Write me a bug report, out loud, for a login button that sometimes doesn't respond.",
        why: "'Sometimes' is the trap — they want reproduction discipline.",
        coaching: [
          "Structure: environment, exact steps, expected vs. actual, frequency, evidence. Say how you'd narrow down 'sometimes' — timing, device, network.",
          "If you've written practice bug reports, say so and describe one."
        ]
      },
      {
        question: "You have one hour to test a new signup form. What do you check?",
        why: "Tests edge-case instinct and prioritization, not tool knowledge.",
        coaching: [
          "Prioritize: happy path first, then required-field abuse, weird inputs, browser/device spread, and what happens on failure.",
          "Naming what you'd deliberately skip in an hour shows real judgment."
        ]
      },
      {
        question: "Developers say your bug is 'working as intended.' You disagree. What now?",
        why: "QA needs spine plus diplomacy.",
        coaching: [
          "Re-check the requirement, argue from user impact not opinion, accept the call once it's made and get it documented.",
          "A real story of disagreeing with a process at work — respectfully and with evidence — maps directly."
        ]
      },
      {
        question: "What's the difference between a smoke test and a regression test — in your own words?",
        why: "Vocabulary check from the lane's gap list; they want understanding, not the textbook.",
        coaching: [
          "Explain it with an analogy from work you've actually done — opening checks vs. full inventory audit.",
          "If you learned this recently, say so; self-teaching the vocabulary is the point."
        ]
      }
    ]
  },
  {
    pattern: /product\s*op/i,
    questions: [
      {
        question: "A launch checklist has 20 items, 3 owners, and a deadline in two days. How do you run it?",
        why: "Product ops is making processes actually happen.",
        coaching: [
          "Show the mechanics: single tracker, owner and date per item, blockers surfaced daily, escalate slipping items early.",
          "Use a real coordination story — shifts, events, closings — with the before/after difference."
        ]
      },
      {
        question: "How would you clean up a feedback backlog of 400 unsorted items?",
        why: "Data hygiene under volume — the unglamorous core of the role.",
        coaching: [
          "Sequence: define categories first, batch-sort, dedupe, quantify themes, deliver a top-10 with counts.",
          "Mention the tooling you'd actually use — spreadsheets, filters, pivots — at the level you truly know."
        ]
      },
      {
        question: "Tell me about a process you built or fixed. What was broken and what changed?",
        why: "Direct proof of process ownership.",
        coaching: [
          "Before/after with a number: time saved, errors reduced, steps removed.",
          "Say who else had to adopt it and how you got them to."
        ]
      }
    ]
  },
  {
    pattern: /customer\s*success/i,
    questions: [
      {
        question: "A customer's usage has dropped 60% but they haven't complained. What do you do?",
        why: "Proactive saves are what separate CS from support.",
        coaching: [
          "Show proactivity: spot the signal, do homework before reaching out, lead with curiosity not a pitch, bring one concrete idea.",
          "Map it to a real save: a regular you noticed drifting and won back."
        ]
      },
      {
        question: "How do you handle a renewal conversation when the customer had a rough quarter with the product?",
        why: "Honesty under commercial pressure — they're screening for trustworthiness.",
        coaching: [
          "Own the rough patch specifically, show what changed, then make the value case — in that order.",
          "Never minimize real problems; name a time honesty kept a customer's trust."
        ]
      },
      {
        question: "What's the difference between a satisfied customer and a successful one?",
        why: "Tests whether you get outcome-orientation, the CS mindset shift.",
        coaching: [
          "Satisfied = happy with you; successful = getting measurable value. Give one example of driving the second.",
          "Use CS vocabulary you've studied — adoption, health score — only where you can defend it."
        ]
      }
    ]
  },
  {
    pattern: /technical\s*support|help\s*desk|it\s*support/i,
    questions: [
      {
        question: "A user says 'the internet is down' but you can see the network is fine. Walk me through your diagnosis.",
        why: "Classic isolate-the-variable test plus patience with vague reports.",
        coaching: [
          "Voice the funnel: one device or all, wired or wireless, can they reach anything, when did it last work — narrowing each step.",
          "Show you keep the user informed while you work; silence reads as incompetence."
        ]
      },
      {
        question: "Explain a technical fix you made to three audiences: an engineer, a coworker, and someone's grandparent.",
        why: "Straight from the lane's gap plan — communication range is the hiring bar.",
        coaching: [
          "Actually do all three in the interview, one or two sentences each. Practice this out loud beforehand.",
          "Pick a fix you genuinely made, however small; authenticity shows."
        ]
      },
      {
        question: "What do you do when you hit a problem you've never seen before?",
        why: "Entry technical roles are 80% unknown problems; method beats memory.",
        coaching: [
          "Give your real method: reproduce, search internal docs then external, isolate, timebox, then escalate with everything documented.",
          "A story of self-teaching a fix — home lab, family IT, side project — is exactly the proof they want."
        ]
      }
    ]
  }
];

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function makeId(category: PrepCategory, index: number): string {
  return `${category}-${index}`;
}

function approvedEvidence(dossier?: CareerDossier | null): DossierEvidenceRecord[] {
  return dossier?.evidence.filter((item) => item.approved && !item.rejected) ?? [];
}

const QUANTIFIED = /[\d$%]/;

function truncateClaim(text: string, max = 110): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

// Matcher fallback when a caller has a dossier but no profile: matchRequirement
// only consults the profile when the dossier has no approved records.
const EMPTY_PREP_PROFILE: CareerProfile = {
  currentSituation: "",
  targetRoles: "",
  transferableSkills: [],
  experienceSummary: "",
  strengths: [],
  constraints: "",
  workStyle: "",
  proofPoints: "",
  updatedAt: null
};

// When a saved application is selected, its lane wins over the active-lane
// default — prep should target the role actually being interviewed, not the
// last lane the user happened to activate. An explicit lane choice still
// overrides ("none" or a lane id the application doesn't use).
export function resolvePrepLane(
  lanes: TargetLane[],
  explicitLaneId: string | null,
  application: ApplicationRecord | null,
  fallbackLane: TargetLane | null
): TargetLane | null {
  if (explicitLaneId !== null) return lanes.find((lane) => lane.id === explicitLaneId) ?? null;
  if (application?.laneId) {
    const applicationLane = lanes.find((lane) => lane.id === application.laneId);
    if (applicationLane) return applicationLane;
  }
  return fallbackLane;
}

function splitProofPoints(proofPoints: string): string[] {
  return proofPoints
    .split(/\r?\n|;|(?<=[.!?])\s+/)
    .map((item) => item.trim().replace(/^[-*•]\s*/, "").replace(/[.;]\s*$/, ""))
    .filter((item) => item.length >= 15);
}

export function getRoleQuestions(laneTitle: string): Array<{ question: string; why: string; coaching: string[] }> {
  const bank = roleBanks.find((entry) => entry.pattern.test(laneTitle));
  return bank ? bank.questions : [];
}

function buildRoleQuestions(lane: TargetLane): PrepQuestion[] {
  const bank = getRoleQuestions(lane.title);
  const questions: PrepQuestion[] = bank.map((entry, index) => ({
    id: makeId("role", index),
    category: "role",
    question: entry.question,
    why: entry.why,
    coaching: entry.coaching,
    basedOn: `${lane.title} question bank`
  }));

  if (!questions.length) {
    // Custom lane without a bank: build from the lane's own keywords.
    const keywords = lane.keywords.filter((keyword) => keyword.trim()).slice(0, 2);
    keywords.forEach((keyword, index) => {
      questions.push({
        id: makeId("role", index),
        category: "role",
        question: `This role leans heavily on ${keyword}. What's your strongest real example of it?`,
        why: `"${keyword}" is a keyword you attached to this lane — expect it to come up.`,
        coaching: [
          "Pick one concrete story and run it through the answer framework — don't list three shallow ones.",
          "If your example comes from outside tech, bridge it explicitly: same skill, new context."
        ],
        basedOn: `Lane keyword: "${keyword}"`
      });
    });
  }

  return questions;
}

function buildBehavioralQuestions(profile: CareerProfile, dossier?: CareerDossier | null): PrepQuestion[] {
  const questions: PrepQuestion[] = [];
  let index = 0;
  const seen = new Set<string>();
  const claimKey = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

  // Approved dossier evidence first: metrics and achievements are the claims
  // interviewers deep-dive hardest, so each one seeds its own STAR question,
  // quantified proof ranked on top. This is what makes the import path as
  // well-covered as the hand-typed profile path.
  const dossierClaims = approvedEvidence(dossier)
    .filter(
      (item) =>
        item.kind === "metric" ||
        item.kind === "proof" ||
        item.kind === "story" ||
        (item.kind === "responsibility" && QUANTIFIED.test(item.detail))
    )
    .filter((item) => item.detail.trim().length >= 15)
    .sort((a, b) => Number(QUANTIFIED.test(b.detail)) - Number(QUANTIFIED.test(a.detail)))
    .slice(0, 5);
  for (const record of dossierClaims) {
    const claim = truncateClaim(record.detail);
    if (seen.has(claimKey(claim))) continue;
    seen.add(claimKey(claim));
    questions.push({
      id: makeId("behavioral", index++),
      category: "behavioral",
      question: `Your approved evidence says: "${claim}". Walk me through the story behind it — what was your specific part, and what changed because of you?`,
      why: QUANTIFIED.test(record.detail)
        ? "Quantified claims draw the hardest probing — interviewers test whether the number survives a follow-up."
        : "Anything in your dossier can end up on your resume, and anything on your resume is fair game for a deep-dive.",
      coaching: [
        "Know this story cold: the situation, your specific actions, the honest result. Rehearse it out loud once.",
        "If part of the claim is shared credit, say which part was yours — interviewers respect precision."
      ],
      basedOn: `Approved evidence (${record.kind})`
    });
  }

  for (const proof of splitProofPoints(profile.proofPoints).slice(0, 3)) {
    if (seen.has(claimKey(proof))) continue;
    seen.add(claimKey(proof));
    questions.push({
      id: makeId("behavioral", index++),
      category: "behavioral",
      question: `Your resume mentions: "${proof}". Walk me through it — what exactly was your role, and what changed because of you?`,
      why: "Anything on your resume is fair game for a deep-dive. Interviewers probe proof points to see if they hold up.",
      coaching: [
        "Know this story cold: the situation, your specific actions, the honest result. Rehearse it out loud once.",
        "If part of the claim is shared credit, say which part was yours — interviewers respect precision."
      ],
      basedOn: "Profile proof point"
    });
  }

  for (const strength of profile.strengths.filter((item) => item.trim()).slice(0, 2)) {
    questions.push({
      id: makeId("behavioral", index++),
      category: "behavioral",
      question: `You'd describe yourself as "${strength}". Give me a specific time that was tested.`,
      why: "Claimed strengths invite counter-probing. A strength without a story reads as filler.",
      coaching: [
        "Pick a moment where the strength was hard to maintain — that's what 'tested' means.",
        "Keep it under 90 seconds and end with the outcome."
      ],
      basedOn: `Profile strength: "${strength}"`
    });
  }

  for (const skill of profile.transferableSkills.filter((item) => item.trim()).slice(0, 2)) {
    questions.push({
      id: makeId("behavioral", index++),
      category: "behavioral",
      question: `Tell me about a time your ${skill} directly changed an outcome.`,
      why: `"${skill}" is a transferable skill you're selling — expect to be asked for evidence.`,
      coaching: [
        "Choose the example with a measurable or observable result, even a small one.",
        "Name the skill explicitly in your answer so the interviewer checks the box."
      ],
      basedOn: `Transferable skill: "${skill}"`
    });
  }

  return questions;
}

// Stored analysisGaps merge PARTIAL and GAP verdicts, so each one is
// re-verified against current approved evidence before prep asserts anything:
// covered requirements are dropped (asserting a gap the user doesn't have is a
// false concession), partial ones get honest bridge phrasing, and "not covered"
// is only stated when the evidence genuinely lacks it.
export function buildGapDefenseQuestions(
  lane: TargetLane | null,
  application: ApplicationRecord | null,
  dossier?: CareerDossier | null,
  profile?: CareerProfile
): PrepQuestion[] {
  const questions: PrepQuestion[] = [];
  let index = 0;
  const evidenceById = new Map(approvedEvidence(dossier).map((item) => [item.id, item]));
  const matcherProfile = profile ?? EMPTY_PREP_PROFILE;
  const canVerify = evidenceById.size > 0;

  const analysisGaps = (application?.analysisGaps ?? []).slice(0, 4);
  for (const gap of analysisGaps) {
    const verdict = canVerify ? matchRequirement(gap, matcherProfile, dossier) : null;
    if (verdict?.status === "covered") continue;
    const company = application?.company || "this application";

    if (verdict?.status === "partial") {
      const proofDetail = verdict.evidenceIds.map((id) => evidenceById.get(id)?.detail).find(Boolean);
      questions.push({
        id: makeId("gap_defense", index++),
        category: "gap_defense",
        question: `The posting asks for: "${gap}". Your strongest related proof is ${
          proofDetail ? `"${truncateClaim(proofDetail)}"` : "related work in your dossier"
        } — how do you bridge from there to what they need?`,
        why: `${verdict.evidence} Expect the interviewer to probe the part your evidence doesn't reach.`,
        coaching: [
          "Don't concede a gap you don't have: open with the real proof, sized honestly.",
          "Then name exactly what's left uncovered — a tool, the years, the domain — and the concrete step you're taking on it.",
          "Never claim the full qualification outright; bridge from verified experience instead."
        ],
        basedOn: `Job-post analysis (${company}) — partially covered by your evidence`
      });
      continue;
    }

    questions.push({
      id: makeId("gap_defense", index++),
      category: "gap_defense",
      question: verdict
        ? `The posting asks for: "${gap}" — and your approved evidence doesn't cover it. How do you respond when they raise it?`
        : `The posting asks for: "${gap}" — your dossier doesn't fully prove it yet. How do you respond when they raise it?`,
      why: `Your job-post analysis for ${company} flagged this as ${
        verdict ? "unsupported by your approved evidence" : "not fully proven"
      }. Assume the interviewer noticed too.`,
      coaching: [
        "Acknowledge it plainly first — one sentence, no squirming. Bluffing here is how offers die in reference checks.",
        "Then bridge: the closest real experience you have, plus the concrete step you're taking to close the gap.",
        "Never claim the credential or experience outright. \"I don't have X yet; here's my equivalent and my plan\" is a strong answer."
      ],
      basedOn: `Job-post analysis gap (${application?.company || "saved application"})`
    });
  }

  if (lane) {
    const laneGapLimit = questions.length ? 2 : 3;
    let laneGapCount = 0;
    for (const gap of lane.gaps) {
      if (laneGapCount >= laneGapLimit) break;
      // Lane gap templates can lag the dossier — skip any plan gap the user's
      // approved evidence already covers instead of coaching a false concession.
      if (canVerify && matchRequirement(gap, matcherProfile, dossier).status === "covered") continue;
      laneGapCount += 1;
      questions.push({
        id: makeId("gap_defense", index++),
        category: "gap_defense",
        question: `Your lane plan says you're still closing this gap: "${gap}". If it comes up, what's your honest answer?`,
        why: `${
          lane.source === "custom"
            ? `You added this gap to your ${lane.title} lane`
            : `The ${lane.title} lane plan suggests closing this`
        } — better to rehearse the defense than improvise it.`,
        coaching: [
          "Show progress, not perfection: what you've done on this gap so far, however small.",
          "Frame it as trajectory: where you were a month ago, where you are now, where you'll be in three months."
        ],
        basedOn: `${lane.title} lane gap plan`
      });
    }
  }

  return questions;
}

// Signals that the user actually has independent/founder work — the side-company
// commitment question is only personalized when one of these appears in the
// profile or approved evidence. Everyone else gets the generic commitment
// staple, labeled as generic.
const FOUNDER_SIGNAL =
  /\b(founder|co-?founder|started (?:a|my own|my) (?:company|business|startup)|my own (?:company|business|startup)|building (?:a|my|our)(?:\s+\w+){0,2}\s+(?:company|startup|business)|side (?:business|hustle|company)|self-?employed|freelanc\w+|independent (?:business|venture|contractor))\b/i;

function founderEvidence(profile: CareerProfile, dossier?: CareerDossier | null): string | null {
  const profileFields: Array<[string, string]> = [
    ["current situation", profile.currentSituation],
    ["constraints", profile.constraints],
    ["experience summary", profile.experienceSummary],
    ["proof points", profile.proofPoints]
  ];
  for (const [field, value] of profileFields) {
    const match = value.match(FOUNDER_SIGNAL);
    if (match) return `Profile ${field}: "${match[0]}"`;
  }
  for (const record of approvedEvidence(dossier)) {
    const match = record.detail.match(FOUNDER_SIGNAL);
    if (match) return `Approved evidence (${record.kind}): "${truncateClaim(record.detail, 80)}"`;
  }
  return null;
}

function buildTransitionQuestions(profile: CareerProfile, lane: TargetLane | null, dossier?: CareerDossier | null): PrepQuestion[] {
  const laneTitle = lane?.title ?? "this kind of role";
  const situation = profile.currentSituation.trim();
  const background = situation || "your current background";
  const founderSource = founderEvidence(profile, dossier);

  const commitmentQuestion: PrepQuestion = founderSource
    ? {
        id: makeId("transition", 1),
        category: "transition",
        question: "You're building your own venture on the side. Why should we believe you'll stay and be committed here?",
        why: "If your side project is visible anywhere, assume this gets asked. An unrehearsed answer sounds evasive.",
        coaching: [
          "Don't hide the venture — it's proof of initiative. Address the concern head-on instead.",
          "Give the honest, practical answer: what the salary role means to you, how you separate the hours, why the skills compound.",
          "If your profile lists constraints about this, your answer here should match them exactly."
        ],
        basedOn: founderSource
      }
    : {
        id: makeId("transition", 1),
        category: "transition",
        question: "What would keep you here two years from now?",
        why: "The commitment probe — asked of nearly every career changer.",
        coaching: [
          "Anchor to what you actually want from the next role — the work, the team, the growth — named specifically.",
          "If you have real constraints (schedule, location), state them plainly; surprises later cost offers.",
          "Skip flattery without content: a concrete \"here's what I want to be doing in year two\" lands better."
        ],
        basedOn: "Generic commitment question (asked of most career changers)"
      };

  return [
    {
      id: makeId("transition", 0),
      category: "transition",
      question: `Why are you moving from ${background.length > 80 ? "your current path" : background} into ${laneTitle}?`,
      why: "The career-changer question. It's asked in nearly every interview and your answer sets the frame for everything after.",
      coaching: [
        "Run toward, not away: lead with what pulls you to this work, not what you're escaping.",
        "Connect the dots concretely: name the parts of your old work that are literally this job.",
        "Keep it under 60 seconds — this is a framing answer, not your life story."
      ],
      basedOn: situation ? "Profile: current situation" : "Generic career-changer question"
    },
    commitmentQuestion
  ];
}

// ---------------------------------------------------------------------------
// Reverse questions: what the candidate asks the interviewer. Specific when a
// job-post analysis or lane exists; generic-but-strong staples otherwise.
// ---------------------------------------------------------------------------

export function buildReverseQuestions(lane: TargetLane | null, application: ApplicationRecord | null): ReverseQuestion[] {
  const questions: ReverseQuestion[] = [];

  if (application) {
    const company = application.company && application.company !== "Unknown company" ? application.company : "the team";
    for (const term of application.analysisKeywords.slice(0, 2)) {
      questions.push({
        question: `The posting leans on ${term} — what does doing it well look like here in the first 90 days?`,
        why: "Shows you read the posting closely and turns a keyword into a concrete expectations conversation.",
        basedOn: `Job-post analysis (${company})`
      });
    }
    questions.push({
      question: `What would make the first six months a clear win for the person you hire as ${application.roleTitle}?`,
      why: "Gets the real success criteria on the table — and often surfaces the problem behind the opening.",
      basedOn: `Saved application (${company})`
    });
  }

  if (lane) {
    questions.push({
      question: `How is the ${lane.title} team measured — which numbers matter most right now?`,
      why: "Metrics reveal what the job actually is, and asking signals you think in outcomes.",
      basedOn: `${lane.title} lane`
    });
  }

  const staples: ReverseQuestion[] = [
    {
      question: "What's the hardest part of this job that doesn't show up in the posting?",
      why: "Invites honesty and shows you want the real job, not the brochure version.",
      basedOn: "Generic — strong in any interview"
    },
    {
      question: "What separates the people who've thrived in this role from those who haven't?",
      why: "Gives you the informal success profile and a preview of how performance is judged.",
      basedOn: "Generic — strong in any interview"
    },
    {
      question: "What would the team most need from this hire in the first 90 days?",
      why: "Turns the interview toward their problems — and gives your follow-up note its content.",
      basedOn: "Generic — strong in any interview"
    }
  ];
  for (const staple of staples) {
    if (questions.length >= 6) break;
    questions.push(staple);
  }

  return questions;
}

export function generateInterviewPrep(
  profile: CareerProfile,
  lane: TargetLane | null,
  application: ApplicationRecord | null,
  dossier?: CareerDossier | null
): InterviewPrepPack {
  const questions: PrepQuestion[] = [
    ...buildTransitionQuestions(profile, lane, dossier),
    ...(lane ? buildRoleQuestions(lane) : []),
    ...buildBehavioralQuestions(profile, dossier),
    ...buildGapDefenseQuestions(lane, application, dossier, profile)
  ];

  return {
    laneTitle: lane?.title ?? null,
    applicationLabel: application ? `${application.roleTitle} at ${application.company}` : null,
    questions,
    reverseQuestions: buildReverseQuestions(lane, application),
    answerFramework: ANSWER_FRAMEWORK,
    honestyNote: HONESTY_NOTE
  };
}

// ---------------------------------------------------------------------------
// Answer coaching: deterministic checks that push toward honest, specific,
// well-structured answers. No scoring theater — each check names a fix.
// ---------------------------------------------------------------------------

const RESULT_SIGNALS =
  /\b(result|outcome|improved|reduced|increased|saved|cut|grew|won|fixed|resolved|retained|led to|ended up|so that|which meant)\b/i;
const CREDENTIAL_CLAIMS = /\b(certified|certification|degree|licensed|accredited)\b/i;
const HONEST_GAP_SIGNALS =
  /\b(haven't|have not|don't have|do not have|not yet|new to|still learning|learning|admittedly|honestly|to be honest|my plan|working on|closest i've|closest thing)\b/i;

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

export function coachAnswer(answer: string, question: PrepQuestion): CoachingFeedback[] {
  const feedback: CoachingFeedback[] = [];
  const trimmed = answer.trim();

  if (trimmed.length < 40) {
    return [
      {
        tone: "fix",
        message: "Too short to coach. Write the answer you'd actually say — situation, what you did, what happened."
      }
    ];
  }

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 220) {
    feedback.push({
      tone: "fix",
      message: `${wordCount} words is a ramble in interview time. Cut to one situation, 2–3 actions, one result — aim for under 150 words.`
    });
  } else if (wordCount < 50) {
    feedback.push({
      tone: "fix",
      message: "Thin answer. Add the missing layer: one sentence of situation and a concrete result would double its weight."
    });
  } else {
    feedback.push({ tone: "good", message: "Good length — this fits in interview time without rambling." });
  }

  const iCount = countMatches(trimmed, /\bI\b/g);
  const weCount = countMatches(trimmed, /\bwe\b/gi);
  if (weCount > iCount) {
    feedback.push({
      tone: "fix",
      message: "More \"we\" than \"I\". Interviewers are hiring you — say which parts were specifically yours."
    });
  } else if (iCount > 0) {
    feedback.push({ tone: "good", message: "Clear personal ownership — the \"I\" statements make your role unambiguous." });
  }

  if (/\d/.test(trimmed)) {
    feedback.push({ tone: "good", message: "Has a number. Specifics like this are what interviewers write down." });
  } else {
    feedback.push({
      tone: "fix",
      message: "No numbers anywhere. Add one honest measure of scale — volume, frequency, time, people — if it exists."
    });
  }

  if (RESULT_SIGNALS.test(trimmed)) {
    feedback.push({ tone: "good", message: "Ends with an outcome — the answer lands somewhere." });
  } else {
    feedback.push({
      tone: "fix",
      message: "No result stated. Finish with what changed because of what you did, even if it's modest."
    });
  }

  if (CREDENTIAL_CLAIMS.test(trimmed)) {
    feedback.push({
      tone: "fix",
      message: "You mention a credential. Double-check: only claim certifications or degrees you actually hold — this is the one thing that can't be walked back."
    });
  }

  if (question.category === "gap_defense") {
    if (HONEST_GAP_SIGNALS.test(trimmed)) {
      feedback.push({
        tone: "good",
        message: "You acknowledge the gap directly — that's the strongest opening a gap-defense answer can have."
      });
    } else {
      feedback.push({
        tone: "fix",
        message: "This is a gap question, but the answer never concedes the gap. Acknowledge it in the first sentence, then bridge to your closest real experience and your plan."
      });
    }
  }

  return feedback;
}

// ---------------------------------------------------------------------------
// Practice-draft persistence: answers drafted on prep cards used to live only
// in component state, so navigation or refresh destroyed them. Drafts persist
// locally, keyed by question text (stable across regenerations, and shared
// when the same question appears for multiple lanes — which is what you want).
// ---------------------------------------------------------------------------

export const PREP_DRAFT_KEY = "career-forge-prep-drafts-v1";
const PREP_DRAFT_LIMIT = 300;

// Sanity check, not a full revival: anything that isn't a string→string map
// entry is dropped, matching the interview-session-store pattern.
function revivePrepDrafts(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const drafts: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) drafts[key] = value;
  }
  return drafts;
}

export function loadPrepDrafts(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const serialized = window.localStorage.getItem(PREP_DRAFT_KEY);
    return serialized ? revivePrepDrafts(JSON.parse(serialized)) : {};
  } catch {
    return {};
  }
}

export function loadPrepDraft(question: string): string {
  return loadPrepDrafts()[question] ?? "";
}

export function savePrepDraft(question: string, draft: string): void {
  if (typeof window === "undefined") return;
  try {
    const drafts = loadPrepDrafts();
    if (draft.trim()) drafts[question] = draft;
    else delete drafts[question];
    const keys = Object.keys(drafts);
    // Insertion-ordered map: trim oldest entries rather than fail the save.
    if (keys.length > PREP_DRAFT_LIMIT) {
      for (const key of keys.slice(0, keys.length - PREP_DRAFT_LIMIT)) delete drafts[key];
    }
    window.localStorage.setItem(PREP_DRAFT_KEY, JSON.stringify(drafts));
  } catch {
    // A failed save keeps the in-memory draft usable for this visit.
  }
}
