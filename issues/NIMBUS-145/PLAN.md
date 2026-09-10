# NIMBUS-145: Accept JSON and XML Orders Through APIM

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-145
**Scope:** issues/NIMBUS-145/SCOPE.md (approved)
**Branch:** `feature/NIMBUS-145` (from `develop`)

## Objective

Author the Azure API Management (APIM) inbound policy that accepts both JSON and XML order
submissions, validates each against NIMBUS-147's canonical contract, normalizes XML to canonical
JSON using APIM's built-in `xml-to-json` policy, enforces HTTPS, returns safe error responses on
validation failure, and forwards the validated canonical-JSON body to NIMBUS-146 (the Logic App)
with the customer's URL path token preserved unchanged.

**No code changes to `apps/backend` or `apps/storefront`.** The deliverable is APIM policy XML
and supporting schema artifacts, authored as reference files in `issues/NIMBUS-145/artifacts/`
for manual application in the Azure Portal — consistent with how the existing example APIM
endpoint is managed and with NIMBUS-146's operating model.

## Analysis

### What this story is

NIMBUS-145 is the public-facing APIM gateway layer that customer systems call directly. It sits
in front of NIMBUS-146 (Logic App — token validation and routing) and NIMBUS-144 (Medusa
receiving endpoint). The pipeline is:

```
Customer system
  → APIM (NIMBUS-145: content-type handling, validation, XML→JSON, HTTPS, error responses)
    → Logic App (NIMBUS-146: token validation, resolve customer number, forward to Medusa)
      → Medusa (NIMBUS-144/129: order creation, async enrichment, BC hand-off)
```

### Wire-format decision (fixed by SCOPE — do not re-litigate)

Both JSON and XML submissions arrive **already shaped to mirror NIMBUS-147's canonical contract
directly** — not the raw N-EDI/Evenex XML envelope seen in `issues/NIMBUS-129/example edi files/`.
Those samples were reference material for real field values, not the literal wire format. This
means:

- JSON submissions require **validation only** — no restructuring.
- XML submissions require validation plus a close-to-1:1 tag mapping via `xml-to-json` against the
  canonical-mirroring XML representation — not a structural remap of a differently-shaped envelope.

### Path-token redaction (fixed by SCOPE — do not re-litigate)

The epic's original non-functional requirement to redact the customer's URL path token from
logs/telemetry is **explicitly out of scope** — a deliberate risk-acceptance decision. The token
may appear in logs. Do not implement masking/redaction.

### Dependency contracts

**NIMBUS-147's canonical contract** (from `issues/NIMBUS-129/02-canonical-order-contract-implementation.md`):

The canonical JSON schema is a Zod schema (`CanonicalOrderSchema`) with this shape:

```
Order header (required): externalOrderNumber, orderDate, currencyCode, lines
Order header (optional): requestedDeliveryDate, salesperson, email, phoneNumber,
  discountAmount, discountAppliedBeforeTax, pricesIncludeTax, billTo, shipTo
Address (billTo/shipTo, shared shape): name, addressLine1, city, postCode, country (required);
  contact, addressLine2, state (optional)
Order line (required): lineNumber, itemNumber, eanNo, description, quantity, unitPrice
Order line (optional): custItemNo, description2, unitOfMeasureCode, discountPercent,
  discountAmount, discountAppliedBeforeTax, taxCode, taxPercent, requestedShipmentDate
```

The XML representation mirrors this 1:1 — tag names are the same as the JSON property names. The
canonical-mirroring XML is what NIMBUS-145 validates against and transforms.

**NIMBUS-146's Logic App** (from `issues/NIMBUS-146/PLAN.md`):

The Logic App receives the request forwarded by APIM with:
- The canonical JSON body (unchanged by APIM after normalization)
- The customer token as a URL path element (preserved by APIM)
- HTTPS

The Logic App's HTTP trigger URL is the backend service APIM forwards to.

**NIMBUS-129 Task 05's Medusa endpoint** (from `issues/NIMBUS-129/05-order-api-route-implementation.md`):

`POST /orderapi/orders?customerNumber=...` — the ultimate downstream endpoint. NIMBUS-145 does
not call this directly; it forwards to NIMBUS-146's Logic App, which in turn calls Medusa.

### APIM policy primitives (verified from Microsoft docs)

**`validate-content`** (inbound section):
- Validates request body against a JSON or XML schema registered in APIM.
- `action="prevent"` blocks the request and returns 400 on validation failure.
- `schema-id` references a schema added to the APIM instance via Portal.
- `errors-variable-name` captures validation errors in a context variable for `on-error` use.
- Supports `content-type-map` for mapping missing/alternative content types.

**`xml-to-json`** (inbound section, for XML branch):
- `kind="javascript-friendly"` produces JSON with JavaScript-friendly property names.
- `kind="direct"` preserves the XML structure more closely.
- `apply="always"` converts unconditionally; `apply="content-type-xml"` converts only when
  Content-Type indicates XML.
- `always-array-child-elements="true"` ensures single XML child elements become JSON arrays
  (important for `lines` — a single line must become `[{...}]`, not `{...}`).

**`choose`** (inbound section): branches on `Content-Type` header to separate JSON and XML
processing paths.

### Key design decisions

**D1 — `kind="javascript-friendly"` for `xml-to-json`.**

The canonical JSON contract uses camelCase property names (`externalOrderNumber`, `orderDate`,
etc.). The `javascript-friendly` mode of `xml-to-json` converts XML element names to
camelCase JavaScript property names, which matches the canonical contract directly. The `direct`
mode would preserve PascalCase or whatever case the XML uses, requiring an additional
transformation step.

However, the XML wire format's element naming convention is not yet fixed — NIMBUS-147's SCOPE
says the XML representation "mirrors this single canonical JSON model" but does not specify
whether XML tags are camelCase or PascalCase. If the XML tags are already camelCase (matching
the JSON property names), `kind="direct"` is simpler and avoids unwanted case conversion. The
implementor must verify the XML representation's tag naming convention and choose accordingly.
This plan defaults to `javascript-friendly` but flags this as a reconciliation item.

**D2 — `always-array-child-elements="true"` for `xml-to-json`.**

The canonical contract's `lines` field is an array (`z.array(CanonicalOrderLineSchema).min(1)`).
When an XML submission contains a single `<Line>`, the `xml-to-json` policy with
`always-array-child-elements="false"` (the default) would produce a JSON object, not an array —
`"lines": { ... }` instead of `"lines": [{ ... }]`. This would fail canonical validation. Setting
`always-array-child-elements="true"` ensures single child elements become arrays, matching the
contract.

**D3 — Content-type branching via `choose` before `validate-content`.**

The policy uses a `choose` block on the `Content-Type` header to separate two branches:

1. **JSON branch** (`application/json`): validate directly against the canonical JSON schema
   using `validate-content` with `validate-as="json"`. No transformation needed.
2. **XML branch** (`application/xml` or `text/xml`): first validate against the canonical XML
   schema using `validate-content` with `validate-as="xml"`, then transform to JSON using
   `xml-to-json`, then set the Content-Type to `application/json` for the downstream Logic App.

Unsupported or missing content types are rejected with 415 Unsupported Media Type.

**D4 — Two separate schemas registered in APIM.**

- `canonical-order-json` — a JSON Schema (draft 4 or 7, depending on APIM's support) derived from
  NIMBUS-147's `CanonicalOrderSchema`.
- `canonical-order-xml` — an XSD (XML Schema Definition) derived from NIMBUS-147's canonical XML
  representation.

Both are registered in the APIM instance via the Portal's Schemas section and referenced by
`schema-id` in the `validate-content` policy.

**D5 — `on-error` policy for safe, structured error responses.**

The `on-error` section checks the `errors-variable-name` context variable and returns a
structured JSON error response with a 400 status code. The error response contains a generic
message and does not echo the raw payload, credentials, or internal exception details. The
validation error details from APIM's `validate-content` are logged to the context variable (for
diagnostics) but not exposed in the public response.

**D6 — HTTPS enforcement via APIM's built-in mechanism.**

APIM's endpoint URLs are HTTPS-only by default. No explicit policy is needed to reject HTTP —
the APIM gateway does not expose an HTTP endpoint. This is consistent with the agent-discipline
principle of not adding error handling for scenarios that cannot happen.

**D7 — Forwarding to NIMBUS-146 via `set-backend-service`.**

The policy uses `set-backend-service` to point at the Logic App's HTTP trigger URL, and
`rewrite-uri` to preserve the path token in the URL path. The canonical JSON body (after
transformation for XML) is forwarded unchanged. The Content-Type is set to `application/json`
for the downstream call.

**D8 — Decimal comma normalization.**

NIMBUS-147's SCOPE flags that real EDI samples use comma-decimal formatting (e.g. `"209,25"`).
The `xml-to-json` policy converts XML to JSON but does not normalize decimal formats. If the
XML wire format uses comma decimals, an additional `set-body` with a liquid template or inline
C# expression is needed to replace commas with dots in numeric fields. This plan includes a
placeholder for this normalization but flags it as dependent on the actual XML wire format
decision.

## Execution Plan

### Task 01: Canonical order schemas (JSON Schema + XSD)

Author two schema artifacts derived from NIMBUS-147's canonical contract:

1. **`canonical-order-schema.json`** — a JSON Schema (draft 7) that mirrors
   `CanonicalOrderSchema` from NIMBUS-129 Task 02. Every field, required/optional flag, type, and
   constraint maps directly.
2. **`canonical-order-schema.xsd`** — an XSD that mirrors the canonical XML representation. Tag
   names match the JSON property names (camelCase). The `lines` element has `minOccurs="1"` and
  `maxOccurs="unbounded"`.

Both are reference artifacts for manual upload to the APIM instance's Schemas section.

### Task 02: APIM inbound policy XML

Author the complete APIM policy document:

1. **`inbound` section**:
   - `choose` on `Content-Type`:
     - JSON branch: `validate-content` with `validate-as="json"`, `schema-id="canonical-order-json"`,
       `action="prevent"`.
     - XML branch: `validate-content` with `validate-as="xml"`,
       `schema-id="canonical-order-xml"`, `action="prevent"`, then `xml-to-json` with
       `kind="javascript-friendly"`, `apply="always"`, `always-array-child-elements="true"`,
       then `set-header` Content-Type to `application/json`.
     - Else (unsupported/missing content type): `return-response` with 415.
   - `set-backend-service` pointing at the Logic App HTTP trigger URL (placeholder).
   - `rewrite-uri` preserving the path token.
2. **`backend` section**: `<base />` (forward to backend unchanged).
3. **`outbound` section**: `<base />` (pass response back unchanged).
4. **`on-error` section**: check `errors-variable-name`, return 400 with a structured JSON error
   body that does not expose internal details.

Also author `deployment-instructions.md` with step-by-step Portal application instructions.

### Task 03: Test payloads and manual verification plan

Author `test-payloads.md` with documented manual test cases:

1. Valid JSON submission → 201 (or downstream response).
2. Invalid JSON submission (missing required field) → 400 with structured error.
3. Valid XML submission → normalized to JSON, 201 (or downstream response).
4. Invalid XML submission (schema violation) → 400 with structured error.
5. Single-line XML submission → `lines` is a JSON array, not a singleton object.
6. Unsupported content type (e.g. `text/plain`) → 415.
7. Missing content type → 415.
8. XML with comma-decimal `unitPrice` → normalized to dot-decimal (if normalization is needed).

Each test case includes the request payload, expected status code, and expected response body
shape. Tests are manual (no automated APIM test infrastructure exists in this repo).

## Cross-Task Wiring Summary

- Task 01 produces two schema files (`canonical-order-schema.json` and `canonical-order-schema.xsd`)
  that Task 02's policy references by `schema-id`. Both must be uploaded to the APIM instance's
  Schemas section before the policy can function.
- Task 02 produces the policy XML (`apim-policy.xml`) and deployment instructions
  (`deployment-instructions.md`). The policy references the schemas from Task 01 and the Logic App
  trigger URL from NIMBUS-146.
- Task 03 produces test payloads (`test-payloads.md`) that exercise both the JSON and XML paths
  through the policy, including validation failures and edge cases.

## Environment / Config Changes

- **No code changes** to `apps/backend` or `apps/storefront`.
- **No `medusa-config.ts` changes**, no DB migrations, no env vars, no `pnpm` installs.
- **Manual Azure Portal steps** (documented in `deployment-instructions.md`):
  1. Upload `canonical-order-schema.json` as a JSON schema in APIM Schemas.
  2. Upload `canonical-order-schema.xsd` as an XML schema in APIM Schemas.
  3. Create or select the order-ingestion API operation in APIM.
  4. Apply the policy XML to the operation's inbound policy.
  5. Configure the backend service URL (Logic App HTTP trigger from NIMBUS-146).

## Decisions & Trade-offs

### D1: `kind="javascript-friendly"` vs `kind="direct"` for `xml-to-json`

**Chosen:** `javascript-friendly` (default). **Why:** The canonical JSON contract uses camelCase.
If the XML tags are PascalCase (common in XML), `javascript-friendly` converts them to camelCase
automatically. If the XML tags are already camelCase, `direct` is simpler. The implementor must
verify the XML representation's tag naming convention and choose accordingly.

**Trade-off:** `javascript-friendly` may not handle all edge cases (e.g. acronyms, hyphens). If
the XML tags are already camelCase, `direct` avoids unwanted conversion. Flagged as a
reconciliation item.

### D2: Two separate schemas vs. one schema

**Chosen:** Two schemas (JSON Schema + XSD). **Why:** APIM's `validate-content` validates JSON
against a JSON Schema and XML against an XSD — these are fundamentally different schema formats.
A single schema cannot serve both. The two schemas are derived from the same canonical contract,
so they stay in sync at the contract level.

**Trade-off:** Two files to maintain. Unavoidable given APIM's validation engine.

### D3: `validate-content` with `action="prevent"` vs `action="detect"`

**Chosen:** `prevent`. **Why:** Per SCOPE: "Reject payloads that fail contract validation with a
safe, structured error response." `prevent` blocks the request and returns 400. `detect` would
log errors but let the request through — not acceptable for a validation gateway.

### D4: No automated tests

**Chosen:** Documented manual test payloads. **Why:** No automated APIM test infrastructure
exists in this repo (same as NIMBUS-146). APIM policies can be tested via the Portal's
policy-test tool or against a live deployment, but neither is automatable from this repo's CI.

**Trade-off:** Manual testing is slower and less repeatable. Acceptable for this story's scope
(Azure configuration, not code).

## Open Items for the Implementor

1. **Verify XML tag naming convention** — NIMBUS-147's SCOPE says the XML representation "mirrors"
   the canonical JSON model but does not specify whether XML tags are camelCase or PascalCase.
   This determines `kind="javascript-friendly"` vs `kind="direct"` for `xml-to-json`.

2. **Verify decimal comma normalization need** — if the XML wire format uses comma decimals
   (e.g. `209,25`), an additional normalization step is needed after `xml-to-json`. If the XML
   wire format already uses dot decimals, no normalization is needed.

3. **Verify APIM tier** — `validate-content` is available on all tiers but has performance
   implications on Consumption/Developer tiers. Confirm the APIM tier for this project.

4. **Verify the Logic App HTTP trigger URL** — NIMBUS-146's Logic App is planned but not yet
   deployed. The policy uses a placeholder backend URL that must be replaced with the actual
   trigger URL after deployment.

5. **Verify APIM API/operation structure** — whether this policy attaches to a new API or an
   existing API revision, and the naming/versioning conventions (open question from SCOPE).

6. **Reconcile with NIMBUS-147's finalized XML representation** — NIMBUS-147 is scoped but not
   yet implemented. The XSD in Task 01 must match the XML representation NIMBUS-147 actually
   produces. If NIMBUS-147's implementation differs from the SCOPE's description, update the XSD
   accordingly.
