# NIMBUS-157: Make company information read-only in the storefront

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-157
**Scope:** \`issues/NIMBUS-157/SCOPE.md\` (approved)
**Branch:** \`feature/NIMBUS-157\` (from \`develop\`)

## Objective

Replace the storefront company-profile editing experience with a complete read-only view, keep
financial company data out of non-admin customer responses, and warn Medusa administrators when
they edit Business Central-managed company values.

## Analysis

NIMBUS-156's company-sync implementation is present in the workspace. It adds the
Business Central-managed \`blocked\`, \`credit_limit\`, and \`vat_number\` fields and updates the
company on a customer login. Its Jira issue remains in Internal review, which is acceptable for
this work because the actual model and synchronization contracts are available locally.

The current storefront company card (\`apps/storefront/src/modules/account/components/company-card/index.tsx\`)
is a client-side edit form with Edit, Save, and Cancel controls. Its \`retrieveCompany\` helper
fetches a store company response that includes the employee relation. The store company route
currently returns its query result unchanged, so it must become the authorization and response
projection boundary; hiding fields only in the card would leak the values to a non-admin caller.

The existing company-admin role is represented as \`company_admin\` in the authenticated provider
identity metadata (see \`src/api/middlewares/ensure-role.ts\` and the employee role workflows).
The financial data boundary must use that existing role and must verify that the authenticated
customer is linked to the requested company before returning the profile. Do not create another
role or trust a company id supplied as authority.

The company-detail Admin route currently displays only a subset of the synchronized fields and
the update drawer exposes the standard editable fields. NIMBUS-156 intentionally did not make
the newly synchronized fields form-writable. NIMBUS-157 explicitly supersedes that choice for
the Admin application only: Admin can edit \`blocked\`, \`credit_limit\`, and \`vat_number\`, while
the storefront continues to have no writable company profile path.

## Authorization and response contract

1. Resolve the authenticated customer from \`req.auth_context\`, then resolve that customer's
   employee-company link server-side. Reject a request for any other company.
2. Determine whether that authenticated identity has the existing \`company_admin\` role.
3. Build the store profile response from an allowlisted field set, rather than serializing the
   broad graph result. For every linked customer, return basic company fields and labels' source
   values: name, email, phone, address, city, state, zip, country, currency, VAT number, logo,
   and BC customer number where the approved scope permits it.
4. Include \`credit_limit\`, \`blocked\`, \`spending_limit_reset_frequency\`, and employee spending
   limits only for a company administrator. For non-admin responses these keys must be absent
   (not merely visually hidden or set to a display placeholder). The page must not request a
   separate customer-accessible endpoint that reintroduces these values.
5. Make the customer-facing company profile non-mutating: remove its update helper and edit UI,
   and disable the store-company update handler for customer use after confirming no unrelated
   storefront caller uses it. Admin update routes remain unchanged in capability.

## Execution plan

### Task 01: Secure the store company-profile projection

Add a small, reusable actor/company resolver at the store API boundary. Use it in the company
retrieve route and related employee read routes so a non-admin cannot retrieve financial values
through \`employees\` after they have been redacted from the primary company response. Replace
the generic response serialization with an explicit customer-safe projection. Keep the BC
freshness-sync behavior and its safe error handling intact. Remove the customer company-update
route/middleware only after confirming \`updateCompany\` is used solely by this profile.

The route must test both direct HTTP access and the nested employee data path: a regular linked
employee can retrieve basic fields but never receives financial keys; a linked company admin
receives all authorized values; a customer linked to another company cannot retrieve the target.

### Task 02: Render the storefront profile as complete read-only data

Replace the CompanyCard edit-state form with a static, responsive label/value grid. Render every
allowed profile field, preserving labels and showing an empty value for null or missing basic
data. Render financial rows only when their keys are present in the server response; do not add
a role-explanation banner or disabled fields. Remove the edit/update imports, state, buttons,
and \`updateCompany\` storefront helper. Update response types and locale strings for the added
field labels, then add focused component/page coverage.

### Task 03: Mark Business Central-managed fields in Medusa Admin

Extend the Admin company query/type/form path so the detail page can display all synchronized
fields and the update drawer can edit them. Add a persistent Medusa UI warning banner at the top
of the company detail page explaining that Business Central is authoritative, a login overwrites
Business Central-managed values, and Medusa-only values are preserved. Add the same concise
indicator next to each managed field in both the detail display and its editable control:
name, email, phone, address, city, state, zip, country, blocked status, credit limit, VAT number,
and currency. The indicator is informational; it must not disable Admin inputs.

### Task 04: Validate the cross-application behavior

Add or extend backend integration tests, storefront component/page tests, and Admin tests for
the agreed contract. Run the affected test suites and production builds. Include an OWASP access-
control review specifically confirming that request parameters, serialized payloads, nested
employee objects, and error responses do not disclose a non-admin's financial data.

## Decisions and trade-offs

- **Explicit store response projection over UI-only hiding.** It prevents direct SDK/HTTP callers
  from receiving credit, blocked status, reset frequency, or spending-limit data. The additional
  mapper is deliberate security-boundary code, not presentation duplication.
- **Existing \`company_admin\` role, not \`employee.is_admin\` alone.** The role is already set and
  cleared by the employee workflows and is used by existing store authorization middleware.
  The employee-company relationship still establishes ownership of the target company.
- **Admin-only editability for BC fields.** This satisfies NIMBUS-157 while preserving
  NIMBUS-156's rule that the store API never accepts or returns a writable BC-owned field.
- **No new module, migration, custom API endpoint, or dependency.** NIMBUS-156 already owns the
  data model and synchronization. This issue changes projections, UI, validators, and tests.

## Verification

- [ ] A linked non-admin customer receives basic company data only; response JSON lacks all
  restricted financial keys, including nested employee spending-limit values.
- [ ] A linked company admin receives the restricted company and employee values.
- [ ] An authenticated customer cannot retrieve a different company's profile or employee data.
- [ ] The storefront company profile contains no input, select, Edit, Save, or Cancel control and
  preserves labels for blank basic values.
- [ ] The storefront displays every permitted BC-synchronized field after NIMBUS-156 data exists.
- [ ] Admin shows the persistent warning and a marker beside all twelve specified managed fields,
  while those Admin fields remain editable and persist through the Admin update route.
- [ ] Focused backend/storefront/Admin tests, lint/type checks, and both app builds pass.
