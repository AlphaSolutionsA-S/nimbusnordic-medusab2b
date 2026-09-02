# Task 03: Documented Test Payloads and Manual Verification Plan — Implementation Plan

**Status:** TODO
**App:** azure-integration (no `apps/backend` or `apps/storefront` code changes)
**App Root:** `issues/NIMBUS-146/artifacts`
**Task ID:** 03
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-146-token-validation-routing (from develop)
**Depends on:** Task 01, Task 02 (test payloads reference the exact token encoding and workflow
shape those tasks define)

---

## Project Environment

- **App root:** `issues/NIMBUS-146/artifacts`
- **Build/Lint/Test commands:** N/A — no Azure Logic App test infrastructure exists in this repo
  (same precedent as NIMBUS-145's SCOPE.md: "no existing test infrastructure covers Azure...in
  this repo"). This task's deliverable is the documented manual test plan itself, to be executed
  by a human against a real deployed Logic App (Task 02's deployment-instructions.md), not run by
  any CI in this repository.
- **Test location:** `issues/NIMBUS-146/artifacts/test-payloads.md` (this task's own deliverable).

## Context

⚠️ **MANUAL TESTING REQUIRED** for this entire story — there is no automated way to exercise an
Azure Logic App from this repository's tooling. This is the documented-manual-test-payload
approach SCOPE.md's "Proposed Structure" item 7 anticipated ("exact test approach is a planner
decision, matching NIMBUS-145's note that no existing test infrastructure covers Azure Logic Apps
in this repo").

**Dependency blocker for full end-to-end execution:** as noted in Task 02, NIMBUS-129's Task 05
(`POST /orderapi/orders`) has not been implemented/deployed yet. TC-1, TC-4, and TC-5 below
require a live Medusa endpoint to fully execute — they can still be reasoned through/dry-run via
the Logic App's own "Run Trigger" test tooling with a mocked/temporary Medusa endpoint if needed
sooner, but true end-to-end verification is blocked on that dependency. Do not treat this
blocker as something this task can resolve — record it as a known gap in the deliverable itself
(the template below already does).

## Solution Design

One reference document listing concrete HTTP request/response pairs a human tester sends to the
deployed Logic App's trigger callback URL, covering the happy path, invalid-token rejection,
null-or-empty customer-number rejection, and downstream error pass-through — mirroring the
Given/When/Then test cases already written into Task 01 and Task 02's docs, but phrased as literal
request/response payloads a tester can copy into a REST client (Postman, `curl`, etc.) rather than
as workflow-expression traces.

## Deliverable: New File — `issues/NIMBUS-146/artifacts/test-payloads.md`

Write this file with the following content, replacing `<LOGIC_APP_TRIGGER_URL>` with a literal
placeholder (do not invent a real URL — it only exists once Task 02 is deployed per its
`deployment-instructions.md`):

```markdown
# NIMBUS-146 — Manual Test Payloads

⚠️ **MANUAL TESTING REQUIRED.** These test cases are executed by a human against a live deployed
Logic App (see `deployment-instructions.md`), not by any automated suite in this repository.
Replace `<LOGIC_APP_TRIGGER_URL>` below with the real trigger callback URL obtained after deploying
Task 02's workflow.

**Known blocker for TC-1, TC-4, TC-5:** these require NIMBUS-129's `POST /orderapi/orders`
endpoint (NIMBUS-144) to be deployed to a reachable Medusa environment. As of this plan, that
endpoint is approved but not yet implemented/deployed — run those cases once it is. TC-2 (invalid
token), TC-3 (missing customer number), and TC-6 (HTTPS) can be executed as soon as Task 02's
Logic App itself is deployed, independent of Medusa's deployment state.

Assumes a token-list entry has been seeded per `token-list-schema.md`:
`Value = "a1b2c3d4e5f6::579000283084"`, and a `Company` row exists in the target Medusa
environment with `business_central_customer_number = "579000283084"` (required for TC-1 to reach
`201` rather than a `404` — see NIMBUS-144's contract).

---

### TC-1: Valid token, valid order — happy path, full pass-through
- **Given:** The token list contains an entry resolving `a1b2c3d4e5f6` to customer number
  `579000283084`, and a Medusa `Company` exists with that `business_central_customer_number`.
- **When:** A tester sends:
  \`\`\`
  POST <LOGIC_APP_TRIGGER_URL>/orders/a1b2c3d4e5f6
  Content-Type: application/json

  {
    "externalOrderNumber": "MANUAL-TEST-1",
    "orderDate": "2026-09-02",
    "currencyCode": "DKK",
    "lines": [
      {
        "lineNumber": 1,
        "itemNumber": "ITEM-1",
        "eanNo": "1234567890123",
        "description": "Test item",
        "quantity": 1,
        "unitPrice": 10
      }
    ]
  }
  \`\`\`
- **Then:** The response is `201` with body `{"order_id":"order_...","status":"pending"}` —
  identical in shape to NIMBUS-144's own documented manual test
  (`issues/NIMBUS-129/05-order-api-route-implementation.md`, "Manual Verification"), confirming
  this Logic App forwarded the body unchanged and passed Medusa's real response straight back.

### TC-2: Invalid/unrecognized token — rejection path, no token echoed (edge case)
- **Given:** No token-list entry's `Value` starts with `does-not-exist::`.
- **When:** A tester sends:
  \`\`\`
  POST <LOGIC_APP_TRIGGER_URL>/orders/does-not-exist
  Content-Type: application/json

  { "externalOrderNumber": "MANUAL-TEST-2", "orderDate": "2026-09-02", "currencyCode": "DKK",
    "lines": [{"lineNumber":1,"itemNumber":"ITEM-1","eanNo":"1234567890123","description":"Test item","quantity":1,"unitPrice":10}] }
  \`\`\`
- **Then:** The response is `401` with body exactly `{"error": "Token not recognized"}`. Confirm
  by inspecting the raw response body that the string `does-not-exist` does not appear anywhere in
  it, and confirm in the Logic App's run history that this run reached `Response_Unauthorized`,
  not `Response_Success`.

### TC-3: Matched token with null or empty BC customer number — not allowed (edge case)
- **Given:** Seed a token-list entry for `missing-customer-number` whose customer number is absent:
  use `Value = "missing-customer-number::"` for the primary delimiter design, or set the fallback
  `CustomerNumber` property to JSON `null`. Repeat with `CustomerNumber = ""` when the fallback
  design is deployed so both nullable forms are covered.
- **When:** A tester sends a structurally valid order to:
  \`\`\`
  POST <LOGIC_APP_TRIGGER_URL>/orders/missing-customer-number
  Content-Type: application/json

  { "externalOrderNumber": "MANUAL-TEST-3", "orderDate": "2026-09-02", "currencyCode": "DKK",
    "lines": [{"lineNumber":1,"itemNumber":"ITEM-1","eanNo":"1234567890123","description":"Test item","quantity":1,"unitPrice":10}] }
  \`\`\`
- **Then:** The response is `401` with body exactly `{"error": "Not allowed"}`. Confirm in the
  Logic App run history that `Response_Not_Allowed` ran and `Forward_Order_To_Medusa` was skipped.
  Confirm the raw response contains neither the submitted token nor a customer-number value.

### TC-4: Valid token, structurally invalid body — downstream 400 passes through (error condition)
- **Given:** Same valid token as TC-1, but the body omits the required `lines` field.
- **When:** A tester sends:
  \`\`\`
  POST <LOGIC_APP_TRIGGER_URL>/orders/a1b2c3d4e5f6
  Content-Type: application/json

  { "externalOrderNumber": "MANUAL-TEST-3", "orderDate": "2026-09-02", "currencyCode": "DKK" }
  \`\`\`
- **Then:** The response is `400` (Medusa's `validateAndTransformBody` rejection, per NIMBUS-144's
  contract), passed through unchanged by `Response_Success`'s `["Succeeded", "Failed"]` runAfter —
  confirming Medusa 4xx responses are not swallowed by the Logic App (this is the live-Azure
  counterpart of Task 02's TC-4, which traces the same behavior at the expression level).

### TC-5: Valid token, unknown customer number — downstream 404 passes through (wiring/integration)
- **Given:** A token-list entry resolves to a customer number with **no** matching Medusa
  `Company.business_central_customer_number`.
- **When:** A tester sends a structurally valid order (as in TC-1) with that token.
- **Then:** The response is `404` (Medusa's "unrecognized customerNumber" rejection per
  NIMBUS-144's contract), passed through unchanged — confirming the full chain (Logic App → token
  resolution → Medusa customer lookup) is wired correctly end-to-end, not just the token-matching
  half of it.

### TC-6: HTTPS enforcement (documentation-only verification)
- **Given:** The Logic App's trigger callback URL, as generated by Azure.
- **When:** Inspecting the URL.
- **Then:** It begins with `https://` — Azure Logic App Consumption "Request" triggers do not
  expose an HTTP-only variant, so this is a structural guarantee to confirm once, not a
  configuration to test repeatedly. Also confirm (via the Azure Portal or `curl -I http://...`
  against the bare hostname) that no `http://` variant of the endpoint responds with anything
  other than a connection failure/redirect.

## Outcome tracking

- [ ] TC-1 executed against a live deployment — result: _______
- [ ] TC-2 executed against a live deployment — result: _______
- [ ] TC-3 executed against a live deployment — result: _______
- [ ] TC-4 executed against a live deployment — result: _______
- [ ] TC-5 executed against a live deployment — result: _______
- [ ] TC-6 verified — result: _______
```

## Test Cases (for this planning task itself)

Since this task's deliverable *is* a set of test cases, its own verification is that the
deliverable is complete and internally consistent:

### TC-1: Every required behavior has a corresponding documented test case
- **Given:** SCOPE.md's five functional requirements plus the plan's null-or-empty customer-number
  guard (receive request, validate token, require a customer number, forward on valid data, reject
  invalid authorization data, enforce HTTPS).
- **When:** Cross-referencing against `test-payloads.md`'s TC-1 through TC-6.
- **Then:** Each behavior maps to at least one documented test case (TC-1/TC-4/TC-5 cover
  receive+validate+forward+downstream pass-through, TC-2 covers an invalid token, TC-3 covers a
  missing customer number, and TC-6 covers HTTPS).

### TC-2: Rejection test cases never expose authorization data (edge case, consistency)
- **Given:** TC-2 and TC-3's documented expected responses.
- **Then:** The expected bodies are the fixed generic responses `{"error": "Token not recognized"}`
  and `{"error": "Not allowed"}`. Neither response models or expects token/customer-number
  disclosure, staying consistent with the `401` non-functional requirement.

### TC-3: The known NIMBUS-144 deployment blocker is recorded, not silently omitted (integration/wiring)
- **Given:** NIMBUS-129's Task 05 is not yet implemented as of this planning pass.
- **Then:** `test-payloads.md`'s header explicitly states which test cases (TC-1, TC-4, TC-5) are
  blocked on that dependency and which (TC-2, TC-3, TC-6) are not — so a future reader doesn't
  assume all six are immediately executable.

## Implementation Steps

1. Create `issues/NIMBUS-146/artifacts/test-payloads.md` exactly as shown above.
2. Do not attempt to actually execute these tests against a live Azure deployment as part of this
   task — that happens after Task 02's Logic App is deployed (and, for TC-1/TC-4/TC-5, after
   NIMBUS-129's Task 05 is deployed), performed by whoever owns that deployment step.
3. Leave the "Outcome tracking" checklist unchecked — it is filled in by whoever runs these tests
   post-deployment, not by this planning/documentation task.
