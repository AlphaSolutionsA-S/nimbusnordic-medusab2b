# NIMBUS-145 — APIM Deployment Instructions

No Azure infrastructure-as-code exists in this repository. Apply these artifacts by hand in the
Azure Portal, the same way as the existing example APIM endpoint and NIMBUS-146's Logic App.

| Artifact | Purpose |
|---|---|
| `canonical-order-schema.json` | JSON Schema used by `validate-content` for `application/json` (schema id `canonical-order-json`) |
| `canonical-order-schema.xsd` | XSD used by `validate-content` for `application/xml` / `text/xml` (schema id `canonical-order-xml`) |
| `apim-policy.xml` | Operation policy: content-type branching, validation, XML to JSON, forwarding, safe errors |
| `test-payloads.md` | Manual verification cases |

Request pipeline:

```
Customer  --HTTPS POST /<api-suffix>/orders/{token}-->  APIM (this story)
          --POST <logic-app>/orders/{token}?api-version&sp&sv&sig, canonical JSON-->  Logic App (NIMBUS-146)
          --POST /orderapi/orders?customerNumber=...-->  Medusa (NIMBUS-129)
```

## Source of the contract

Both schemas are derived from the implemented zod schema
`apps/backend/src/modules/order-ingestion/canonical-order-schema.ts` (NIMBUS-147, delivered as
part of NIMBUS-129), not from the older planning text. If that file changes, update both schemas
to match.

- Required on the order: `externalOrderNumber`, `orderDate`, `currencyCode`, `lines` (at least 1).
- Required on a line: `lineNumber`, `eanNo`, `quantity`. Everything else, `unitPrice` included, is
  optional.
- Dates are `DD-MM-YYYY`. `eanNo` is exactly 13 digits and stays a string. `currencyCode` is 3 letters.
- Unknown fields are rejected, as with zod's `.strict()`.
- The XML form mirrors the JSON 1:1. Element names are the JSON property names in camelCase, there
  is no namespace, the root is `<canonicalOrder>`, and lines are `<lines><line>…</line></lines>`.
  Numbers use a dot as the decimal separator. Comma decimals such as `134,75` fail the XSD with a
  400, so the policy does not normalize them.
- Three rules APIM cannot fully enforce are left to the Medusa endpoint, which still validates every
  request with zod:
  - Real-calendar dates: `31-02-2026` passes APIM and is rejected by Medusa with a 400.
  - Unique `lineNumber`: the XSD enforces it with `xs:unique`, but JSON Schema cannot, so a JSON
    request with duplicate line numbers is rejected by Medusa with a 400.
  - ISO country codes (NIMBUS-171): APIM checks only that an address `country` is two letters, any
    case, with optional surrounding space/tab/CR/LF. `XX` passes APIM and is rejected by Medusa with
    a 400 that names the field. The ISO 3166-1 alpha-2 list and its exceptions allowlist live only
    in `apps/backend/src/modules/order-ingestion/country-code.ts`. After changing either schema,
    re-register both in APIM (section 2) and run test-payloads TC-16 and TC-17.

## Prerequisites

- [ ] NIMBUS-146's Logic App is deployed and you have its trigger callback URL (NIMBUS-146
      `deployment-instructions.md`, step 4). The trigger's `relativePath` is `orders/{token}`.
- [ ] You know the APIM instance, and its tier, that will host the public order API (see Open items).
- [ ] You have decided whether this is a new API or an operation on an existing API (see Open items).

## 1. Split the Logic App callback URL into named values

The callback URL carries a SAS signature (`sig`) that grants anyone who has it the right to
invoke the workflow. Keep it in APIM only, as a secret named value, and never give it to customers.

Callback URL shapes:

- Consumption:
  `https://<host>/workflows/<id>/triggers/manual/paths/invoke/orders/{token}?api-version=2016-10-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=<sig>`
- Standard:
  `https://<app>.azurewebsites.net/api/<workflow>/triggers/manual/invoke/orders/{token}?api-version=2022-05-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=<sig>`

In **APIM → Named values → + Add**, create:

| Name | Type | Value |
|---|---|---|
| `nimbus-order-logicapp-base-url` | Plain | Everything before `/orders/{token}`, with no query string, e.g. `https://<host>/workflows/<id>/triggers/manual/paths/invoke` |
| `nimbus-order-logicapp-api-version` | Plain | The `api-version` value from the callback URL |
| `nimbus-order-logicapp-sig` | **Secret**, or a Key Vault reference if the project has Key Vault | The `sig` value from the callback URL |

The policy sets `sp=/triggers/manual/run` and `sv=1.0` directly. APIM URL-encodes query values,
so `sp` goes out as `%2Ftriggers%2Fmanual%2Frun`, matching the callback URL. If the callback URL
you copied has different `sp`/`sv` values, change them in `apim-policy.xml`.

How the path token is forwarded: `rewrite-uri template="/orders/{token}"` puts this request's
`{token}` path parameter after the base URL and drops any query parameters the caller sent
(`copy-unmatched-params="false"`). The four `set-query-parameter` policies then add the SAS
parameters back. The token is forwarded as-is, and NIMBUS-146 validates it.

## 2. Register the schemas

**APIM → APIs → Schemas → + Add**:

1. Name `canonical-order-json`, type **JSON**, content: `canonical-order-schema.json`.
2. Name `canonical-order-xml`, type **XML**, content: `canonical-order-schema.xsd`.

The ids must match the `schema-id` attributes in `apim-policy.xml`.

## 3. Create the API and operation

1. **APIs → + Add API → HTTP** (or open the existing API chosen under Open items).
   - Display name: `<API_NAME_TBD>`, e.g. `Nimbus Order Ingestion`.
   - Web service URL: leave empty. The policy sets the backend.
   - API URL suffix: `<API_SUFFIX_TBD>`, e.g. `orderapi`.
   - **URL scheme: HTTPS only.** This is how HTTPS is enforced. The gateway then does not serve
     this API over HTTP, so the policy needs no scheme check.
   - Subscription required: `<DECISION_TBD>`. The path token is the customer credential in this
     design. If you require a subscription key, every customer also needs one.
2. **+ Add operation**: display name `Submit order`, method `POST`, URL `/orders/{token}`.
   The template parameter must be named `token`, because `rewrite-uri` refers to it.

## 4. Apply the policy

1. Select the `Submit order` operation, then **Inbound processing → `</>` (code editor)**.
2. Replace the whole document with the contents of `apim-policy.xml` and save.
   - The file uses APIM policy-expression syntax, with quotes inside `@(...)` attributes as in
     Microsoft's policy docs. It is not strict XML, so a generic XML linter will flag it. The APIM
     editor accepts it.
3. If the save fails on the `set-body` expression, see "Verification points" below.

## 5. Verify

Run the cases in `test-payloads.md`. Use **Test** tab tracing (Ocp-Apim-Trace), or the
**Trace** button in the Test tab, to see the transformed body for the XML cases.

## Verification points (not verifiable from this repo)

These behaviours come from Microsoft documentation, not from a live tenant. Check each one during
the first deployment and correct `apim-policy.xml` in place if one is wrong:

1. **`xml-to-json` output shape.** The `set-body` normalization expects
   `{"canonicalOrder": {…, "lines": {"line": {…} | [ … ]}}}`, with leaf values as strings. It was
   exercised locally against Newtonsoft `SerializeXmlNode` output as a stand-in for APIM, and the
   result passed both the JSON Schema and the backend zod schema. Confirm with a
   TC-3/TC-5 trace. If APIM already emits numbers or booleans, the expression leaves them alone.
   If APIM drops the root wrapper, change `converted["canonicalOrder"]` to `converted`.
2. **`always-array-child-elements="false"`** is deliberate, which differs from the plan's `true`.
   Microsoft documents the attribute generically, for child elements, not only `<line>`, so `true`
   may wrap scalar fields in arrays as well. The `set-body` expression handles the single-line case (object) and the
   multi-line case (array) itself.
3. **Error detection in `on-error`.** The 400 is returned when `orderValidationErrors` exists or
   `context.LastError.Source == "validate-content"`. Confirm that TC-2 and TC-4 return the generic
   400 body and not APIM's default validation message.
4. **`max-size="524288"` (512 KB).** Confirm your APIM tier accepts this value for
   `validate-content`.
5. **JSON Schema draft-07** with `definitions`/`$ref` and `format: "email"`. APIM's validator may
   not enforce `format`. Medusa validates `email` in either case.
6. **`schema-ref` omitted.** The JSON schema is the whole document, so no local reference path is
   used.
7. **Media-type matching.** The policy compares the `Content-Type` media type case-insensitively
   and ignores parameters such as `charset`. `validate-content` has an explicit `<content>` entry
   for both `application/xml` and `text/xml`.

## Reconciliation decisions (manifest checklist)

| Checklist item | Resolution |
|---|---|
| XML tag naming | Resolved: camelCase, identical to the JSON property names. NIMBUS-147/129 implemented no XML form in code, so this XSD is the canonical XML representation. `kind="javascript-friendly"` is kept; it controls how attributes and text nodes are shaped, not letter case, and makes no difference to attribute-free camelCase XML. |
| XML root element | Resolved: `<canonicalOrder>`, lines as `<lines><line>`. |
| Decimal comma normalization | Resolved: not needed. The canonical XML uses `xs:decimal` (dot only), and comma decimals get a 400. The plan's assumption that `xs:decimal` accepts commas was wrong; checked against the .NET XSD validator. |
| JSON Schema draft | draft-07. The plan skeleton's `$defs` was a 2019-09 keyword and is corrected to `definitions`. Confirm on first deployment (verification point 5). |
| `schema-ref` for JSON | Omitted (verification point 6). |
| Logic App URL | Resolved structurally: named values plus `rewrite-uri` and `set-query-parameter`, aligned with NIMBUS-146's `orders/{token}` trigger. The real values are still open. |
| APIM tier | **Open** |
| API / operation naming and versioning | **Open** |

## Open items

1. **APIM tier** of the target instance (`validate-content` limits and performance, verification
   point 4).
2. **Real Logic App callback URL.** Populate the three named values after NIMBUS-146 is deployed,
   and note whether the Logic App is Consumption or Standard (this sets the base-URL shape and
   `api-version`).
3. **API/operation structure:** new API or new operation or revision on an existing one, display
   name, URL suffix, and versioning scheme.
4. **Subscription-key requirement** for customers, alongside the path token.
5. **Verification points 1–7** above, on first deployment.

## Scope reminders

- The path token is **not** redacted from APIM logs or traces. This is a deliberate
  risk-acceptance decision (SCOPE.md) and is not an oversight.
- No changes to `apps/backend` or `apps/storefront`.

## Rollback

Remove the operation policy or delete the operation. The Logic App is unaffected. To stop
traffic without deleting anything, disable the Logic App trigger (NIMBUS-146).
