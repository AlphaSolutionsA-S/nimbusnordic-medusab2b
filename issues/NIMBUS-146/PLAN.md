# NIMBUS-146: Validate customer token and route order

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-146

## Objective

Design the Azure Logic App that validates a customer's URL-path token against an extended
GlobalLists-style token store and, on a match, forwards the order to NIMBUS-144's Medusa endpoint
with the resolved customer number — rejecting unmatched tokens and matched entries whose Business
Central customer number is `null` or an empty string with a generic, token-free `401`.

## Analysis

This is a pure Azure configuration/documentation deliverable — SCOPE.md is explicit that no
`apps/backend` or `apps/storefront` code changes are in scope, mirroring how sibling story
NIMBUS-145 is being handled (no existing Azure IaC in this repo; reference artifacts applied
manually in the Azure Portal). NIMBUS-145 itself has not been planned yet (only scoped), so there
was no prior implementation-planner output for an Azure-config deliverable to reuse as a template;
this plan establishes that shape for the first time in this epic.

The downstream contract this Logic App calls is already fixed by NIMBUS-129's approved plan
(`issues/NIMBUS-129/05-order-api-route-implementation.md`): `POST /orderapi/orders?customerNumber=...`,
authenticated with Medusa's secret API key over HTTP Basic auth (`Basic base64(sk_key:)`, empty
password), returning `201`/`400`/`404`/`422` depending on outcome. That endpoint is **approved but
not yet implemented in this repository** — this plan designs against the fixed, approved contract
(the source of truth per NIMBUS-129's own PROGRESS.md) but flags that full end-to-end manual
testing is blocked until that endpoint is actually deployed.

The example Logic App shared via Jira comment establishes the pattern to reuse: an HTTP trigger,
an HTTP fetch of a GlobalLists-style entry list (`Uid`/`SortOrder`/`Value`), a match against the
incoming token, and a branch on match/no-match. That example's list schema has no field for a
customer number, so this story's core design decision is how to extend it — resolved as
delimiter-encoding the customer number into the existing `Value` field
(`"<token>::<customerNumber>"`), which works regardless of whether the real GlobalLists API
supports adding new properties (unknown from this repo — flagged explicitly, with a documented
fallback design if it does).

Two other genuinely unresolvable-from-this-repo facts are flagged rather than guessed: the real
GlobalLists list identity for this project (the example uses an unrelated product-feed list), and
whether this environment's Logic Apps run Consumption or Standard plan with or without Key Vault
(affects how the Logic App's own Medusa secret key is stored). Both are called out as deployment
prerequisites, not silently assumed.

## Execution Plan

1. **Task 01** — Define the token-list extension (`token-list-schema.md`): the `Value` field's
   `"<token>::<customerNumber>"` encoding, sample entries, and a documented fallback design plus
   pre-deployment verification checklist.
2. **Task 02** — Author the Logic App Workflow Definition JSON
   (`logic-app-workflow-definition.json`) and deployment instructions
   (`deployment-instructions.md`): HTTP trigger with path-token extraction, list fetch/parse/match,
   customer-number extraction, a null-or-empty customer-number guard that returns `401` with
   `{"error":"Not allowed"}`, authenticated forward to Medusa with full status/body pass-through
   (including 4xx), invalid-token rejection branch, and HTTPS-enforcement documentation.
3. **Task 03** — Write documented manual test payloads (`test-payloads.md`) covering the happy
   path, invalid-token rejection, null-or-empty customer-number rejection, and downstream error
   pass-through, explicitly flagging which cases are blocked pending NIMBUS-129's Task 05
   deployment.

## Decisions & Trade-offs

- **Token-list extension: delimiter-encoded `Value` (`token::customerNumber`) as the primary
  design, with a dedicated-field fallback documented alongside it.** Chosen because it's
  guaranteed compatible with the example's exact three-field schema, without assuming the real
  GlobalLists API supports custom properties (unverifiable from this repo). Trade-off: relies on
  tokens never containing `::` — flagged as a pre-deployment verification item rather than
  silently assumed safe.
- **Medusa's 4xx responses are passed through unchanged (`Response_Success` runs on both
  `Succeeded` and `Failed`), rather than the Logic App re-shaping errors itself.** This keeps the
  Logic App a thin routing/auth layer, consistent with NIMBUS-146's narrow scope (resolve token,
  forward, don't own business validation) and avoids duplicating NIMBUS-144/147's error semantics.
- **HTTPS enforcement relies on the Logic App Request trigger's built-in HTTPS-only callback URL**
  rather than added workflow logic — there is no HTTP variant to explicitly reject, so extra
  configuration would be dead code per this project's agent-discipline conventions (simplicity
  first, no error handling for scenarios that cannot happen).
- **Secret storage (Logic App's own Medusa credential) is designed as a `securestring` workflow
  parameter, deployment-time-populated from Key Vault (recommended) or entered directly** — kept
  flexible because whether Key Vault is provisioned for this project isn't visible from this repo;
  documented as a deployment prerequisite rather than hard-coded to one mechanism.
- **No customer/company matching logic is included** — confirmed out of scope per SCOPE.md;
  NIMBUS-147 owns matching the resolved customer number against `Company`. This Logic App only
  resolves and forwards a bare customer number.
- **A non-empty Business Central customer number is required before forwarding.** A matched token
  whose list entry resolves to `null` or `""` is treated as unauthorized and receives a generic
  `401` response with `{"error":"Not allowed"}`. The workflow does not call Medusa and does not
  expose the token or customer-number value in this branch.
- **Path-token log redaction is not implemented** — a deliberate, already-approved risk-acceptance
  decision (SCOPE.md), consistent with NIMBUS-145; not re-litigated here.
- **Test strategy is documented manual payloads, not automated tests** — no Jest/CI equivalent
  exists for Azure Logic Apps in this repo (same precedent as NIMBUS-145). The standard
  test-infrastructure gate doesn't apply in the usual sense since neither `apps/backend` nor
  `apps/storefront` is touched by this story; this is flagged transparently rather than silently
  bypassed.

## Verification

- [ ] TC-1 (Task 02): matched-token expression trace resolves a non-empty customer number.
- [ ] TC-2 (Task 02): matched entries resolving to `null` or `""` return `401` / `Not allowed`
      without calling Medusa.
- [ ] TC-3 (Task 02): unmatched-token expression trace takes the else branch, returns generic 401.
- [ ] TC-4 (Task 02): a simulated Medusa 4xx response passes through `Response_Success` unchanged.
- [ ] TC-1–TC-6 (Task 03, `test-payloads.md`): executed manually against a live deployment once
      Task 02's Logic App (and, for TC-1/TC-4/TC-5, NIMBUS-129's Task 05) are deployed.
- [ ] Deployment prerequisites checklist (Task 02's `deployment-instructions.md`) fully confirmed
      by the Azure environment owner before enabling live traffic.
