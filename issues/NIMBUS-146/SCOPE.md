# Validate customer token and route order

- **Date:** 2026-09-02
- **Status:** Scoped
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-146
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-146/
- **Size:** M
- **Area:** Azure Logic App — customer token validation and order routing
- **Base Branch:** develop
- **Requested by:** Klaus Petersen (klp@alpha-solutions.dk)
- **Requested at:** 2026-09-02T00:00:00Z

## Background

Only authorized customer systems may submit orders. The customer token travels as a URL path
element (validated by NIMBUS-145's APIM layer only for content/HTTPS, not authorization); the
Logic App is where the token is actually checked and the resolved customer identity is attached
before the request reaches Medusa (NIMBUS-144).

A real, existing Logic App (shared via Jira comment on this issue — an unrelated "product feed"
flow) establishes the token-validation pattern already used in this environment:

1. An HTTP-triggered Logic App receives the request, including the token (as `apikey` in that
   example).
2. A `Get_APIkeys`-style HTTP action fetches a list of valid entries from an external API (a
   "GlobalLists" endpoint on `structpim.com` in the example — each entry has `Uid`, `SortOrder`,
   `Value`).
3. The incoming token is matched against that list (in the example, via an inline JavaScript
   action).
4. On a match: the authorized branch proceeds (in the example, blob content is returned; for this
   story, the order is forwarded to Medusa instead). On no match: a `401` response is returned
   with a generic message that does not echo the token back (`"You secret is not recognized"` in
   the example).

**Confirmed for this story:** NIMBUS-146 reuses this same list-based pattern, extended so each
entry also carries a **customer number** alongside its token value — not a new/different
token-store mechanism. The exact field/encoding format for attaching the customer number to each
entry (e.g. a structured `Value`, or an additional property on the list schema) is a
planner-level decision, informed by whatever the actual GlobalLists API in use for this project
supports.

**Ownership correction (per Jira comment on this issue):** this issue's Jira description
currently states customer/company matching "is handled when the Medusa order is created." That is
stale — per NIMBUS-147's approved scope, customer/company matching (against
`Company.business_central_customer_number`) is owned by NIMBUS-147 and runs *before* Medusa order
creation (NIMBUS-149), not at creation time. NIMBUS-146's job is narrower: resolve the token to a
customer number and pass it through; it does not perform the company-matching lookup itself. The
Jira description is being corrected to match as part of this scoping pass.

**Path-token redaction (deliberately dropped, confirmed):** consistent with NIMBUS-145's decision,
the requirement to redact the customer token from logs/telemetry is explicitly **out of scope**
for this story too — the token may appear in Logic App run history/logs. This issue's Jira
description still lists "token redaction from logs and telemetry" in its Scope line; that wording
is stale and is being corrected alongside the ownership fix above.

## Requirements

### Functional

- Receive the request forwarded by NIMBUS-145 (canonical-JSON-normalized order body, HTTPS,
  customer token present as a URL path element).
- Validate the token against the extended token-list store (list-fetch-and-match pattern from the
  existing example Logic App), resolving a valid token to its associated customer number.
- If the token matches a list entry but that entry's customer number is missing, null, or empty,
  treat the request as unauthorized: return a "not allowed" rejection and do **not** forward the
  order onward. A known token with no resolvable customer number must never result in a call to
  NIMBUS-144 with a blank `customerNumber`. This is a distinct failure mode from an unmatched
  token, and its response must be distinguishable from the "token not recognized" rejection
  (exact status code and message a planner decision).
- On a valid token: forward the order to NIMBUS-144's Medusa receiving endpoint
  (`POST /orderapi/orders`), with the resolved customer number passed as a query-string parameter
  (per NIMBUS-144's established contract, e.g. `?customerNumber=...`) and the canonical JSON body
  unchanged.
- Authenticate the Logic App's own call to NIMBUS-144's Medusa endpoint using Medusa's native
  secret API key over HTTP Basic auth — the mechanism NIMBUS-129's implementation planning already
  settled on for that endpoint (see `issues/NIMBUS-129/05-order-api-route-implementation.md`).
  This is a separate credential from the customer's own token; the Logic App holds it as its own
  secret (e.g. a Logic App parameter or Key Vault reference — exact storage a planner decision).
- On an invalid/unmatched token: return a clear `401` (or equivalent) response, following the
  existing example's pattern of a generic message that does not echo the token value back.
- Enforce HTTPS for all traffic through this Logic App.
- Do not perform customer/company matching against the `Company` model — that remains
  NIMBUS-147's job. This story's output is a bare customer number attached to the request; NIMBUS-147
  is what resolves that number to an actual Medusa company.

### Non-Functional

- **Path-token log redaction is explicitly out of scope** (see Background) — do not implement
  masking/redaction of the token in Logic App run history or telemetry.
- The 401 rejection response must not include the submitted token or any other secret value.
- No code changes to this repository's `apps/backend` or `apps/storefront` — this story's
  deliverable is Logic App configuration (and its token-list extension) only, mirroring
  NIMBUS-145's operating model.

## Affected Apps

- **backend** — not involved (no code changes); NIMBUS-144's endpoint and auth mechanism are
  consumed as-is, not modified by this story.
- **storefront** — not involved.
- **Azure integration** — the entire deliverable: the Logic App's token-validation and routing
  logic, and the extension of the existing GlobalLists-style token store to carry a customer
  number per entry.

## Proposed Structure

High-level task breakdown for the implementation planner:

1. Extend the existing token-list store (or its Logic App consumption) so each valid entry
   resolves to a customer number, not just a valid/invalid token — following the pattern in the
   example Logic App's `Get_APIkeys`/`Parse_JSON`/match steps.
2. Implement the Logic App's token-validation branch: fetch the extended list, match the incoming
   token, extract the associated customer number on success.
3. Implement the authorized-routing branch: call NIMBUS-144's `POST /orderapi/orders` endpoint
   with the customer number as a query parameter and the canonical JSON body forwarded unchanged,
   authenticated via Medusa's secret API key (HTTP Basic auth).
4. Implement the rejection branch: `401` response with a generic, token-free error message for
   unmatched tokens.
5. Enforce HTTPS on the Logic App's trigger.
6. Correct this issue's Jira description: remove the stale "matching is handled when the Medusa
   order is created" line and the "token redaction from logs and telemetry" scope line.
7. Tests: to the extent Logic Apps can be tested outside a live Azure environment (e.g. documented
   manual test payloads for valid-token, invalid-token, and malformed-request cases) — exact test
   approach is a planner decision, matching NIMBUS-145's note that no existing test infrastructure
   covers Azure Logic Apps in this repo.

## Open Questions

- **Exact token-list extension format** (how the customer number attaches to each entry in the
  GlobalLists-style store) — deferred to the planner, dependent on the real API's actual schema
  flexibility.
- **Exact secret storage mechanism** for the Logic App's own Medusa API key (Logic App parameter
  vs. Key Vault reference) — planner decision.
- **Exact GlobalLists API identity for this project** (the example uses an unrelated product-feed
  list; this story needs its own dedicated list/store, not literally the same list as the
  example) — to be confirmed by the planner/Azure environment owner.

## Dependencies

- **NIMBUS-145** — supplies the canonical-JSON-normalized, HTTPS-only request this story receives;
  also established the precedent for dropping path-token log redaction.
- **NIMBUS-144** — the Medusa endpoint this story calls; its secret-API-key (HTTP Basic auth)
  mechanism and its `?customerNumber=` query-parameter contract are both already fixed by that
  story's approved plan (`issues/NIMBUS-129/05-order-api-route-implementation.md`), not decided
  here.
- **NIMBUS-147** — owns actual customer/company matching against the `Company` model, consuming
  the customer number this story resolves and passes through; NIMBUS-146 does not duplicate that
  logic.
- Existing example Logic App (shared via Jira comment on this issue) — the precedent for the
  list-fetch-and-match token-validation pattern and the safe-rejection response shape.
