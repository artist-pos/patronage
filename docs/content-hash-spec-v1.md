# Ledger content-hash spec v1

Each `artwork_provenance_ledger` row carries a `content_hash` (SHA-256) and a
`hash_version` int. Hashing is independent of any blockchain — it lets us
prove later that a given row hasn't been mutated, and gives us a stable
artefact to anchor (OpenTimestamps, Bitcoin, etc.) if we ever need to.

## Canonical fields (v1)

Hashed in this order:

1. `artwork_id`
2. `entry_type`
3. `from_owner_id`
4. `to_owner_id`
5. `transfer_method`
6. `campaign_id`
7. `created_at`  *(ISO 8601 UTC, millisecond precision)*

## Excluded fields

- `id` — auto-increment, not semantically meaningful
- `updated_at` — mutable
- `notes` — free-text mutable field
- `transaction_ref` — *currently excluded so a Stripe payment intent ID can
  be added after the row was hashed (idempotency retries write the intent in
  later); revisit at v2.*
- `price` — same reason as `transaction_ref`. Held for v2.
- `certificate_url` — minted post-hoc.

## Serialisation

JSON object with the keys above in the order listed:

```json
{"artwork_id":"...","entry_type":"...","from_owner_id":"","to_owner_id":"...","transfer_method":"...","campaign_id":"","created_at":"2026-05-01T03:14:15.000Z"}
```

Rules:

- UTF-8 bytes
- No whitespace anywhere (no indentation, no spaces between keys/values)
- Nulls render as the empty string `""` (not the JSON literal `null`)
- Values stored exactly as written — no trimming, no lowercasing
- `created_at` rendered as `Date.toISOString()` (ISO 8601 with `Z` suffix,
  millisecond precision)

## Hash

```
hash = SHA-256(canonical_serialisation_bytes)
```

The result is hex-encoded (lowercase) and stored in `content_hash`.
`hash_version = 1` on every row hashed under this spec. If the spec ever
changes (adding a field, changing serialisation), bump to v2 and document
why — never re-hash existing rows under a new version.

## Verification

To verify a row hasn't been tampered with: pull the row, recompute the hash
from the canonical fields, compare to `content_hash`. Mismatch means the row
has been altered (or the spec has drifted — check `hash_version`).
