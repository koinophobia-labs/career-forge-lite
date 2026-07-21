# Career Forge redemption codes

Customers receive a short redemption code such as `CF-7K9M-P4TX-W8Q2R`.
The code is a lookup credential, not the entitlement itself. A successful
redemption returns a freshly signed `CF1.<payload>.<signature>` entitlement to
the browser, where the existing public-key verifier checks and stores it for
offline use. The signed entitlement is never rendered or emailed.

## Security and storage

- The 13-character body uses a 31-symbol alphabet and cryptographically secure,
  unbiased randomness: 13 × log2(31) is approximately 64.4 bits.
- `0`, `O`, `1`, `I`, and `L` are excluded, and the code contains no symbols.
- Entry is case-insensitive; spaces and hyphens are ignored.
- Neon stores an HMAC-SHA256 hash using `REDEMPTION_CODE_PEPPER`, never the
  delivered plaintext code.
- A unique `session_id` constraint makes issuance idempotent for a Stripe
  Checkout Session.
- Until Resend acknowledges the fulfillment email, AES-256-GCM ciphertext is
  retained only so a webhook retry can resend the same code. It is erased as
  soon as delivery is recorded.
- No customer identity is stored in `cf_redemptions`.

## Neon schema

`cf_redemptions` contains the code hash, Checkout Session ID, package tier,
entitlement reference, purchase time, creation time, redemption audit fields,
revocation fields, and the nullable temporary retry ciphertext. The table is
created idempotently by the existing fulfillment-store initializer.

## Revocation limitation

Setting `revoked = TRUE` prevents every future redemption of that short code.
It does **not** erase a signed entitlement that was already verified and stored
offline on a customer device. Refund-based removal of existing access therefore
requires a separate entitlement-revocation policy and online revocation model;
this change deliberately does not invent one.

Operators can revoke by the non-personal Stripe reconciliation key:

```sql
UPDATE cf_redemptions
SET revoked = TRUE,
    revocation_reason = 'support-approved reason'
WHERE session_id = 'cs_...';
```

Do not put plaintext redemption codes in SQL, logs, support tickets, or command
arguments.
