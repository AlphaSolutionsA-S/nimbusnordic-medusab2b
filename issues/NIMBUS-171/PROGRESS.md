# NIMBUS-171: Validate country codes in submitted orders

## 2026-09-29 - Created from NIMBUS-149 code review

- **Outcome:** Follow-up to NIMBUS-147 raised in Jira (child of epic NIMBUS-129, linked to
  NIMBUS-147 and NIMBUS-149). The canonical schema accepts any string for `country`
  (`apps/backend/src/modules/order-ingestion/canonical-order-schema.ts`, `z.string().min(1)`),
  and since NIMBUS-149 `mapCanonicalOrderHeader`
  (`apps/backend/src/workflows/order-ingestion/utils/map-canonical-order-header.ts`) lowercases
  it straight into the order address's `country_code`. Values like "DNK" or "Denmark" are stored
  as invalid codes. Decide whether validation lives in the zod schema, in NIMBUS-145's APIM
  contract, or both, and update the XML/JSON contract docs.
- **Handover to:** scoper agent
- **Handover prompt:** Scope NIMBUS-171 from this PROGRESS.md and the Jira issue: require
  ISO 3166-1 alpha-2 country codes on canonical order addresses, reject invalid values with a
  validation error before order creation, and reflect the rule in the NIMBUS-147/NIMBUS-145
  contracts. Create SCOPE.md in this folder.
