# NIMBUS-146 — Logic App Deployment Instructions

No Azure infrastructure-as-code exists in this repository. Apply this workflow manually in the Azure Portal, using `logic-app-workflow-definition.json` as the source of truth.

## Prerequisites

- [ ] Confirm whether the target Logic App is Consumption or Standard, which determines how secure parameters are populated.
- [ ] Confirm whether the project has Azure Key Vault. Use it for `globalListsApiKey` and `medusaSecretApiKey` if available; otherwise enter secure-string parameters through the Portal.
- [ ] Confirm the real GlobalLists API URL, list identifier, and read-auth mechanism, then populate the placeholders in `token-list-schema.md`.
- [ ] Confirm NIMBUS-129's `POST /orderapi/orders` endpoint is deployed to the intended Medusa environment before routing live traffic.
- [ ] Create a dedicated Medusa secret API key for this Logic App. It is used as the HTTP Basic-auth username with an empty password, supplied through the HTTP action's native `authentication` block so Azure masks it in run history.

## Deployment

1. Create a Consumption Logic App or a workflow in an existing Standard Logic App, following the environment's naming convention.
2. In **Logic app code view**, replace the default definition with `logic-app-workflow-definition.json`.
3. Supply the real `globalListsApiUrl`, `globalListsApiKey`, `medusaOrderApiBaseUrl`, and `medusaSecretApiKey` values securely.
4. Save the workflow and copy its generated HTTPS-only callback URL.
5. Give that callback URL to the NIMBUS-145 APIM owner for its `set-backend-service` configuration; do not distribute it to customers.
6. Populate the dedicated GlobalLists token list using `token-list-schema.md`.
7. Run the manual cases in `test-payloads.md` before enabling live traffic, including TC-4's malformed-entry regression check.

## Secret handling notes

- `Forward_Order_To_Medusa` uses the HTTP action's native `authentication` block (`type: Basic`, the Medusa secret API key as `username`, empty `password`) rather than a hand-built `Authorization` header. Azure masks that block in run history, while leaving the forwarded order body visible for debugging. **If the Portal rejects an empty password**, replace it with an explicit `Authorization: @concat('Basic ', base64(concat(parameters('medusaSecretApiKey'), ':')))` header *and* add `"runtimeConfiguration": {"secureData": {"properties": ["inputs"]}}` to that action — without the second part the key is readable in run history by anyone with Reader on the resource.
- `Get_Token_List` already carries `runtimeConfiguration.secureData` on `inputs`, because its GlobalLists subscription key travels as a custom header that `authentication` cannot express. Only `inputs` is secured; the fetched list stays visible in `outputs` for debugging.
- Neither of these concerns the customer's own path token — redacting that is explicitly out of scope for NIMBUS-146, per SCOPE.md.

## Rollback

Disable the Logic App trigger in the Azure Portal to stop traffic without deleting the resource.
