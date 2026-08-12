import type { FulfillmentStore, RedemptionRecord } from "@/lib/server/fulfillment-store";
import type { StripeRefund } from "@/lib/server/stripe";

export type RefundRevocationDecision =
  | { revoke: true; record: RedemptionRecord }
  | { revoke: false; reason: "missing_payment_intent" | "unmapped_payment" | "partial_refund"; record?: RedemptionRecord };

export function refundPaymentIntentId(refund: StripeRefund): string | null {
  return typeof refund.payment_intent === "string"
    ? refund.payment_intent
    : refund.payment_intent?.id ?? null;
}

/** Only a verified successful full refund revokes paid authority. */
export async function decideRefundRevocation(
  store: FulfillmentStore,
  refund: StripeRefund,
  cumulativeRefundedAmount: number = refund.amount
): Promise<RefundRevocationDecision> {
  const paymentIntentId = refundPaymentIntentId(refund);
  if (!paymentIntentId) return { revoke: false, reason: "missing_payment_intent" };
  const record = await store.getRedemptionByPaymentIntent(paymentIntentId);
  if (!record) return { revoke: false, reason: "unmapped_payment" };
  const fullRefund =
    refund.status === "succeeded" &&
    typeof record.amountTotal === "number" &&
    cumulativeRefundedAmount >= record.amountTotal &&
    refund.currency.toLowerCase() === record.currency;
  return fullRefund
    ? { revoke: true, record }
    : { revoke: false, reason: "partial_refund", record };
}
