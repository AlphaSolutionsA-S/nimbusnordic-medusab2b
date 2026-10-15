# Accept JSON and XML orders through APIM

- **Date:** 2026-09-02
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-145
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-145/
- **Updated by:** main session (scoping done directly, not via the scoper sub-agent — see
  issues/NIMBUS-148/PROGRESS.md for why)
- **Outcome:** Scope approved. As with NIMBUS-144/147/148/149, implementation planning is the next
  stage but has not been requested yet — normal backlog pace.
- **Handover to:** implementation-planner agent (on request — not yet triggered)
- **Handover prompt:** Read `issues/NIMBUS-145/SCOPE.md` and plan the Azure APIM policy
  configuration for accepting JSON and XML order submissions. Scope is: (1) define/reference the
  JSON Schema and XSD for the canonical contract (from NIMBUS-147) that incoming payloads validate
  against; (2) author the APIM inbound policy — content-type branching, `validate-content` for both
  branches, the `xml-to-json` policy for XML normalization, HTTPS enforcement, and forwarding to
  NIMBUS-146 with the path token preserved unchanged; (3) author a safe `on-error` policy; (4)
  document all of this as reference artifacts in `issues/NIMBUS-145/` for manual application in the
  Azure Portal — no code changes to `apps/backend` or `apps/storefront`, and no new IaC tooling.
  Two decisions are fixed by this scope and must not be re-litigated without going back to the
  user: (a) both JSON and XML submissions arrive already shaped to mirror the canonical contract
  1:1 — this is NOT a remap of the raw N-EDI envelope seen in `issues/NIMBUS-129/example edi
  files/`; (b) path-token log redaction is explicitly OUT of scope — a deliberate risk-acceptance
  decision, not an oversight. Open questions left to the planner: exact APIM resource/API
  definition and versioning, exact JSON Schema/XSD artifact format for APIM's `validate-content`,
  and content-type-branching behavior for missing/unsupported `Content-Type` headers. If SCOPE.md
  needs adjustment during planning, update it in place rather than creating a new scope document.

---

## 2026-09-02 — Implementation Planning Complete

- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan produced. PLAN.md, manifest.md, and three task files created.
  Plan is ready for dispatch but conditional on NIMBUS-147's finalized XML representation and
  NIMBUS-146's Logic App deployment (backend URL is a placeholder).
- **Key decisions:**
  - Two separate schemas (JSON Schema draft 7 + XSD) derived from NIMBUS-147's canonical contract.
  - Content-type branching via `choose` on `Content-Type` header (JSON / XML / unsupported → 415).
  - `validate-content` with `action="prevent"` for both branches (rejects invalid payloads with 400).
  - `xml-to-json` with `kind="javascript-friendly"`, `always-array-child-elements="true"` for XML
    normalization (ensures single `<line>` becomes a JSON array).
  - `on-error` policy returns safe, structured 400 error (no raw payload, no internal details).
  - HTTPS enforcement via APIM's built-in HTTPS-only endpoints (no explicit policy needed).
  - Forwarding via `set-backend-service` to NIMBUS-146's Logic App (placeholder URL).
  - No code changes to `apps/backend` or `apps/storefront` — reference artifacts only.
  - Manual test payloads (no automated APIM test infrastructure in this repo).
- **Handover to:** implementor agent (once NIMBUS-147's XML representation is finalized and
  NIMBUS-146's Logic App trigger URL is available)
- **Handover prompt:** Implement NIMBUS-145 from the approved plan in issues/NIMBUS-145/. Start
  with Task 01 (schemas), then Task 02 (APIM policy), then Task 03 (test payloads). Before
  starting, complete the reconciliation checklist in manifest.md against NIMBUS-147's finalized
  XML representation and NIMBUS-146's deployed Logic App trigger URL.

---

## 2026-09-29 — Implementation Complete (artifacts authored, awaiting Azure deployment)

- **Updated by:** implementor agent
- **Branch:** worked directly on `develop` at the user's instruction. No `feature/NIMBUS-145`
  branch was created, and nothing was committed. All changes are uncommitted for user review.
- **Jira:** NIMBUS-145 was already **In Progress**, so no transition was made. It was not moved to
  Internal Review, because nothing has been applied to or verified in Azure yet.
- **Outcome:** Tasks 01, 02 and 03 are DONE. New files in `artifacts/`:
  `canonical-order-schema.json`, `canonical-order-schema.xsd`, `apim-policy.xml`,
  `deployment-instructions.md`, `test-payloads.md`. No changes to `apps/backend` or
  `apps/storefront`.
- **Reconciliation decisions:**
  - Both schemas are derived from the implemented zod schema
    `apps/backend/src/modules/order-ingestion/canonical-order-schema.ts`, not the stale plan field
    list. On a line only `lineNumber`, `eanNo`, `quantity` are required, and `unitPrice`,
    `itemNumber`, `description` are optional. Dates are `DD-MM-YYYY`, EAN is 13 digits, currency
    is 3 letters, and `.strict()` maps to no unknown fields.
  - The code defines no XML form, so the XSD is the canonical XML representation: camelCase tags
    identical to the JSON properties, root `<canonicalOrder>`, `<lines><line>`, no namespace,
    dot decimals. Comma decimals get a 400, so no normalization step is needed. The plan's claim
    that `xs:decimal` accepts commas was wrong. Duplicate `lineNumber` is rejected in XML by
    `xs:unique`.
  - The JSON Schema skeleton's `$defs` (2019-09) was corrected to `definitions` (draft-07).
  - XML branch: `xml-to-json` is followed by a `set-body` expression that unwraps the root, turns
    `lines/line` into an array, and types the numbers and booleans. The plan assumed
    `xml-to-json` alone would produce typed canonical JSON; that is not the case, because leaves
    become strings. `always-array-child-elements` is set to `false`, a deliberate deviation from
    the plan's `true`, because the expression handles single and multiple lines itself.
  - Forwarding follows the NIMBUS-146 trigger `relativePath: "orders/{token}"`. The operation is
    `POST /orders/{token}`, and `set-backend-service` uses the named value
    `{{nimbus-order-logicapp-base-url}}`. `rewrite-uri "/orders/{token}"` uses
    `copy-unmatched-params="false"`, and `set-query-parameter` re-adds `api-version`/`sp`/`sv`/`sig`
    (`sig` is a secret named value). This resolves the handoff gap NIMBUS-146 had accepted.
  - Content types are matched on the media type without parameters: `application/json` goes to
    JSON validation; `application/xml` and `text/xml` go to XML validation and conversion; all
    others, or none, get a 415. `on-error` returns the generic 400 for validation failures.
  - HTTPS is enforced by the API's "HTTPS only" URL-scheme setting, which is a deployment step.
  - Path-token redaction was left out of scope as decided, and the documents say so.
- **Validation performed (local, not Azure):**
  - The XSD was compiled with the .NET `XmlSchemaSet`. 2 valid and 6 invalid instances behaved as
    expected.
  - The JSON Schema was compiled with ajv 8 (strict). 3 valid and 8 invalid cases behaved as
    expected.
  - The `set-body` expression, extracted verbatim from `apim-policy.xml`, was compiled and run in
    a .NET 10 + Newtonsoft 13 harness on `SerializeXmlNode` output, which stands in for
    `xml-to-json`. Its output passed both the JSON Schema and the real backend zod
    `CanonicalOrderSchema`. The harness found and fixed one bug: with multiple lines, values stayed
    strings because Newtonsoft clones already-parented tokens on assignment.
  - TC-1, TC-3, TC-5 and TC-6 in `test-payloads.md` were validated the same way.
- **Unresolved checklist items:** APIM tier; the real Logic App callback URL (the three named
  values, plus whether the Logic App is Consumption or Standard); API/operation naming, suffix and
  versioning; the subscription-key decision; and live confirmation of verification points 1–7 in
  `deployment-instructions.md`: `xml-to-json` output shape, `on-error` detection, `max-size` for
  the tier, draft-07/`format` support, omitted `schema-ref`, and media-type matching.
- **Observed, not changed (outside this scope):** the TC-1 payload in
  `issues/NIMBUS-146/artifacts/test-payloads.md` uses an ISO `orderDate` (`2026-09-02`), which
  the current contract rejects. It needs `DD-MM-YYYY`.
- **Handover to:** the user, for review of the uncommitted artifacts on `develop`, and then the
  Azure environment owner, for deployment.
- **Handover prompt:** Review `issues/NIMBUS-145/artifacts/`. Then, in Azure: deploy NIMBUS-146's
  Logic App, split its callback URL into the three APIM named values, register the two schemas,
  create the HTTPS-only `POST /orders/{token}` operation, and paste `apim-policy.xml`, following
  `deployment-instructions.md`. Run `test-payloads.md` (APIM-only cases first). Record the answers
  to the open items and verification points in this file. When everything passes, move NIMBUS-145
  to Internal Review.

## 2026-10-15 — XML namespace added after APIM rejected the XSD
- **Updated by:** main session, on the user's decision.
- **Outcome:** Registering `canonical-order-schema.xsd` in APIM failed with "XML schemas without
  targetNamespace are not allowed". The user chose to add a namespace over dropping the XSD.
  - `canonical-order-schema.xsd`: `targetNamespace="urn:nimbusnordic:canonical-order:v1"`, also as
    the default namespace. The `uniqueLineNumber` XPath now uses the `co:` prefix, because
    unprefixed XPath names mean "no namespace".
  - `apim-policy.xml`: after `xml-to-json`, `set-body` removes `xmlns*` properties from the order.
    The backend zod schema is `.strict()` and would otherwise reject every XML order.
  - XML samples now declare the default namespace: `test-payloads.md` TC-3 and TC-5, and
    `issues/NIMBUS-129/artifacts/e2e/valid-order.xml`. `deployment-instructions.md` documents the
    rule.
- **Contract change:** customers' XML must declare the namespace on the root as the default
  namespace, with no prefixes. A prefixed root passes the XSD but breaks the conversion.
- **Verified locally:** the .NET `XmlReader` XSD validator accepts the e2e fixture and both test
  payloads. It rejects no namespace, the wrong namespace and a duplicate `lineNumber`.
- **Still unverified:** schema registration in APIM. Also unverified is what `xml-to-json`
  (`javascript-friendly`) names the `xmlns` property. The strip covers both `xmlns` and `@xmlns`.
  TC-3 is the check.
- **Policy deploy fix (same day):** APIM rejected the policy with "Usage of type
  'System.Globalization.CultureInfo' is not supported within expressions". System.Globalization
  is not on the list of types allowed in policy expressions (Microsoft Learn, "API Management
  policy expressions", read 2026-10-15). `long.Parse` now takes no culture, which is safe because
  the XSD allows digits only. Decimals are built digit by digit from the XSD-guaranteed `xs:decimal`
  form. A plain `decimal.Parse` would depend on the gateway culture: under `da-DK` it reads
  `134.75` as `13475`. The new parsing was compiled and run under `da-DK` and matches
  invariant-culture parsing for `134.75`, `.5`, `5.`, `+1.25`, `-2.5`, `007`, `1.50` and a 20-digit
  value.
- **First test call (same day):** TC-1 (valid JSON) got the generic 400. The trace showed
  `validate-content` `Unspecified`: "Unspecified content type application/json is not allowed."
  `unspecified-content-type-action="prevent"` rejects content types the APIM operation does not
  declare, and the operation declares none. Both `validate-content` elements now use `ignore`. The
  `choose` already admits only JSON and XML and returns 415 otherwise.
- **Must verify on deploy:** an invalid payload still gets a 400 from `validate-content`
  (`IncorrectMessage` in the trace), which proves the `content` elements validate on their own.
  TC-2 is that check.
- **Handover to:** the user: deploy the policy again, run TC-1 and TC-2, then continue deployment.

## 2026-10-15 — Deployed and working
- **Updated by:** main session; the user deployed it.
- **Outcome:** The user deployed the schemas and the policy with today's three fixes (XML
  namespace, culture-free number parsing, `unspecified-content-type-action="ignore"`). The user
  reports the APIM to Logic App to Medusa path working.
- **Verified:** the user reports a working end-to-end call. TC-2's trace check (`IncorrectMessage`
  rather than `Unspecified`) is not recorded.
- **Handover to:** reviewer.
