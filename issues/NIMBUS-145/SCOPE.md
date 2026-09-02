# Accept JSON and XML orders through APIM

- **Date:** 2026-09-02
- **Status:** Scoped
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-145
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-145/
- **Size:** M
- **Area:** Azure API Management (APIM) — public order-ingestion gateway
- **Base Branch:** develop
- **Requested by:** Klaus Petersen (klp@alpha-solutions.dk)
- **Requested at:** 2026-09-02T00:00:00Z

## Background

External B2B customer systems submit orders as either JSON or XML through a single public order
API (Epic NIMBUS-129 — "Receive orders through JSON and XML"). NIMBUS-145 is the Azure API
Management (APIM) layer that customer systems call directly: it accepts both content types,
validates the incoming contract, normalizes XML to canonical JSON using APIM's built-in
`xml-to-json` policy, enforces HTTPS, and returns safe error responses — before the request
continues to NIMBUS-146 (the Logic App that validates the customer's URL path token) and onward to
NIMBUS-144 (the Medusa receiving endpoint).

No Azure infrastructure-as-code exists in this repository. An existing (unrelated, GET-only) APIM
endpoint was shared as a Jira comment example — its policy is authored directly as inline XML and
applied by hand in the Azure Portal (`rewrite-uri` + `set-backend-service` pointing at a Logic App
HTTP trigger URL, with a `set-body` liquid template forwarding a path-matched token). This story
follows the same operating model: **no code changes in this repository**, and no new IaC tooling is
introduced. The deliverable is the policy XML and supporting schemas, authored as reference
artifacts in this issue's folder, to be applied manually in the Azure Portal.

**Wire-format decision (confirmed):** both JSON and XML submissions arrive already shaped to
mirror NIMBUS-147's canonical order contract directly — not the raw N-EDI/Evenex XML envelope seen
in the real sample files at `issues/NIMBUS-129/example edi files/` (`order1.xml`, `order2.xml`,
nested `Header`/`Body`/`Parties`/`Lines` structure). Those samples were reference material for real
field values (used by NIMBUS-147 to shape the canonical schema), not the literal wire format
customers will submit going forward. This means:

- JSON submissions require **validation only** (schema check against the canonical contract) — no
  restructuring.
- XML submissions require validation plus a close-to-1:1 tag mapping via the `xml-to-json` policy
  against the canonical-mirroring XML representation NIMBUS-147 defines — not a structural remap
  of a differently-shaped envelope.

**Path-token redaction (deliberately dropped, confirmed):** the epic's original non-functional
requirement to redact the customer's URL path token from APIM/Logic App/Medusa/proxy logs and
telemetry is explicitly **out of scope for this story**, by the user's decision — the token may
appear in logs. This is recorded here as a deliberate risk-acceptance decision, not an oversight,
so it isn't silently reintroduced by a future story assuming the epic's original wording still
applies.

## Requirements

### Functional

- Configure (as a documented, manually-applied APIM policy) a public order-ingestion endpoint that
  accepts both `application/json` and `application/xml` (or `text/xml`) content types.
- Validate the incoming payload against NIMBUS-147's canonical contract: JSON payloads validated
  directly against the canonical JSON schema; XML payloads validated against the canonical-mirroring
  XML representation NIMBUS-147 defines (both a `validate-content` style policy using JSON
  Schema/XSD as appropriate).
- For XML submissions, normalize to canonical JSON using the Azure APIM `xml-to-json` policy
  (https://learn.microsoft.com/en-us/azure/api-management/xml-to-json-policy), producing output
  structurally equivalent to a native canonical JSON submission.
- Reject payloads that fail contract validation with a safe, structured error response (no internal
  exception detail, no credentials, no raw payload echoed back beyond what's needed to locate the
  error).
- Forward validated, canonical-JSON-normalized requests onward through the integration (to
  NIMBUS-146) unchanged in content, preserving the customer's URL path token as-is for NIMBUS-146
  to validate downstream.
- Enforce HTTPS for all incoming traffic; reject or redirect non-HTTPS requests per APIM's standard
  mechanism.

### Non-Functional

- No credentials, internal exception stack traces, or sensitive payload contents are exposed in
  error responses.
- **Path-token log redaction is explicitly out of scope** (see Background) — do not implement
  masking/redaction of the URL path token in this story.
- No code changes to this repository's `apps/backend` or `apps/storefront` — this story's
  deliverable is APIM policy configuration only.

## Affected Apps

- **backend** — not involved (no code changes).
- **storefront** — not involved.
- **Azure integration** — the entire deliverable: APIM policy XML (content-type handling, contract
  validation, `xml-to-json` normalization, HTTPS enforcement, error responses), authored here as a
  reference artifact and applied manually in the Azure Portal, consistent with how the existing
  example endpoint (shared via Jira comment) is managed today.

## Proposed Structure

High-level task breakdown for the implementation planner:

1. Define the JSON Schema for canonical-JSON-shaped incoming payloads, sourced from NIMBUS-147's
   finalized canonical contract.
2. Define the XSD (or equivalent APIM-consumable schema) for the canonical-mirroring XML
   representation, sourced from NIMBUS-147's XML representation.
3. Author the APIM inbound policy: content-type branching (`choose` on `Content-Type`), contract
   validation (`validate-content` for both JSON and XML branches), `xml-to-json` transformation for
   the XML branch, HTTPS enforcement, and forwarding to the next stage (NIMBUS-146) with the path
   token preserved unchanged.
4. Author the `on-error` policy for safe, structured error responses on validation failure.
5. Document the policy XML and both schemas as reference artifacts in `issues/NIMBUS-145/` for
   manual application in the Azure Portal (no automated deployment/IaC introduced).
6. Tests: to the extent APIM policies can be tested outside a live Azure environment (e.g. via
   Azure APIM's policy trace/test tooling, or documented manual test payloads for both content
   types, valid and invalid) — exact test approach is a planner decision, since no existing test
   infrastructure covers Azure APIM in this repo.

## Open Questions

- **Exact APIM resource/API definition this policy attaches to** — new API or existing API
  revision; naming/versioning conventions — deferred to the planner, informed by how the existing
  example endpoint is organized in the Azure Portal (not visible from this repo).
- **Exact JSON Schema / XSD artifact format and validation policy syntax** (APIM's `validate-content`
  has specific schema-reference requirements) — a planner-level implementation detail.
- **Content-Type branching mechanics for content that fails to declare a content type**, or declares
  an unsupported one — reject with 415, or attempt best-effort detection? Left to the planner.

## Dependencies

- **NIMBUS-147** — supplies the canonical JSON schema and its canonical-mirroring XML
  representation that this story validates against and transforms into.
- **NIMBUS-146** — receives this story's output (canonical JSON, path token preserved) and performs
  token validation and routing; NIMBUS-145 does not validate the token itself.
- **NIMBUS-144** — the ultimate Medusa-side receiving endpoint downstream of NIMBUS-146; not called
  directly by this story.
- Existing (unrelated) APIM endpoint example shared via Jira comment on this issue — used as the
  precedent for how policies are authored and applied in this environment (inline XML,
  `rewrite-uri`/`set-backend-service` pattern, manual Portal application).
