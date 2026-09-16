# Task 02 — Read-only storefront company profile

**App:** storefront
**Depends on:** 01
**Base branch:** \`develop\`

## Goal

Render the existing company profile as a complete, responsive, read-only view. The component
uses the server-authorized response from Task 01 and contains no client-side authorization or
company mutation behavior.

## Files

### Modify: \`apps/storefront/src/modules/account/components/company-card/index.tsx\`

- Remove \`use client\`, editing state, form handlers, inputs, selects, buttons, toast calls, and
  the \`updateCompany\` import.
- Use the project's existing Container/Text presentation conventions to render a label/value grid.
- Always render labels for permitted basic fields and render an empty value for null/empty data.
- Render a financial row only if its key exists in the authorized response. Do not show a role
  explanation, disabled control, or contact guidance.
- Include the NIMBUS-156 fields that are permitted by the response: BC customer number, VAT
  number, blocked status, credit limit, and currency, in addition to the existing address and
  core company details.

### Modify: \`apps/storefront/src/lib/data/companies.ts\` and company response types

- Remove \`updateCompany\` and \`StoreUpdateCompany\` if they become unused.
- Align \`QueryCompany\`/HTTP types with Task 01's optional redacted financial fields; no client
  type may promise access to a value omitted from a non-admin response.
- Keep SDK use through \`sdk.client.fetch\`; do not introduce \`fetch\` or manual JSON serialization.

### Modify: storefront message files and tests

- Add labels for every newly shown field in all currently supported locale files, following the
  existing \`Account.companyCard\` translation structure.
- Extend \`company-card\` and company-page tests. Add an explicit test that no Edit, Save, Cancel,
  textbox, combobox, or form is rendered and that blank basic values retain their labels.

## Test cases

- **TC-1:** basic data and blank values render as a readable label/value list.
- **TC-2:** the component renders permitted BC values when supplied by the server.
- **TC-3:** absent financial keys render no corresponding financial row.
- **TC-4:** no company mutation UI or helper call exists.
- **TC-5:** the account company page still renders its headings and preserves the surrounding
  account sections.

## Validation

- Run the focused storefront Jest tests, then the storefront type-check/build configured by
  \`apps/storefront/package.json\`.
- Check desktop and narrow layout manually: labels and values must remain legible without an
  edit-state interaction.
