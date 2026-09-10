# NIMBUS-155: Make BC customer number read-only in storefront

**Status:** Scoped
**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-155
**Base branch:** develop
**Size:** S

## Objective
Prevent storefront users from changing a company's Business Central customer number while continuing to show the existing value and preserving Admin edit access.

## Current state
- The storefront company edit form renders `business_central_customer_number` as a writable input in `apps/storefront/src/modules/account/components/company-card/index.tsx`.
- The form initializes its update state from the complete company response and `updateCompany` forwards the resulting object to `POST /store/companies/:id`.
- `StoreUpdateCompany` currently includes `business_central_customer_number`, and the Store API validator accepts it. A crafted authenticated storefront request can therefore update the identifier even if the UI field is removed.
- Admin has an independent form, route, and `AdminUpdateCompany` validator that accept the field. This is the intended management surface and must remain unchanged.

## In scope
- Make the BC customer number non-editable in the storefront company-profile edit state and form.
- Continue displaying the current BC customer number to storefront users when the value exists.
- Exclude the field from the storefront company-update type and submitted update payload.
- Reject `business_central_customer_number` at the `POST /store/companies/:id` validation boundary, including requests crafted outside the storefront UI.
- Add focused regression coverage for the storefront behavior and Store API rejection.

## Out of scope
- Any change to Admin company forms, routes, validators, or permissions.
- Changes to the company data model, database migrations, Business Central connectivity, or synchronization behavior.
- Changes to other storefront company-profile fields or general company-route authorization behavior.
- Altering whether the read-only value is visible when no BC customer number is configured.

## Acceptance criteria
- [ ] In the storefront company-profile edit view, the BC customer number is presented as read-only and cannot be modified by normal user interaction.
- [ ] The BC customer number remains visible in the storefront when it is configured.
- [ ] Saving changes to other storefront company fields does not include or modify the BC customer number.
- [ ] `POST /store/companies/:id` rejects a request body containing `business_central_customer_number`.
- [ ] Admin company create and update behavior continues to accept and persist the BC customer number.
- [ ] Existing company-update behavior for the remaining allowed storefront fields remains unchanged.

## Affected surfaces
- `apps/storefront/src/modules/account/components/company-card/index.tsx`
- `apps/storefront/src/lib/data/companies.ts`
- `apps/storefront/src/types/company/http.ts`
- `apps/backend/src/api/store/companies/validators.ts`
- `apps/backend/integration-tests/http/companies/companies.spec.ts`

## Explicitly unaffected surfaces
- `apps/backend/src/admin/companies/components/company-form.tsx`
- `apps/backend/src/api/admin/companies/[id]/route.ts`
- `apps/backend/src/api/admin/companies/validators.ts`
- `apps/backend/src/modules/company/models/company.ts`

## Security and authorization
The BC customer number is an integration identifier. UI-only removal is insufficient because the Store route currently validates and forwards client-supplied updates. The Store update validator must reject the property using its strict schema so authenticated storefront callers cannot overwrite it directly. This does not change the existing route-level authentication or company authorization model; it only removes write authority for this field from the Store API contract.

## Test and verification strategy
- Add a storefront component test that enters edit mode and verifies the BC customer number cannot be edited while the configured value is still displayed.
- Extend the Store companies integration test with an update request that includes the BC customer number and assert validation failure, then verify the persisted value is unchanged.
- Verify a normal Store company update still succeeds without the BC field.
- Add or retain a focused Admin contract check that its validator/update route still accepts the BC field; implementation should not modify the Admin files listed above.
- Run focused storefront tests, the Store companies integration test, and the relevant app build/type-check commands.

## Dependencies
- No schema migration, external Business Central call, or deployment-order dependency is expected.
- The feature relies on the existing separate Store and Admin company API contracts remaining distinct.

## Risks and mitigations
- **Risk:** Removing only the input lets a caller submit the identifier directly. **Mitigation:** remove it from the Store update schema and assert rejection in an HTTP integration test.
- **Risk:** Removing the field from generic company state could make saving unrelated fields clear it. **Mitigation:** omit it from the Store update payload rather than sending `null`, and verify the persisted value remains unchanged after a normal save.
- **Risk:** A shared type or validator edit could inadvertently restrict Admin. **Mitigation:** limit server changes to Store types/validators and retain the independent Admin contract unchanged.

## Decisions
- Treat read-only as a Store API authorization boundary as well as a UI constraint.
- Do not add a disabled input by default. Use the existing read-only company details display in edit mode, or an equivalent non-editable presentation consistent with the account UI, so the field is visible without suggesting it can be changed.
- Preserve the current behavior of hiding the value when it is not configured.

## Implementation handover
Create an implementation plan with one focused task for the storefront payload/UI contract, one for Store API validation and regression coverage, and one verification task. Do not plan changes to Admin or the Business Central module.
