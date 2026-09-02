# Task 02: Logic App Workflow — Token Validation and Order Routing — Implementation Plan

**Status:** TODO
**App:** azure-integration (no `apps/backend` or `apps/storefront` code changes)
**App Root:** `issues/NIMBUS-146/artifacts` (deliverables live in this issue folder, not in `apps/`)
**Task ID:** 02
**Date:** 2026-09-02
**Branch:** feature/NIMBUS-146-token-validation-routing (from develop)
**Depends on:** Task 01 (needs the token-list `Value` encoding decided there: `"<token>::<customerNumber>"`)

---

## Project Environment

- **App root:** `issues/NIMBUS-146/artifacts`
- **Build/Lint/Test commands:** N/A — this task produces a Logic App Workflow Definition Language
  (WDL) JSON document and a deployment instructions document, applied manually in the Azure
  Portal, not compiled/linted/tested by this repo's tooling.
- **Test location:** See Task 03 for documented manual test payloads.

## Context — the fixed contract this workflow calls (do not redesign)

NIMBUS-144's Medusa receiving endpoint is already fixed by NIMBUS-129's approved implementation
plan (`issues/NIMBUS-129/05-order-api-route-implementation.md`). **Read that file's "Resolved
decisions" and "Solution Design" sections before touching this task** — the facts below are
extracted from it and must not be re-derived or changed here:

- **Endpoint:** `POST /orderapi/orders?customerNumber=<value>` — `customerNumber` is a required
  query-string parameter (400 if missing/empty).
- **Auth:** Medusa's built-in secret API key over **HTTP Basic auth** —
  `authenticate('user', ['api-key'])`. The secret key is the Basic-auth **username**, with an
  **empty password** (verified against Task 05's own curl example: `-u "sk_your_secret_key_here:"`
  — note the trailing colon, empty password). Concretely, the `Authorization` header value is:
  `Basic ` + base64(`<secret-api-key>:`) — the colon before the closing quote matters, do not omit
  it.
- **Body:** the canonical JSON order payload, forwarded **unchanged** — Medusa validates it
  against `CanonicalOrderSchema` (`apps/backend/src/modules/order-ingestion/canonical-order-schema.ts`,
  once Task 02 of NIMBUS-129 is implemented). This Logic App does **not** re-validate or transform
  the body — that's NIMBUS-145 (structural) and NIMBUS-147 (canonical/business) responsibility,
  both upstream/downstream of this story.
- **Response contract:**
  - `201` — `{ "order_id": "order_...", "status": "pending" }` (order created).
  - `400` — structural/query validation failure (e.g. missing `customerNumber`, malformed body).
  - `401` — missing/invalid secret API key (this Logic App's own credential problem, not the
    customer's token).
  - `404` — `customerNumber` doesn't match any known company.
  - `422` — duplicate `externalOrderNumber` for that company.
- **This Logic App must pass all of these statuses straight back to the caller unchanged** — it is
  a routing/auth layer, not a business-logic layer. Do not translate Medusa's 4xx responses into a
  different shape.

**Important caveat on the current state of NIMBUS-144:** as of this planning pass, NIMBUS-129's
Task 05 (the actual `POST /orderapi/orders` route) has **not been implemented in this repository
yet** — it exists only as an approved plan awaiting dispatch. This Logic App workflow is designed
against that approved, fixed contract (the plan is the source of truth per NIMBUS-129's own
PROGRESS.md), but **cannot be end-to-end tested against a live endpoint until NIMBUS-129's Task 05
is implemented and deployed**. Task 03's test payloads document this dependency explicitly.

## Solution Design

Single Logic App Consumption workflow (Workflow Definition Language, schema
`2016-06-01/workflowdefinition.json`), matching the example's overall shape (HTTP trigger →
`Get_APIkeys`-style fetch → parse → match → branch), extended with a customer-number extraction
step and a real downstream call instead of the example's blob-return branch:

```
Trigger: manual (Request/Http), relativePath "orders/{token}"
  -> Get_Token_List (Http GET, GlobalLists API)
  -> Parse_Token_List (ParseJson)
  -> Filter_Matching_Token (Query / "Filter array", matches on token portion of Value)
  -> Condition_Token_Matched (If length(filtered array) > 0)
       True branch:
         -> Compose_Customer_Number (Compose, extracts customerNumber portion of Value)
         -> Condition_Customer_Number_Present (If customerNumber is neither null nor empty)
              True branch:
                -> Forward_Order_To_Medusa (Http POST, Basic auth)
                -> Response_Success (passes through Medusa's real status/body, including 4xx)
              False branch:
                -> Response_Not_Allowed (Response, 401, {"error":"Not allowed"})
       False branch:
         -> Response_Unauthorized (Response, 401, generic message, token never included)
```

**Customer-number guard:** a token match alone is not sufficient authorization to forward an
order. `Condition_Customer_Number_Present` evaluates
`not(equals(coalesce(outputs('Compose_Customer_Number'), ''), ''))`, so both JSON `null` and the
empty string take `Response_Not_Allowed`. That branch returns `401` with the fixed body
`{"error":"Not allowed"}`, does not call Medusa, and does not echo either the token or the invalid
customer-number value. The primary delimiter design reaches this branch for entries such as
`"token::"`; the fallback dedicated-field design reaches it when `CustomerNumber` is missing,
`null`, or `""`.

**Why `Forward_Order_To_Medusa` must run on `Succeeded` AND `Failed`:** Azure Logic Apps marks an
HTTP action's status as `Failed` whenever the response status code is 4xx/5xx. If
`Response_Success` only ran after `Succeeded`, a legitimate Medusa `404`/`422`/`400` would never
reach the caller — the workflow would instead surface a generic Logic-App-level failure. Listing
both `"Succeeded"` and `"Failed"` in `Response_Success`'s `runAfter` is what makes accurate
pass-through of Medusa's real status code possible. `retryPolicy: { "type": "none" }` on
`Forward_Order_To_Medusa` avoids retrying on 4xx responses (they are validation/business
rejections, not transient failures — retrying wastes time and cannot change the outcome).

**HTTPS enforcement:** an Azure Logic App Consumption "Request" trigger's generated callback URL
is HTTPS-only by construction — there is no HTTP variant of the trigger endpoint to disable. This
satisfies the "Enforce HTTPS" requirement without additional workflow logic. Document this
explicitly in the deployment instructions (below) rather than adding dead configuration — see
"Decisions & Trade-offs" in PLAN.md for the full reasoning. As additional defense-in-depth, the
Logic App's trigger URL must only ever be reached via NIMBUS-145's APIM `set-backend-service`
routing (already HTTPS-enforced at the APIM layer per NIMBUS-145's SCOPE.md), never distributed
for direct external access.

**Secret storage for the Logic App's own Medusa credential (resolves the open question flagged in
SCOPE.md):** the workflow defines `medusaSecretApiKey` as a `securestring` workflow parameter
rather than hardcoding it inline. This works uniformly whether the value is ultimately populated
from:
- a Key Vault reference (**recommended** — for a Consumption Logic App, this means the ARM
  template/parameters file supplying this parameter's value via
  `[reference(resourceId('Microsoft.KeyVault/vaults/secrets', ...), '2015-06-01').secretValueText]`
  or the deployment pipeline resolving it from Key Vault before deployment; for a Standard Logic
  App, an app setting using `@Microsoft.KeyVault(SecretUri=...)` referenced as the parameter's
  default), or
- a plain Logic App parameter entered directly in the Portal (simpler, acceptable given this is
  described as an internal Azure credential never distributed externally — same trust argument
  NIMBUS-129's Task 05 already accepted for Medusa's side of this same credential).

**Which of these two applies depends on whether this environment's Logic Apps are Consumption or
Standard plan and whether Key Vault is already provisioned for this project — not visible from
this repository, flagged for the environment owner to confirm at deployment time** (see
deployment-instructions.md's checklist).

## Deliverable 1: New File — `issues/NIMBUS-146/artifacts/logic-app-workflow-definition.json`

Write this file with **exactly** the following content (this is the full, valid Workflow
Definition Language document — copy verbatim, only the placeholder parameter default values
starting with `<` need environment-specific values filled in at deployment time, not during this
task):

```json
{
  "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "globalListsApiUrl": {
      "type": "string",
      "defaultValue": "<GLOBALLISTS_API_URL_TBD - see issues/NIMBUS-146/artifacts/token-list-schema.md>"
    },
    "globalListsApiKey": {
      "type": "securestring",
      "defaultValue": ""
    },
    "medusaOrderApiBaseUrl": {
      "type": "string",
      "defaultValue": "<MEDUSA_ORDER_API_BASE_URL_TBD - e.g. https://<env>.medusa.example.com>"
    },
    "medusaSecretApiKey": {
      "type": "securestring",
      "defaultValue": ""
    }
  },
  "triggers": {
    "manual": {
      "type": "Request",
      "kind": "Http",
      "inputs": {
        "method": "POST",
        "relativePath": "orders/{token}",
        "schema": {
          "type": "object"
        }
      }
    }
  },
  "actions": {
    "Get_Token_List": {
      "type": "Http",
      "runAfter": {},
      "inputs": {
        "method": "GET",
        "uri": "@parameters('globalListsApiUrl')",
        "headers": {
          "Ocp-Apim-Subscription-Key": "@parameters('globalListsApiKey')"
        },
        "retryPolicy": {
          "type": "none"
        }
      }
    },
    "Parse_Token_List": {
      "type": "ParseJson",
      "runAfter": {
        "Get_Token_List": ["Succeeded"]
      },
      "inputs": {
        "content": "@body('Get_Token_List')",
        "schema": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "Uid": { "type": "string" },
              "SortOrder": { "type": "integer" },
              "Value": { "type": "string" }
            }
          }
        }
      }
    },
    "Filter_Matching_Token": {
      "type": "Query",
      "runAfter": {
        "Parse_Token_List": ["Succeeded"]
      },
      "inputs": {
        "from": "@body('Parse_Token_List')",
        "where": "@equals(first(split(item()?['Value'], '::')), triggerOutputs()?['relativePathParameters']?['token'])"
      }
    },
    "Condition_Token_Matched": {
      "type": "If",
      "runAfter": {
        "Filter_Matching_Token": ["Succeeded"]
      },
      "expression": {
        "and": [
          {
            "greater": ["@length(body('Filter_Matching_Token'))", 0]
          }
        ]
      },
      "actions": {
        "Compose_Customer_Number": {
          "type": "Compose",
          "runAfter": {},
          "inputs": "@last(split(first(body('Filter_Matching_Token'))?['Value'], '::'))"
        },
        "Condition_Customer_Number_Present": {
          "type": "If",
          "runAfter": {
            "Compose_Customer_Number": ["Succeeded"]
          },
          "expression": "@not(equals(coalesce(outputs('Compose_Customer_Number'), ''), ''))",
          "actions": {
            "Forward_Order_To_Medusa": {
              "type": "Http",
              "runAfter": {},
              "inputs": {
                "method": "POST",
                "uri": "@concat(parameters('medusaOrderApiBaseUrl'), '/orderapi/orders?customerNumber=', outputs('Compose_Customer_Number'))",
                "headers": {
                  "Content-Type": "application/json",
                  "Authorization": "@concat('Basic ', base64(concat(parameters('medusaSecretApiKey'), ':')))"
                },
                "body": "@triggerBody()",
                "retryPolicy": {
                  "type": "none"
                }
              }
            },
            "Response_Success": {
              "type": "Response",
              "runAfter": {
                "Forward_Order_To_Medusa": ["Succeeded", "Failed"]
              },
              "inputs": {
                "statusCode": "@outputs('Forward_Order_To_Medusa')['statusCode']",
                "headers": {
                  "Content-Type": "application/json"
                },
                "body": "@body('Forward_Order_To_Medusa')"
              }
            }
          },
          "else": {
            "actions": {
              "Response_Not_Allowed": {
                "type": "Response",
                "runAfter": {},
                "inputs": {
                  "statusCode": 401,
                  "headers": {
                    "Content-Type": "application/json"
                  },
                  "body": {
                    "error": "Not allowed"
                  }
                }
              }
            }
          }
        }
      },
      "else": {
        "actions": {
          "Response_Unauthorized": {
            "type": "Response",
            "runAfter": {},
            "inputs": {
              "statusCode": 401,
              "headers": {
                "Content-Type": "application/json"
              },
              "body": {
                "error": "Token not recognized"
              }
            }
          }
        }
      }
    }
  },
  "outputs": {}
}
```

**Do not change:** the customer-number guard expression, the `runAfter` values (especially
`Response_Success`'s `["Succeeded", "Failed"]`), the `retryPolicy: { "type": "none" }` entries,
the `::` split logic (must match Task 01's `Value` encoding exactly), or the Basic-auth
`concat('Basic ', base64(concat(...)))` construction (must exactly mirror Task 05's
`-u "sk_key:"` convention — trailing colon before base64-encoding).

**If Task 01's fallback design (dedicated `CustomerNumber` field) is used instead of the primary
`::`-delimited design:** change `Filter_Matching_Token`'s `where` clause to
`"@equals(item()?['Value'], triggerOutputs()?['relativePathParameters']?['token'])"` (direct
equality, no split), and `Compose_Customer_Number`'s `inputs` to
`"@first(body('Filter_Matching_Token'))?['CustomerNumber']"` (direct field read, no split). Also
add `"CustomerNumber": { "type": ["string", "null"] }` to `Parse_Token_List`'s item schema so a
JSON `null` reaches the explicit authorization guard instead of failing the parse action.
Keep `Condition_Customer_Number_Present` unchanged: `coalesce(..., '')` deliberately handles a
missing or `null` dedicated field as well as an empty string.

## Deliverable 2: New File — `issues/NIMBUS-146/artifacts/deployment-instructions.md`

Write this file with the following content:

```markdown
# NIMBUS-146 — Logic App Deployment Instructions (Manual Azure Portal Application)

No Azure infrastructure-as-code exists in this repository (consistent with NIMBUS-145's operating
model). This Logic App is applied manually in the Azure Portal using
`logic-app-workflow-definition.json` in this same folder as the source of truth for the workflow
definition.

## Prerequisites checklist (confirm before deploying — none of these are resolvable from this repo)

- [ ] Confirm this environment's Logic Apps are Consumption or Standard plan (affects how the
      `medusaSecretApiKey` and `globalListsApiKey` secure parameters get their real values — see
      "Secret storage" below).
- [ ] Confirm whether Azure Key Vault is already provisioned for this project. If yes, use it for
      both secure parameters (recommended). If no, plain securestring parameters entered directly
      in the Portal are an accepted fallback for this internal-only credential (same trust
      reasoning already accepted for the Medusa side of this credential in
      `issues/NIMBUS-129/05-order-api-route-implementation.md`).
- [ ] Confirm the real GlobalLists API URL, list identifier, and auth mechanism (see
      `token-list-schema.md`'s "Store identity" section, and populate that document's `<TBD - ...>`
      placeholders once known).
- [ ] Confirm NIMBUS-129's `POST /orderapi/orders` endpoint (NIMBUS-144) has actually been
      deployed to the target Medusa environment before routing live traffic here — as of this
      planning pass it exists only as an approved, undeployed implementation plan.
- [ ] Obtain a Medusa secret API key (`sk_...`) issued specifically for this Logic App, following
      Task 05's "Manual Verification" steps (Admin dashboard → Settings → API Key Management →
      create a **Secret** key). This is a separate credential from the customer's own token.

## Steps

1. In the Azure Portal, create a new Logic App (Consumption) resource — or a new workflow within
   an existing Standard Logic App — named per this project's naming convention (confirm with the
   Azure environment owner; no established convention is visible from this repository).
2. Open the workflow's **Logic app code view** and paste the full contents of
   `logic-app-workflow-definition.json` from this folder, replacing the default empty
   definition.
3. Set the workflow parameters (via the Portal's parameter editor, or an ARM parameters file if
   this environment deploys Logic Apps via ARM templates elsewhere):
   - `globalListsApiUrl` — the real GlobalLists API URL for this project's token list (from
     `token-list-schema.md`).
   - `globalListsApiKey` — the real auth credential for reading that list, as a Key Vault
     reference if Key Vault is available, otherwise entered directly as a secure parameter.
   - `medusaOrderApiBaseUrl` — the target Medusa environment's base URL (e.g. the Medusa Cloud
     environment URL for the environment this Logic App routes to).
   - `medusaSecretApiKey` — the `sk_...` secret API key obtained in the prerequisites, as a Key
     Vault reference if available, otherwise entered directly as a secure parameter.
4. Save the workflow and copy its generated HTTP trigger callback URL (Azure auto-generates this
   as an HTTPS URL with a SAS-style signature — this satisfies the HTTPS-enforcement requirement
   without further configuration).
5. Hand the trigger callback URL to whoever configures NIMBUS-145's APIM policy
   (`set-backend-service`) — this Logic App's endpoint must only ever be reached through APIM, not
   distributed for direct external access.
6. Populate the real GlobalLists list with authorized customer tokens per
   `token-list-schema.md`'s entry schema before enabling live traffic.
7. Run through Task 03's documented test payloads against this deployed workflow (via the Portal's
   "Run Trigger" / test tooling, or a manual HTTPS client) before considering this story done.

## Rollback

Disable the Logic App trigger (Portal → Overview → Disable) to stop accepting traffic without
deleting the resource, if a rollback is needed after deployment.
```

## Impacted Files

None in `apps/backend` or `apps/storefront` — both are explicitly not involved per SCOPE.md. No
existing repository files are modified by this task; both deliverables are new files.

## Test Cases

This task's own test cases cover the **workflow definition's internal correctness** (expression
logic), not live Azure execution (that's Task 03, which requires an actual deployment):

### TC-1: Matched token resolves the correct customer number (happy path, traced through the expressions)
- **Given:** `Parse_Token_List` output contains
  `{ "Uid": "1", "SortOrder": 1, "Value": "a1b2c3d4e5f6::579000283084" }` and the trigger's path
  token is `a1b2c3d4e5f6`.
- **When:** `Filter_Matching_Token`'s `where` expression evaluates
  `equals(first(split("a1b2c3d4e5f6::579000283084", '::')), "a1b2c3d4e5f6")`.
- **Then:** The expression evaluates `true` (first split part is `"a1b2c3d4e5f6"`, matching the
  path token exactly), the entry is included in the filtered array, and
  `Compose_Customer_Number`'s `last(split(..., '::'))` yields `"579000283084"`.

### TC-2: Matched token with a null or empty customer number is not allowed (edge case)
- **Given:** The token matches an entry, but `Compose_Customer_Number` resolves to `""` for the
  primary `"token::"` representation, or to `null`/`""` for the fallback dedicated-field design.
- **When:** `Condition_Customer_Number_Present` evaluates
  `not(equals(coalesce(outputs('Compose_Customer_Number'), ''), ''))`.
- **Then:** The expression evaluates `false`, `Response_Not_Allowed` returns `401` with body
  `{"error":"Not allowed"}`, and `Forward_Order_To_Medusa` does not run.

### TC-3: Unmatched token produces an empty filtered array and takes the else branch (edge case)
- **Given:** The trigger's path token is `does-not-exist` and no list entry's `Value` starts with
  that token before `::`.
- **When:** `Filter_Matching_Token` runs.
- **Then:** `body('Filter_Matching_Token')` is `[]`, `length(...)` is `0`,
  `Condition_Token_Matched`'s expression evaluates `false`, and the `else` branch's
  `Response_Unauthorized` action runs, returning `401` with body `{"error": "Token not
  recognized"}` — no token value anywhere in that response body.

### TC-4: A Medusa 4xx response passes through unchanged (wiring/integration test)
- **Given:** `Forward_Order_To_Medusa` receives a `404` response from Medusa (e.g. unrecognized
  `customerNumber`, per NIMBUS-144's contract) with body
  `{ "message": "...", "type": "not_found" }`.
- **When:** The HTTP action completes — Logic Apps marks this action's status `Failed` because the
  status code is 4xx.
- **Then:** Because `Response_Success`'s `runAfter` lists both `"Succeeded"` and `"Failed"`, it
  still runs, and returns `statusCode: 404` with Medusa's exact response body — the caller sees
  the real `404`, not a generic Logic-App-level error page.

## Implementation Steps

1. Create `issues/NIMBUS-146/artifacts/logic-app-workflow-definition.json` exactly as shown above.
2. Create `issues/NIMBUS-146/artifacts/deployment-instructions.md` exactly as shown above.
3. Validate the JSON is syntactically well-formed (e.g. `node -e "JSON.parse(require('fs').readFileSync('issues/NIMBUS-146/artifacts/logic-app-workflow-definition.json','utf8'))"`
   from the repo root, or any JSON validator) — this is the only mechanical check available
   without a live Azure deployment.
4. Do not attempt to actually deploy this to Azure as part of this task — deployment is a manual
   Portal step performed by the Azure environment owner, following
   `deployment-instructions.md`, once its prerequisites checklist is satisfied.
