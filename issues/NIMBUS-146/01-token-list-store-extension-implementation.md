# Task 01: Extend Token-List Store to Carry a Customer Number — Implementation Plan

**Status:** TODO
**App:** azure-integration (no `apps/backend` or `apps/storefront` code changes)
**App Root:** `issues/NIMBUS-146/artifacts` (deliverables live in this issue folder, not in `apps/`)
**Task ID:** 01
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-146-token-validation-routing (from develop)
**Depends on:** None

---

## Project Environment

- **App root:** `issues/NIMBUS-146/artifacts` — this is a design/configuration deliverable, not
  application code. There is no `pnpm build`/`pnpm lint`/`pnpm test` for it.
- **Build command:** N/A
- **Lint command:** N/A
- **Test command:** N/A — see Task 03 for the documented manual test payloads that stand in for
  automated tests on this Azure deliverable (no Logic App test infrastructure exists in this repo,
  same precedent as NIMBUS-145).
- **Test framework:** N/A
- **Test location:** N/A
- **Naming conventions:** Markdown/JSON reference artifacts, written under
  `issues/NIMBUS-146/artifacts/`, matching how NIMBUS-129's epic treats Azure deliverables (design
  documentation applied manually in the Azure Portal, not IaC checked into this repo).

## Context — why this task exists

The existing (unrelated) "product feed" Logic App example shared via Jira comment on this issue
fetches a list of entries from a GlobalLists-style API. Each entry has exactly three fields:
`Uid`, `SortOrder`, `Value`. The Logic App matches an incoming token (`apikey` in that example)
against the list and, on a match, proceeds; it does not resolve the token to any other identity —
just valid/invalid.

NIMBUS-146 needs more: a valid token must also resolve to a **customer number**, which Task 02's
Logic App workflow forwards to NIMBUS-144's Medusa endpoint as `?customerNumber=...`. This task
defines exactly how that customer number attaches to each list entry, since the example's schema
has no field for it.

**Open question explicitly flagged (SCOPE.md, "Open Questions"):** the real GlobalLists API's
actual schema flexibility for this project is not visible from this repository. This task makes a
concrete, defensible design decision below, but it is **not verified against the live GlobalLists
API** — whoever applies this in the Azure Portal must confirm the real list's schema before
deploying and adjust if needed (see "Verification required before deployment" below).

## Solution Design

**Primary design (delimiter-encoded `Value`, works regardless of GlobalLists schema
flexibility):** Each list entry's `Value` field carries both the token and the customer number,
joined by a `::` delimiter:

```
Value = "<token>::<customerNumber>"
```

Example: a customer token `a1b2c3d4e5f6` resolving to Business Central customer number
`579000283084` (13-digit EAN-style format, per NIMBUS-147's SCOPE.md "Findings from Real EDI
Samples") is stored as:

```
Value = "a1b2c3d4e5f6::579000283084"
```

`Uid` and `SortOrder` keep their existing meaning from the example (unique row id, display/sort
order) — this task does not change them.

**Customer-number invariant:** every authorized token entry must resolve to a non-empty Business
Central customer number. For the primary design, the portion after `::` must not be empty. For the
fallback design, `CustomerNumber` must be neither `null` nor `""`. Task 02 still enforces this at
runtime and returns `401` with `{"error":"Not allowed"}` for malformed entries so they cannot be
forwarded to Medusa.

**Why a delimiter inside `Value` rather than a new property:** the example's list entries have
exactly three fixed fields. Encoding inside the existing `Value` field guarantees compatibility
even if the real GlobalLists API does **not** support adding arbitrary custom properties per
entry. If the real API **does** support a dedicated extra field (e.g. a `CustomerNumber` property
alongside `Uid`/`SortOrder`/`Value`), that is a cleaner alternative — see "Fallback design" below.
This is the open, unverifiable-from-this-repo piece; both designs are documented so whoever
deploys this can pick based on what the real list actually supports.

**Fallback design (dedicated field, only if the real GlobalLists list type supports custom
properties):**

```json
{ "Uid": "...", "SortOrder": 1, "Value": "a1b2c3d4e5f6", "CustomerNumber": "579000283084" }
```

If this fallback is used instead, Task 02's `Parse_Token_List` schema and `Filter_Matching_Token`
/ `Compose_Customer_Number` actions need trivial adjustment (match on `Value` directly, read
`CustomerNumber` directly instead of splitting `Value`) — flagged in Task 02's doc at the relevant
step.

**Delimiter collision assumption (flagged, not verified):** `::` is chosen because customer
numbers observed in real EDI samples are purely numeric (13-digit EAN format) and tokens are
assumed to be opaque alphanumeric strings that don't contain `::`. **Before deploying, confirm the
real token format never contains `::`** — if it might, switch delimiters (e.g. to a character
provably absent from both token and customer-number formats) or use the fallback dedicated-field
design instead.

## Deliverable

### New File: `issues/NIMBUS-146/artifacts/token-list-schema.md`

Write this file with the following content (fill in the `<TBD - ...>` placeholders only if you
have real values from the Azure environment owner; otherwise leave them as explicit placeholders
— do not invent a real GlobalLists list ID or URL):

```markdown
# NIMBUS-146 — Token List Store Schema (GlobalLists Extension)

## Store identity

- **GlobalLists API base URL:** `<TBD - confirm with Azure environment owner; NOT the same list
  as the unrelated structpim.com product-feed example>`
- **List identifier:** `<TBD - confirm with Azure environment owner>`
- **Auth mechanism for reading this list:** `<TBD - confirm; likely a subscription key or similar,
  matching whatever the example Get_APIkeys action uses>`

This is a genuinely new, dedicated list for this project — NOT the same list as the example
(unrelated product-feed data). It must be created (or an existing customer-token list repointed)
in the real GlobalLists store before Task 02's Logic App can be deployed.

## Entry schema (primary design)

Each entry has the same three fields as the example list, with the customer number encoded into
`Value` using a `::` delimiter:

| Field       | Type   | Meaning                                      |
|-------------|--------|-----------------------------------------------|
| `Uid`       | string | Unique row identifier (unchanged from example) |
| `SortOrder` | number | Display/sort order (unchanged from example)    |
| `Value`     | string | `"<token>::<customerNumber>"`                  |

The `<customerNumber>` portion is required and must not be empty. An entry such as
`"a1b2c3d4e5f6::"` is invalid and is rejected by Task 02's runtime guard.

## Sample entries

\`\`\`json
[
  { "Uid": "1", "SortOrder": 1, "Value": "a1b2c3d4e5f6::579000283084" },
  { "Uid": "2", "SortOrder": 2, "Value": "f6e5d4c3b2a1::441122334455" }
]
\`\`\`

## Fallback design (only if the real GlobalLists list type supports custom properties)

\`\`\`json
[
  { "Uid": "1", "SortOrder": 1, "Value": "a1b2c3d4e5f6", "CustomerNumber": "579000283084" }
]
\`\`\`

If the fallback design is used, update Task 02's `Parse_Token_List` action schema and the
`Filter_Matching_Token` / `Compose_Customer_Number` actions accordingly (match `Value` directly;
read `CustomerNumber` directly, no split needed).

`CustomerNumber` is required to contain a non-empty string. A missing property, JSON `null`, or
`""` is rejected by Task 02's runtime guard with `401` / `Not allowed`.

## Verification required before deployment (not completed by this planning pass)

- [ ] Confirm the real GlobalLists API/list identity with the Azure environment owner (fill in
      "Store identity" above).
- [ ] Confirm whether the real list type supports a custom `CustomerNumber` property (primary vs.
      fallback design).
- [ ] Confirm the real customer token format never contains the `::` delimiter.
- [ ] Populate the real list with one entry per authorized customer token, each resolving to that
      customer's Business Central customer number (the same value expected in
      `Company.business_central_customer_number`, per NIMBUS-147's SCOPE.md).
- [ ] Confirm no token-list entry has a `null` or empty-string Business Central customer number.
```

## Test Cases

This task produces a design document, not executable code — its "test cases" are the
verification checklist embedded in the deliverable above, plus these documented review checks:

### TC-1: Schema round-trips a realistic entry (happy path)
- **Given:** A token `a1b2c3d4e5f6` and customer number `579000283084`.
- **When:** Encoded per the primary design as `Value = "a1b2c3d4e5f6::579000283084"`.
- **Then:** Splitting on `::` yields exactly two parts: the original token and the original
  customer number, with no data loss.

### TC-2: Delimiter collision is a documented, checked risk (edge case)
- **Given:** A hypothetical token that itself contains `::`.
- **When:** The entry is encoded per the primary design.
- **Then:** Splitting on `::` no longer round-trips correctly (more than 2 parts, or the token
  portion is truncated) — this is why the deliverable's verification checklist requires confirming
  the real token format before deployment, rather than assuming it silently.

### TC-3: Fallback design is documented as a drop-in alternative (wiring/integration)
- **Given:** The real GlobalLists list type turns out to support custom properties.
- **Then:** The deliverable's "Fallback design" section gives a complete alternative entry shape
  and explicitly names the two Task 02 actions that would need to change to consume it, so Task 02
  is not silently broken by choosing the fallback later.

### TC-4: Empty customer numbers are explicitly invalid (edge case)
- **Given:** A primary entry encoded as `Value = "a1b2c3d4e5f6::"`, or a fallback entry whose
  `CustomerNumber` is `null` or `""`.
- **Then:** The schema documentation marks the entry invalid and points to Task 02's runtime guard,
  which returns `401` / `Not allowed` without forwarding the order.

## Implementation Steps

1. Create `issues/NIMBUS-146/artifacts/token-list-schema.md` exactly as shown above.
2. Do not attempt to contact the real GlobalLists API or guess its real URL/list ID — leave the
   `<TBD - ...>` placeholders as-is; they are deployment-time configuration, not something this
   task can resolve from the repository.
3. Mark this task done once the file is created with the content above (verbatim structure; the
   sample entries and prose may be copied as-is).
