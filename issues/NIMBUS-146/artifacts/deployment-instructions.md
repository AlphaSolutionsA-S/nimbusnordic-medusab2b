# NIMBUS-146 — Logic App Deployment Instructions

No Azure infrastructure-as-code exists in this repository. Apply this workflow manually in the Azure Portal.

**Target (decided 2026-10-15):** a Logic App **Standard** (Workflow Standard plan), **no Key Vault**.
All four values, secrets included, are entered directly in the Logic App's `parameters.json`.
No app settings are used.

| File | Goes to |
|---|---|
| `logic-app-workflow-definition.json` | The workflow's `workflow.json` (Standard format: `definition` + `kind: Stateful`) |
| `parameters.json` | The Logic App's **Parameters** (app level, shared by all its workflows), with the real values filled in |

Standard does not support `securestring` / `secureobject` parameters
([Microsoft docs](https://learn.microsoft.com/en-us/azure/logic-apps/create-parameters-workflows)),
so every parameter is a plain `string`. The repo copy of `parameters.json` holds placeholders
only: **enter the real keys in the Portal and never commit them.**

## Prerequisites

- [ ] Confirm the real GlobalLists API URL, list identifier, and read-auth mechanism, then populate the placeholders in `token-list-schema.md`.
- [ ] Confirm NIMBUS-129's `POST /orderapi/orders` endpoint is deployed to the intended Medusa environment before routing live traffic.
- [ ] Create a dedicated Medusa secret API key for this Logic App. It is used as the HTTP Basic-auth username with an empty password.
- [ ] Agree who may access the Logic App resource: without Key Vault, anyone who can open its Parameters, or read its files through the storage account or Kudu, can read both keys.

## Deployment

1. Create a **Logic App (Standard)** resource on a Workflow Standard plan (WS1 is enough for this volume), following the environment's naming convention. Keep **HTTPS Only** on (Settings → Configuration).
2. Under **Workflows → Parameters → Edit in JSON**, paste `parameters.json` and replace the four placeholders with the real values:

   | Parameter | Value |
   |---|---|
   | `globalListsApiUrl` | The GlobalLists list URL from `token-list-schema.md` |
   | `globalListsApiKey` | The GlobalLists subscription key |
   | `medusaOrderApiBaseUrl` | The Medusa backend base URL, no trailing slash |
   | `medusaSecretApiKey` | The dedicated Medusa secret API key |

3. Under **Workflows → Workflows**, add a workflow (state type **Stateful**, so run history is kept). In **Code view**, replace the content with `logic-app-workflow-definition.json` and save.
4. On the workflow's **Overview**, copy the trigger's **Workflow URL**. It has the Standard shape `https://<app>.azurewebsites.net/api/<workflow>/triggers/manual/invoke/orders/{token}?api-version=…&sp=…&sv=1.0&sig=…`.
5. Give that URL to the NIMBUS-145 APIM owner, who uses the **Standard** shape in its `deployment-instructions.md` and stores `sig` as a **Secret** named value (no Key Vault). Do not distribute it to customers.
6. Populate the dedicated GlobalLists token list using `token-list-schema.md`.
7. Run the manual cases in `test-payloads.md` before enabling live traffic, including TC-4's malformed-entry regression check.

## Secret handling notes

- Without `securestring`, a parameter value is not masked by its type.
- `Get_Token_List` carries `runtimeConfiguration.secureData` on `inputs`, so run history hides the GlobalLists key. Its outputs (the fetched list) stay visible for debugging.
- `Forward_Order_To_Medusa` is deliberately **not** secured (decided 2026-10-15): its inputs, including the forwarded order body **and the Medusa secret API key**, are visible in run history for debugging. Anyone who can read the Logic App's run history can read that key.
- If the Portal rejects an empty Basic-auth password, replace the `authentication` block with an `Authorization: @concat('Basic ', base64(concat(parameters('medusaSecretApiKey'), ':')))` header.
- The customer's own path token is not redacted. That is explicitly out of scope for NIMBUS-146, per SCOPE.md.
- Rotating a key: edit its value under **Workflows → Parameters**. No workflow edit is needed.

## Rollback

Disable the workflow (Workflows → the workflow → **Disable**) to stop traffic without deleting the resource.
