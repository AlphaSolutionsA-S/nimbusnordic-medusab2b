# NIMBUS-130 — Shipment notices: APIM and Logic App deployment instructions

No Azure infrastructure-as-code exists in this repository. Apply these artifacts by hand in the
Azure Portal, the same way as the order path (NIMBUS-145 APIM policy, NIMBUS-146 Logic App).

| Artifact | Goes to |
|---|---|
| `logic-app-workflow-definition.json` | A new workflow `shipment-notices` in the **existing** NIMBUS-146 Logic App (Standard), `workflow.json` |
| `parameters.json` | Nothing new: the workflow uses the four app-level parameters NIMBUS-146 already set |
| `apim-policy.xml` | Operation policy of the new APIM operation `GET /shipment-notices/{token}` |
| `shipment-notice-schema.json`, `shipment-notice-error-schema.json`, `shipment-notice-schema.xsd`, `*.example.*` | Customer documentation (task 01); APIM does not register them |
| `test-calls.md` | Manual test calls after deployment |

Request pipeline:

```
Customer  --HTTPS GET /<api-suffix>/shipment-notices/{token}?after|since&limit, Accept-->  APIM
          --GET <logic-app>/shipment-notices/{token}?after|since&limit&api-version&sp&sv&sig-->  Logic App
          --GET /orderapi/shipment-notices?customerNumber=<from token>&after|since&limit-->  Medusa (task 09)
```

Medusa returns JSON. The Logic App passes Medusa's status and body through, or answers 401 itself.
APIM returns that JSON unchanged, or renders it as XML when the request's `Accept` header contains
`application/xml`.

## Prerequisites

- [ ] The task 09 endpoint `GET /orderapi/shipment-notices` is deployed to the Medusa environment the
      Logic App's `medusaOrderApiBaseUrl` points at, and the shipment-notice poll job runs there.
- [ ] The NIMBUS-146 Logic App and the NIMBUS-145 APIM API are deployed. This workflow reuses their
      GlobalLists token list, parameters and Medusa secret key; the key's Medusa API key is a secret
      key, which the new route accepts like `/orderapi/orders`.
- [ ] Customers who should read notices already have a token in the GlobalLists list with a
      `bccustomernumber` (NIMBUS-146 `token-list-schema.md`). The same token serves orders and
      shipment notices.

## 1. Logic App workflow

1. Open the NIMBUS-146 **Logic App (Standard)** → **Workflows → + Add**. Name `shipment-notices`,
   state type **Stateful** (run history is kept; see "Run history" below).
2. In **Code view**, replace the content with `logic-app-workflow-definition.json` and save.
3. **Parameters:** none to add. `parameters.json` lists the four app-level parameters the workflow
   reads (`globalListsApiUrl`, `struct-api-key`, `medusaOrderApiBaseUrl`, `medusaSecretApiKey`);
   they already hold real values from NIMBUS-146. Do not paste the placeholders over them.
4. On the workflow's **Overview**, copy the trigger's **Workflow URL**. Standard shape:
   `https://<app>.azurewebsites.net/api/shipment-notices/triggers/manual/invoke/shipment-notices/{token}?api-version=2022-05-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=<sig>`.
   The `sig` differs from the order workflow's. Do not give the URL to customers.

What the workflow does (same token check and 401 bodies as the order workflow):

| Step | Behaviour |
|---|---|
| `manual` | Request trigger, method `GET`, relative path `shipment-notices/{token}`; no body |
| `Get_Token_List` → `Parse_Token_List` → `Filter_Matching_Token` | Unchanged from the order workflow: reads the GlobalLists list (inputs hidden in run history) and keeps the entry whose `Value.apikey` equals the path token |
| no entry | `401 {"error":"Token not recognized"}`; Medusa is not called |
| entry without `bccustomernumber` | `401 {"error":"Not allowed"}`; Medusa is not called |
| `Compose_Medusa_Url` | `<medusaOrderApiBaseUrl>/orderapi/shipment-notices?customerNumber=<url-encoded number>`, plus `&after=`, `&since=`, `&limit=` (each url-encoded) only when that query parameter reached the trigger. The trigger's other query parameters (`api-version`, `sp`, `sv`, `sig`) are never forwarded, and `customerNumber` always comes from the token |
| `Get_Shipment_Notices_From_Medusa` | `GET` with `Authorization: basic <medusaSecretApiKey>`, no retries (a read the caller can repeat) |
| `Response_Medusa` | Medusa's status code and JSON body, after success or failure of the call |

The order workflow's unused `Compose_Matched_Value` is not copied.

## 2. APIM named values

In **APIM → Named values → + Add**, split the Workflow URL from step 1.4:

| Name | Type | Value |
|---|---|---|
| `nimbus-shipment-logicapp-base-url` | Plain | Everything before `/shipment-notices/{token}`, no query string, e.g. `https://<app>.azurewebsites.net/api/shipment-notices/triggers/manual/invoke` |
| `nimbus-shipment-logicapp-api-version` | Plain | The `api-version` value from the Workflow URL |
| `nimbus-shipment-logicapp-sig` | **Secret** | The `sig` value from the Workflow URL |

The policy sets `sp=/triggers/manual/run` and `sv=1.0` itself, as the order policy does. If the
copied URL has other `sp`/`sv` values, change them in `apim-policy.xml`.

## 3. APIM operation

1. Open the API that hosts `POST /orders/{token}` (NIMBUS-145) → **+ Add operation**:
   display name `Get shipment notices`, method `GET`, URL `/shipment-notices/{token}`. The template
   parameter must be named `token` (`rewrite-uri` refers to it). Optionally document the query
   parameters `after`, `since` and `limit` on the operation; the policy does not need them declared.
2. Select the operation → **Inbound processing → `</>`**, replace the whole document with
   `apim-policy.xml` and save. Like the order policy, the file uses APIM's expression syntax (quotes
   and generics inside attribute values), so a generic XML linter flags it; the APIM editor accepts
   it. The subscription-key setting and HTTPS-only scheme are the API's, as for orders.

What the policy does:

- **Inbound:** `rewrite-uri template="/shipment-notices/{token}" copy-unmatched-params="false"`
  drops every caller query parameter; `after`, `since` and `limit` are copied back from the original
  URL only when present, then `api-version`, `sp`, `sv` and `sig` are added. An injected
  `customerNumber` never leaves APIM.
- **Outbound:** without `application/xml` in `Accept` the Logic App's JSON passes through. With it,
  a 2xx page becomes `<shipment_notice_response>` and any 4xx/5xx becomes `<error_response>`, via
  `set-body`, with `Content-Type: application/xml` (walkthrough below).
- **On-error:** APIM's own errors (subscription key, rate limit, Logic App unreachable or timed out,
  a failing expression) return the gateway error shape `{"error": <reason code>, "message": ...}`,
  or `<error_response>` with `Accept: application/xml`. Only caller-facing messages (subscription key,
  rate limit, quota, no matching operation) are passed on; backend and expression messages are
  replaced by `The request could not be completed.` so the Logic App URL never reaches a caller.

## 4. How the task 01 JSON examples become the task 01 XML examples

The outbound expression walks the JSON with fixed rules, so each example renders as follows. The
rendering was checked offline (see "Offline check" below): each output equals the XML example and
validates against `shipment-notice-schema.xsd`.

### Success: `shipment-notices.example.json` → `shipment-notices.example.xml`

Status 200 and a `shipment_notices` array, so the root is `<shipment_notice_response>`:

1. Every property becomes an element with the same name, in the JSON order: `"cursor": "1041"` →
   `<cursor>1041</cursor>`, `"has_more": false` → `<has_more>false</has_more>`.
2. A `null` property is omitted: the first notice's `"previous_cursor": null` and
   `"address_line_2": null` / `"state": null` in `sell_to` and `bill_to` have no element; the second
   line's `"line_number": null`, `"ean_no": null`, `"description_2": null` likewise.
3. An object becomes an element holding its properties: `sell_to`, `bill_to`, `ship_to`.
4. An array becomes a wrapper with one element per item: `shipment_notices` holds
   `<shipment_notice>` elements, `lines` holds `<line>` elements.
5. Numbers are written invariantly (`"quantity": 12` → `<quantity>12</quantity>`, a decimal `1.5`
   stays `1.5` on any gateway culture); `recorded_at` keeps the service's form
   `2026-10-20T07:32:05.118Z` (UTC, three fraction digits).
6. The document starts with `<?xml version="1.0" encoding="UTF-8"?>`; no namespace.

### Service error: `error-service.example.json` → `error-service.example.xml`

Medusa's 404 `{"type": "not_found", "message": "Customer not found"}`: status ≥ 400, so the root
is `<error_response>`; `type` becomes `<error>not_found</error>`, `message` becomes
`<message>Customer not found</message>`. A `code` property (Medusa adds it on some errors, e.g. 400
`invalid_data`) is not rendered.

### Gateway error: `error-gateway.example.json` → `error-gateway.example.xml`

The Logic App's 401 `{"error": "Token not recognized"}`: `error` becomes
`<error>Token not recognized</error>`; there is no `message`, so no `<message>` element.

Other error bodies: a Logic App platform error (`{"error": {"code", "message"}}`) gives `code` and
`message`; a body that is not JSON, or has neither `type` nor `error`, gives the HTTP reason phrase
(e.g. `Bad Gateway`) as `<error>`.

### Offline check

The policy's own expressions were compiled from `apim-policy.xml` (extracted verbatim) against
Newtonsoft.Json 13.0.3 with a stand-in `context`, under a comma-decimal culture (`da-DK`), and every
output validated with the .NET XSD validator. Checked: the three examples above (exact match), JSON
pass-through without `application/xml`, an `Accept` list, an empty page, Medusa 400/500 with `code`,
the `Not allowed` 401, a non-JSON 502, an empty 504, a nested Logic App error, APIM's default
`{statusCode, message}` shape, a 302 and a non-page 200 left alone, decimals `1.5`/`0.00005`,
timestamps `.100Z` and `+02:00`, control characters, and the on-error bodies (JSON and XML, the
backend message not leaked). This proves the logic, not the gateway: see the verification points.

## Verification points (only checkable after deploy)

Each comes from Microsoft documentation or the offline stand-in, not from a live tenant. Check it on
the first deployment and correct `apim-policy.xml` in place if it is wrong.

1. **Expressions save and run.** The editor accepts the multi-statement expressions in `set-variable`
   attributes and every type used is on APIM's allow-list (`JObject`, `JToken`, `XElement`,
   `XDeclaration`, `List<T>`, `Regex`, `DateTimeOffset`, `Exception`, `Newtonsoft.Json.Formatting`).
   A runtime failure shows as `500 {"error":"ExpressionValueEvaluationFailure",…}` (on-error).
2. **`JObject.Parse` on the gateway** turns `recorded_at` into a date and back as in the stand-in.
   Test call TC-6 shows the rendered `recorded_at`; it must equal the JSON value of the same call.
3. **Query forwarding.** `context.Request.OriginalUrl.Query` still holds the caller's parameters
   after `rewrite-uri`, and `set-query-parameter` URL-encodes the value (TC-4, TC-11). Check in the
   Logic App run history that the trigger's `queries` hold only `after`/`since`/`limit` and the SAS
   parameters.
4. **On-error status.** `context.Response.StatusCode` holds APIM's intended status (401 for a
   missing subscription key, 429 for a rate limit) when on-error runs; otherwise the policy answers
   500. Check with TC-12 if the API requires a subscription key.
5. **Errors the policy never sees.** A request that matches no operation (wrong path) is answered by
   APIM before this operation's policy runs, so it keeps APIM's default JSON body even with
   `Accept: application/xml`. A rate-limit or quota policy at product scope may also answer before
   this policy. Both are outside the contract's paths.
6. **Logic App GET trigger** exposes the query values as `triggerOutputs()['queries']` (TC-3/TC-4)
   and an absent parameter as `null`, so the parameter is not forwarded.
7. **Medusa unreachable.** If the Medusa call has no status code (DNS, timeout), `Response_Medusa`
   fails and the Logic App answers with its own 5xx error, which APIM renders as an error (TC-13
   optional). This matches the order workflow.

## Run history (accepted 2026-10-19)

- `Get_Token_List` inputs are hidden (`secureData`), so the GlobalLists key is not in run history.
- Nothing else is hidden: the run history shows the customer number, the Medusa secret key (in
  `Get_Shipment_Notices_From_Medusa`'s inputs) and the notices, including addresses (personal data).
  Anyone who can read the Logic App's run history can read them. This was accepted by the human on
  2026-10-19 (plan section 7), as for the order workflow.
- The customer's path token is not redacted in APIM or Logic App logs, as for orders.

## Rollback

Disable the `shipment-notices` workflow (stops traffic; the order workflow is unaffected), or delete
the APIM operation. Nothing in Medusa needs to change: the read endpoint has no side effects.
