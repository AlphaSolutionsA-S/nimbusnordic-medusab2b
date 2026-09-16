# Task 03 — Admin Business Central warning, indicators, and editable fields

**App:** backend Admin
**Depends on:** NIMBUS-156
**Base branch:** \`develop\`

## Goal

Make overwrite risk explicit on the Admin company detail page while retaining the Admin's ability
to edit all Business Central-managed fields.

## Files

### Modify: \`apps/backend/src/api/admin/companies/query-config.ts\`, \`validators.ts\`, and types

- Include \`blocked\`, \`credit_limit\`, and \`vat_number\` in the Admin company query and response
  types.
- Extend only the Admin create/update validation and type path needed for the existing update
  workflow to accept those fields. Keep store validators unchanged.
- Preserve decimal precision for \`credit_limit\`; do not convert it to minor units.

### Modify: \`apps/backend/src/admin/routes/companies/[companyId]/page.tsx\`

- Place a persistent semantic Medusa UI warning banner above the company detail content.
- State that Business Central is authoritative for managed fields, that a customer login
  overwrites Medusa changes to those fields, and that Medusa-only values are preserved.
- Display name, email, phone, address, city, state, zip, country, blocked status, credit limit,
  VAT number, and currency with a concise \`Business Central-managed\` indicator beside each label.
- Use Medusa UI components and semantic classes; preserve loading behavior and existing actions.

### Modify: \`apps/backend/src/admin/routes/companies/components/company-form.tsx\`

- Add editable controls for blocked status, credit limit, and VAT number.
- Mark every managed editable field listed above with the same indicator. Do not disable any
  control because it is managed by BC.
- Preserve existing SDK mutation, pending state, and query invalidation in the company hooks.

### Add/modify Admin tests near the existing company route/component test convention

- Assert warning copy and all required indicators.
- Assert the Admin update drawer submits the newly editable BC fields and that the API accepts
  them.

## Validation

- Confirm Admin calls use the existing SDK hooks and Admin session auth; no raw \`fetch\`.
- Run focused Admin tests and \`pnpm --filter @b2b-starter/backend build\`.
- Manually edit a managed field as an Admin, save it, refresh the detail page, and confirm the
  warning/indicator remain visible.
