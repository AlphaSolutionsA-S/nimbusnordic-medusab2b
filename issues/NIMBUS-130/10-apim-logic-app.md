# 10: APIM GET operation and Logic App workflow
**App:** Azure artifacts · **Layer:** none (deploy artifacts) · **Depends on:** 01, 09

**Goal:** Deployable artifacts for the customer path `GET /shipment-notices/{token}`: the APIM
operation policy, a new Logic App Standard workflow in the existing resource, parameters, deployment
instructions and manual test calls.
**Files / areas:** `issues/NIMBUS-130/artifacts/`. Follow the layout of
`issues/NIMBUS-145/artifacts/` and `issues/NIMBUS-146/artifacts/`, which stay untouched.
**Seam contracts:**
- **APIM inbound:** forwards only `after`, `since` and `limit` (`copy-unmatched-params="false"`),
  plus the Logic App's `sig` and `api-version` parameters.
- **APIM outbound,** when `Accept` contains `application/xml`:
  - renders a 200 JSON body to the task 01 XML (root `shipment_notice_response`);
  - renders any error body (400/401/404/5xx, including Logic App 401s and APIM's own errors) to
    `error_response`, mapping both JSON error shapes (task 01);
  - uses `set-body` (`JObject` → `XElement`) and sets `Content-Type: application/xml`.
  Otherwise the JSON passes through.
- **Logic App:**
  - Request trigger `GET shipment-notices/{token}`;
  - the same GlobalLists lookup and 401 bodies as the order workflow;
  - calls `/orderapi/shipment-notices?customerNumber=<url-encoded>` plus the three parameters when
    present, with the same Basic secret-key header;
  - returns Medusa's status and body.
- Run history is not hidden (accepted 2026-10-19).
**Test intent:** MANUAL (deploy artifacts). Test calls:
- unknown token (401);
- token without a customer number (401);
- first call; `after` paging;
- `Accept: application/xml` for a 200 and for a 401 and a 400 (XML error body);
- an injected `customerNumber` query parameter (ignored).
**Done when:** artifacts written; the deployment instructions walk through the task 01 JSON examples
producing the task 01 XML examples, success and error.
**Verify after deploy:** the manual test calls against the deployed APIM return the expected statuses
and XML bodies with roots `shipment_notice_response` and `error_response`.
**Also update:** none found.
