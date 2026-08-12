# Career Forge redemption codes

Customers receive a short redemption code such as `CF-7K9M-P4TX-W8Q2R`.
The code is a lookup credential, not the entitlement itself. A successful
redemption returns a freshly signed `CF2.<payload>.<signature>` entitlement to
the browser. Signature verification is necessary, then an online revocation
check grants a device-local authorization for at most 24 hours. The signed
entitlement is never rendered or emailed.

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
entitlement reference, stable `entitlement_id`, PaymentIntent mapping, amount,
currency, purchase time, creation time, redemption audit fields, revocation
fields/timestamp, and the nullable temporary retry ciphertext. The table is
created idempotently by the existing fulfillment-store initializer.

## Revocation contract

Setting `revoked = TRUE` denies both future code redemption and every subsequent
CF2 authorization. Connected devices lock at once on revalidation. Previously
authorized offline devices lock when their 24-hour authorization expires.
Authorization cache is device-local and is never present in Career Forge backups.

Operators can revoke by the non-personal Stripe reconciliation key:

```sql
UPDATE cf_redemptions
SET revoked = TRUE,
    revocation_reason = 'support-approved reason',
    revoked_at = NOW()
WHERE session_id = 'cs_...';
```

Do not put plaintext redemption codes in SQL, logs, support tickets, or command
arguments.
