# API guide

Base URL: `http://127.0.0.1:4101/api/v1` in development (the Vite dev server on port 5101 proxies `/api`). The full contract is [openapi.yaml](openapi.yaml): 26 operations are `x-status: implemented`, 67 are `x-status: pending` and answer `501` with their backlog ticket.

## Conventions

- JSON in and out, UTF-8. Request bodies are **strict**: unknown fields are rejected.
- **Money is a decimal string** in the line currency (`"1250.00"`, JPY `"150000"`). Never send JSON numbers. More decimals than the currency allows is rejected (`EXCESS_PRECISION`), never rounded.
- Dates are `YYYY-MM-DD` calendar dates; timestamps are ISO-8601 UTC.
- IDs are UUIDs. An ID belonging to another organization behaves exactly like a missing one (`404`).
- Every response carries `x-request-id`; send your own (`8–64` chars of `[A-Za-z0-9-]`) to correlate logs.

## Envelope

```json
{
  "data": { "...": "..." },
  "error": null,
  "meta": { "requestId": "1d0f1fca-…", "total": 42, "limit": 50, "offset": 0 }
}
```

Errors:

```json
{
  "data": null,
  "error": {
    "code": "JOURNAL_INVALID",
    "message": "The journal entry is not valid",
    "details": {
      "errors": [
        {
          "code": "UNBALANCED",
          "message": "Debits 100.00 and credits 99.99 differ by 0.01 USD",
          "details": { "difference": "0.01", "currency": "USD" }
        }
      ]
    }
  },
  "meta": { "requestId": "…" }
}
```

## Error codes

| HTTP | Code                                                                                                                            | Meaning                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`                                                                                                              | Body/query/params failed schema validation; `details[]` lists `path` + `message` |
| 400  | `BAD_REQUEST`                                                                                                                   | Malformed JSON or bad header (e.g. `Idempotency-Key`)                            |
| 401  | `UNAUTHENTICATED`                                                                                                               | No valid session                                                                 |
| 401  | `INVALID_CREDENTIALS`                                                                                                           | Login failed (same response for unknown emails)                                  |
| 403  | `FORBIDDEN`                                                                                                                     | Role lacks the permission                                                        |
| 403  | `CSRF_INVALID`                                                                                                                  | Missing or mismatched `X-CSRF-Token`                                             |
| 403  | `PERIOD_SOFT_CLOSED`                                                                                                            | Period is soft-closed and you are not a controller                               |
| 404  | `NOT_FOUND`                                                                                                                     | Missing or other organization's resource; unknown route                          |
| 409  | `PERIOD_CLOSED`                                                                                                                 | Period is closed                                                                 |
| 409  | `PERIOD_OVERLAP`                                                                                                                | New fiscal year overlaps existing periods                                        |
| 409  | `INVALID_PERIOD_TRANSITION`                                                                                                     | e.g. `open → closed`                                                             |
| 409  | `PERIOD_HAS_DRAFTS`                                                                                                             | Drafts must be posted or discarded before closing                                |
| 409  | `JOURNAL_NOT_DRAFT`                                                                                                             | Posting an already posted entry                                                  |
| 409  | `ACCOUNT_CODE_TAKEN`, `ENTITY_CODE_TAKEN`, `FX_RATE_EXISTS`                                                                     | Uniqueness conflicts                                                             |
| 409  | `IMMUTABLE_RECORD`, `LEDGER_INVARIANT`                                                                                          | Database guard tripped (should not happen via the API)                           |
| 422  | `JOURNAL_INVALID`                                                                                                               | Posting engine errors in `details.errors[]` (codes listed below)                 |
| 422  | `PERIOD_NOT_FOUND`                                                                                                              | No period covers the date                                                        |
| 422  | `ACCOUNT_CYCLE`, `ACCOUNT_PARENT_NOT_HEADER`, `ACCOUNT_PARENT_TYPE_MISMATCH`, `ACCOUNT_PARENT_NOT_FOUND`, `ACCOUNT_SELF_PARENT` | Hierarchy rules                                                                  |
| 422  | `INVALID_SETTING_ACCOUNT`                                                                                                       | Rounding / retained-earnings account invalid                                     |
| 422  | `IDEMPOTENCY_KEY_REUSED`                                                                                                        | Same key, different payload                                                      |
| 422  | `INVALID_RANGE`, `RANGE_SPANS_FISCAL_YEARS`                                                                                     | Trial balance range problems                                                     |
| 429  | `RATE_LIMITED`                                                                                                                  | Throttled; honour `Retry-After`                                                  |
| 501  | `NOT_IMPLEMENTED`                                                                                                               | Planned endpoint; `details.ticket` names the backlog item                        |
| 503  | `NOT_READY`, `RETRY_LATER`                                                                                                      | Database down; serialization/deadlock retry                                      |
| 500  | `INTERNAL_ERROR`                                                                                                                | Unexpected; details are logged server-side only                                  |

Posting engine codes (`details.errors[].code`, with `line` when line-specific): `TOO_FEW_LINES`, `INVALID_AMOUNT`, `NON_POSITIVE_AMOUNT`, `EXCESS_PRECISION`, `UNKNOWN_CURRENCY`, `ACCOUNT_NOT_FOUND`, `ACCOUNT_INACTIVE`, `ACCOUNT_NOT_POSTABLE`, `ACCOUNT_CURRENCY_MISMATCH`, `RATE_INVALID`, `RATE_MISSING`, `RATE_CONFLICT`, `FUNCTIONAL_RATE_NOT_ONE`, `ROUNDING_ACCOUNT_REQUIRED`, `UNBALANCED`.

## Pagination

List endpoints accept `limit` (1–200, default 50) and `offset` (default 0) and return `meta.total`, `meta.limit`, `meta.offset`. Ordering is stable (journals: date desc, number desc; audit: time desc, id desc). Keyset pagination for very large ledgers comes with LL-096.

## Authentication and CSRF

1. `POST /auth/login` sets `ll_session` (HttpOnly, SameSite=Lax, Secure in production) and `ll_csrf` (readable) and returns `csrfToken`.
2. Send cookies on every request; on `POST`/`PUT`/`PATCH`/`DELETE` also send `X-CSRF-Token: <ll_csrf value>`.
3. `POST /auth/logout` revokes the session server-side.

`POST /auth/register` always answers `202` with the same message and does not sign you in; sign in afterwards. Login is throttled per normalised IP, per distinct emails from one IP, and per email with progressive backoff.

Permissions per role are in [threat-model.md §5](../security/threat-model.md#5-rbac-matrix).

## Idempotency

`POST /entities/{id}/journals` accepts `Idempotency-Key` (8–100 chars `[A-Za-z0-9_.:-]`). A retry with the same key and identical body returns the original entry with `200` and `Idempotent-Replayed: true`; a different body returns `422 IDEMPOTENCY_KEY_REUSED`. Concurrent retries create exactly one entry.

## curl walkthrough

```bash
B=http://127.0.0.1:4101/api/v1
J=$(mktemp)   # cookie jar

curl -s $B/health

curl -s -c $J -X POST $B/auth/login -H 'content-type: application/json' \
  -d '{"email":"controller@northwind.example","password":"Ledgerline!Demo2026"}'
CSRF=$(awk '/ll_csrf/ {print $7}' $J)

curl -s -b $J $B/entities
ENT=<entity id of NW-US>

curl -s -b $J "$B/entities/$ENT/accounts?includeInactive=false"

curl -s -b $J -H "x-csrf-token: $CSRF" -H 'content-type: application/json' \
  -H 'idempotency-key: inv-2026-0042' \
  -X POST $B/entities/$ENT/journals -d '{
    "entryDate": "2026-02-26", "memo": "Office supplies", "post": true,
    "lines": [
      {"accountId": "<6300 id>", "side": "debit",  "amount": "99.95", "currency": "USD"},
      {"accountId": "<2100 id>", "side": "credit", "amount": "99.95", "currency": "USD"}
    ]}'

curl -s -b $J "$B/entities/$ENT/reports/trial-balance?to=2026-02-28"

# Pending endpoint -> 501 with ticket
curl -s -b $J -H "x-csrf-token: $CSRF" -X POST $B/entities/$ENT/revaluations -H 'content-type: application/json' -d '{}'
```

## Versioning

The path prefix `/api/v1` is the major version. Additive changes (new fields, new endpoints) do not bump it; clients must ignore unknown response fields.
