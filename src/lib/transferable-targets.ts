import { careerTargets } from "@/lib/career-targets";
import type { RoleFamily } from "@/types/career";

export type TransferTarget = {
  reason: string;
  roleFamily: RoleFamily;
  title: string;
};

const targetPatterns: Array<{ pattern: RegExp; title: string; roleFamily: RoleFamily; reason: string }> = [
  {
    pattern: /stock\s+manager|warehouse\s+manager|fulfillment\s+lead|warehouse\s+lead|stock\s+lead/i,
    title: "Warehouse Associate",
    roleFamily: "Operations",
    reason: "keeps hands-on stock, delivery, or warehouse goals grounded in an attainable first-step warehouse role"
  },
  {
    pattern: /stock|inventory|receiving/i,
    title: "Inventory Associate",
    roleFamily: "Operations",
    reason: "maps inventory, stocking, order accuracy, and supply handling toward entry inventory work"
  },
  {
    pattern: /fulfillment/i,
    title: "Fulfillment Associate",
    roleFamily: "Operations",
    reason: "maps order handling, packing, and fulfillment signals toward fulfillment work"
  },
  {
    pattern: /warehouse/i,
    title: "Warehouse Associate",
    roleFamily: "Operations",
    reason: "maps warehouse, order, and fulfillment experience toward hands-on warehouse operations"
  },
  {
    pattern: /dispatch|route|logistics support/i,
    title: "Dispatch Assistant",
    roleFamily: "Operations",
    reason: "maps route planning, delivery timing, and customer handoffs toward dispatch support"
  },
  {
    pattern: /logistics|supply chain/i,
    title: "Logistics Support",
    roleFamily: "Operations",
    reason: "maps route, delivery, order, and warehouse signals toward logistics support"
  },
  {
    pattern: /operations assistant|ops assistant/i,
    title: "Operations Assistant",
    roleFamily: "Admin",
    reason: "maps everyday task coordination and shift reliability toward operations support"
  },
  {
    pattern: /operations support/i,
    title: "Operations Assistant",
    roleFamily: "Operations",
    reason: "maps practical operations experience toward an entry operations support role"
  },
  {
    pattern: /operations associate|operations roles?|operations jobs?|move into operations|moving into operations/i,
    title: "Operations Associate",
    roleFamily: "Operations",
    reason: "maps practical work experience toward an entry operations role"
  },
  {
    pattern: /customer support|customer service|customer care/i,
    title: "Customer Support",
    roleFamily: "Customer Success",
    reason: "maps customer questions, issue handling, and follow-through toward support work"
  },
  {
    pattern: /appointment|scheduler|scheduling|booking/i,
    title: "Appointment Coordinator",
    roleFamily: "Operations",
    reason: "maps appointment handling, calendars, and client flow toward appointment coordination"
  },
  {
    pattern: /client success|client service/i,
    title: "Client Support",
    roleFamily: "Customer Success",
    reason: "maps client service, retention, and follow-up toward client support"
  },
  {
    pattern: /healthcare admin|medical office/i,
    title: "Healthcare Admin Assistant",
    roleFamily: "Admin",
    reason: "maps care notes, family communication, and safe routines toward healthcare administration"
  },
  {
    pattern: /patient services?|patient support/i,
    title: "Patient Services Representative",
    roleFamily: "Admin",
    reason: "maps caregiving, notes, safety, and family communication toward patient support administration"
  },
  {
    pattern: /care coordinator/i,
    title: "Client Support",
    roleFamily: "Customer Success",
    reason: "maps care support and client communication toward client support"
  },
  {
    pattern: /facilities assistant/i,
    title: "Facilities Assistant",
    roleFamily: "Operations",
    reason: "maps cleaning, maintenance, safety, and issue reporting toward facilities operations"
  },
  {
    pattern: /building operations|facility/i,
    title: "Building Operations Support",
    roleFamily: "Operations",
    reason: "maps cleaning, maintenance, safety, and issue reporting toward building operations support"
  },
  {
    pattern: /maintenance coordinator|maintenance/i,
    title: "Maintenance Assistant",
    roleFamily: "Operations",
    reason: "maps maintenance reporting and repair support toward maintenance assistant work"
  },
  {
    pattern: /shift lead|shift supervisor/i,
    title: "Operations Associate",
    roleFamily: "Operations",
    reason: "maps shift procedures, order flow, and team support toward service operations without inventing supervisor experience"
  },
  {
    pattern: /hospitality coordinator|hospitality/i,
    title: "Customer Experience Associate",
    roleFamily: "Customer Success",
    reason: "maps guest service, order flow, and sanitation standards toward hospitality-facing support"
  },
  {
    pattern: /sales support/i,
    title: "Sales Support Specialist",
    roleFamily: "Sales",
    reason: "maps retail service, customer questions, and transaction follow-through toward sales support"
  },
  {
    pattern: /compliance assistant|compliance/i,
    title: "Compliance Assistant",
    roleFamily: "Business",
    reason: "maps security, safety, and documentation habits toward compliance support"
  },
  {
    pattern: /tech support trainee|it support trainee|tech support|it support/i,
    title: "IT Support Trainee",
    roleFamily: "IT Support",
    reason: "maps troubleshooting, documentation, and user/customer help toward IT support"
  },
  {
    pattern: /field associate|field operations/i,
    title: "Field Associate",
    roleFamily: "Operations",
    reason: "maps mobile, route-based, and field work toward field operations"
  }
];

const preservedSpecificTargets = [
  "customer service associate",
  "client service associate",
  "entry-level business operations coordinator",
  "business operations coordinator",
  "facilities operations associate",
  "patient support coordinator"
];

export function inferTransferTarget(value: string): TransferTarget | null {
  const normalized = value.replace(/\s*\/\s*/g, " or ");
  const lower = normalized.trim().toLowerCase();
  if (preservedSpecificTargets.includes(lower)) return null;
  const knownTarget = careerTargets.find((target) => {
    const labels = [target.title, ...(target.aliases ?? [])].map((label) => label.toLowerCase());
    return labels.includes(lower);
  });
  if (knownTarget) return null;
  const match = targetPatterns.find((item) => item.pattern.test(normalized));
  return match ? { title: match.title, roleFamily: match.roleFamily, reason: match.reason } : null;
}

export function normalizeTransferTarget(value: string) {
  const transfer = inferTransferTarget(value);
  return transfer?.title ?? "";
}
