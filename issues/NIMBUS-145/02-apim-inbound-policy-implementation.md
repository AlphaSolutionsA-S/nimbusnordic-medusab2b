# Task 02: APIM Inbound Policy XML

**Status:** TODO
**App:** azure-integration
**Task ID:** 02
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-145 (from develop)
**Depends on:** Task 01 (schemas), NIMBUS-146 (Logic App trigger URL)

---

## Context

This task authors the complete APIM policy XML that:
1. Branches on `Content-Type` (JSON vs XML vs unsupported).
2. Validates JSON payloads against the `canonical-order-json` schema (Task 01).
3. Validates XML payloads against the `canonical-order-xml` schema (Task 01), then transforms
   to JSON using `xml-to-json`.
4. Rejects unsupported/missing content types with 415.
5. Forwards the validated canonical-JSON body to NIMBUS-146's Logic App HTTP trigger.
6. Returns safe, structured error responses on validation failure.

The policy follows the existing APIM operating model: inline XML authored as a reference
artifact and applied manually in the Azure Portal (no IaC).

### APIM policy primitives used (verified from Microsoft docs)

- **`choose`** — branches on `Content-Type` header via `@(context.Request.Headers.GetValueOrDefault("Content-Type", ""))`.
- **`validate-content`** — validates request body against a registered schema. `action="prevent"`
  blocks and returns 400 on failure. `errors-variable-name` captures errors for `on-error`.
- **`xml-to-json`** — converts XML body to JSON. `kind="javascript-friendly"` for camelCase output.
  `apply="always"` for unconditional conversion. `always-array-child-elements="true"` to ensure
  single `<line>` elements become JSON arrays.
- **`set-header`** — sets `Content-Type` to `application/json` after XML→JSON transformation.
- **`set-backend-service`** — points at the Logic App HTTP trigger URL (placeholder).
- **`rewrite-uri`** — preserves the path token in the URL path for the downstream Logic App.
- **`return-response`** — returns 415 for unsupported content types.
- **`on-error`** — returns 400 with a structured JSON error body.

## Solution Design

### New File: `issues/NIMBUS-145/artifacts/apim-policy.xml`

The complete APIM policy document. Structure:

```xml
<policies>
  <inbound>
    <base />

    <!-- Branch on Content-Type -->
    <choose>
      <!-- JSON branch -->
      <when condition="@(context.Request.Headers.GetValueOrDefault("Content-Type", "").Contains("application/json"))">
        <!-- Validate against canonical JSON schema -->
        <validate-content unspecified-content-type-action="prevent" max-size="524288"
                           size-exceeded-action="prevent"
                           errors-variable-name="validationErrors">
          <content type="application/json" validate-as="json"
                   schema-id="canonical-order-json"
                   schema-ref="#"
                   action="prevent"
                   allow-additional-properties="false" />
        </validate-content>
      </when>

      <!-- XML branch -->
      <when condition="@(context.Request.Headers.GetValueOrDefault("Content-Type", "").Contains("xml"))">
        <!-- Validate against canonical XML schema -->
        <validate-content unspecified-content-type-action="prevent" max-size="524288"
                           size-exceeded-action="prevent"
                           errors-variable-name="validationErrors">
          <content type="application/xml" validate-as="xml"
                   schema-id="canonical-order-xml"
                   action="prevent" />
        </validate-content>

        <!-- Transform XML to JSON -->
        <xml-to-json kind="javascript-friendly" apply="always"
                     consider-accept-header="false"
                     always-array-child-elements="true" />

        <!-- Set Content-Type to JSON for downstream -->
        <set-header name="Content-Type" exists-action="override">
          <value>application/json</value>
        </set-header>
      </when>

      <!-- Unsupported content type -->
      <otherwise>
        <return-response>
          <set-status code="415" reason="Unsupported Media Type" />
          <set-header name="Content-Type" exists-action="override">
            <value>application/json</value>
          </set-header>
          <set-body>{"error":"Unsupported content type. Use application/json or application/xml."}</set-body>
        </return-response>
      </otherwise>
    </choose>

    <!-- Forward to NIMBUS-146 Logic App -->
    <!-- TODO: Replace with actual Logic App HTTP trigger URL from NIMBUS-146 deployment -->
    <set-backend-service base-url="https://PLACEHOLDER-LOGIC-APP-TRIGGER-URL" />
    <!-- TODO: Adjust rewrite-uri to preserve the path token for NIMBUS-146 -->
    <!-- <rewrite-uri template="/{token}" /> -->
  </inbound>

  <backend>
    <base />
  </backend>

  <outbound>
    <base />
  </outbound>

  <on-error>
    <base />

    <!-- Return structured error for validation failures -->
    <choose>
      <when condition="@(context.Variables.ContainsKey("validationErrors"))">
        <return-response>
          <set-status code="400" reason="Bad Request" />
          <set-header name="Content-Type" exists-action="override">
            <value>application/json</value>
          </set-header>
          <set-body>{"error":"Request validation failed","message":"The submitted payload does not conform to the canonical order contract."}</set-body>
        </return-response>
      </when>
    </choose>
  </on-error>
</policies>
```

### Key policy decisions

**Content-type matching:** The `choose` conditions use `.Contains("application/json")` and
`.Contains("xml")` to match content types flexibly (handles `application/json; charset=utf-8`,
`application/xml`, `text/xml`, etc.). The XML check uses a broad `.Contains("xml")` to catch
both `application/xml` and `text/xml`.

**Max body size:** `max-size="524288"` (512 KB). Order payloads are small (header + lines, no
binary attachments). 512 KB is generous for this use case and prevents oversized payloads from
reaching the validation engine.

**Error response body:** The `on-error` response returns a generic message without echoing the
raw payload, credentials, or internal exception details. The detailed validation errors are
captured in the `validationErrors` context variable (for diagnostics via Application Insights)
but not exposed in the public response. This satisfies the SCOPE's non-functional requirement:
"No credentials, internal exception stack traces, or sensitive payload contents are exposed in
error responses."

**`allow-additional-properties="false"`** on the JSON `validate-content` — mirrors the Zod
schema's `.strict()` mode. Unknown fields are rejected.

**`always-array-child-elements="true"`** on `xml-to-json` — ensures a single `<line>` element
becomes `"lines": [{ ... }]` (array), not `"lines": { ... }` (object). This is critical for the
canonical contract's `lines` array validation.

**`consider-accept-header="false"`** on `xml-to-json` — the transformation should always apply
for XML submissions, regardless of the client's `Accept` header. The downstream Logic App
expects JSON.

**HTTPS enforcement:** Not explicitly in the policy — APIM's endpoint URLs are HTTPS-only by
default. No HTTP endpoint is exposed, so there is no scenario to handle (per agent-discipline:
no error handling for scenarios that cannot happen).

**Decimal comma normalization:** Not included in the policy XML above. If the XML wire format
uses comma decimals (e.g. `<unitPrice>209,25</unitPrice>`), the `xml-to-json` policy will
produce `"unitPrice": "209,25"` (a string, not a number), which will fail JSON Schema validation
(the schema expects `type: "number"`). If this is the case, an additional `set-body` with a
liquid template or inline C# expression is needed to normalize comma decimals to dots. This is
flagged as a reconciliation item — see PLAN.md D8.

### New File: `issues/NIMBUS-145/artifacts/deployment-instructions.md`

Step-by-step instructions for applying the policy in the Azure Portal:

1. **Upload schemas to APIM:**
   - Navigate to the APIM instance in the Azure Portal.
   - Go to APIs → Schemas → + Add.
   - Create a schema named `canonical-order-json`:
     - Schema type: JSON
     - Content: paste the contents of `canonical-order-schema.json`.
   - Create a schema named `canonical-order-xml`:
     - Schema type: XML
     - Content: paste the contents of `canonical-order-schema.xsd`.

2. **Create or select the API operation:**
   - Navigate to APIs → [the order-ingestion API] → + Add Operation (or select an existing
     operation).
   - Operation: `POST /orders/{token}` (or the path pattern that includes the customer token
     as a URL path element).
   - **Note:** The exact API/operation naming and versioning is an open question from SCOPE.md.
     The implementor should follow the existing APIM API structure for this project.

3. **Apply the policy:**
   - Select the operation → Inbound processing → Policy editor (XML).
   - Paste the contents of `apim-policy.xml`.
   - Replace `https://PLACEHOLDER-LOGIC-APP-TRIGGER-URL` with the actual Logic App HTTP trigger
     URL from NIMBUS-146's deployment.
   - Uncomment and adjust the `rewrite-uri` to match the path-token routing convention.
   - Save.

4. **Verify:**
   - Use the Portal's Test tab to send a test request with a valid JSON payload.
   - Verify the request is forwarded to the Logic App (check the Logic App run history).
   - Send an invalid JSON payload (missing required field) and verify a 400 response.
   - Send a valid XML payload and verify it is transformed to JSON and forwarded.
   - Send an unsupported content type (e.g. `text/plain`) and verify a 415 response.

5. **Pre-deployment checklist:**
   - [ ] NIMBUS-146's Logic App is deployed and its HTTP trigger URL is available.
   - [ ] The `canonical-order-json` and `canonical-order-xml` schemas are uploaded to APIM.
   - [ ] The policy's `set-backend-service` URL is replaced with the actual Logic App trigger URL.
   - [ ] The `rewrite-uri` template matches the path-token routing convention.
   - [ ] HTTPS-only is confirmed for the APIM endpoint (default behavior).
   - [ ] If the XML wire format uses comma decimals, the decimal normalization step is added
         to the policy.

## Impacted Files

- **New:** `issues/NIMBUS-145/artifacts/apim-policy.xml`
- **New:** `issues/NIMBUS-145/artifacts/deployment-instructions.md`

No existing files are modified. No code changes to `apps/backend` or `apps/storefront`.

## Open Items

- **Replace placeholder backend URL** — the `set-backend-service` URL must be replaced with the
  actual Logic App HTTP trigger URL from NIMBUS-146's deployment.
- **Adjust `rewrite-uri`** — the path-token routing convention depends on how the APIM API
  operation's URL template and the Logic App's trigger path are structured. The implementor must
  verify the exact path pattern.
- **Decimal comma normalization** — if the XML wire format uses comma decimals, add a
  normalization step (e.g. `set-body` with a regex replace) after `xml-to-json`. The exact
  implementation depends on whether `xml-to-json` produces strings or numbers for comma-decimal
  values.
- **Verify `schema-ref` for JSON Schema** — the `validate-content` policy's `schema-ref`
  attribute for JSON schemas supports local reference paths (e.g. `#/components/schemas/address`).
  For a top-level schema, `schema-ref="#"` or omitting `schema-ref` should work. Verify against
  the APIM version in use.
- **Verify `validate-content` XML schema reference** — for XML schemas, `schema-ref` is not
  supported; the top-level element of the XSD is used as the root. Verify that the XSD's root
  element name (`canonicalOrder`) matches the XML wire format's root element name.
