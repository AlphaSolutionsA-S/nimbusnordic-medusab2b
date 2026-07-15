# NIMBUS-131: Make Business Central Customer Number Available

- **Date:** 2026-07-15
- **Type:** Story
- **Tracker:** JIRA - https://alphasolutionsdk.atlassian.net/browse/NIMBUS-131
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-131/
- **Updated by:** scoper agent
- **Handover to:** implementation-planner agent
- **Handover prompt:** Create an implementation plan for NIMBUS-131 from the approved scope in
  issues/NIMBUS-131/SCOPE.md. Preserve the scope: manually maintain a numeric-only Business
  Central customer number on the backend company, make it available through relevant backend
  APIs and workflows, and surface it in storefront customer/company information where that
  model exists. Confirm the base branch before planning implementation.

- **Date:** 2026-07-15
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan artifacts are ready (manifest, PLAN, backend/storefront task files) with dispatch-ready dependency ordering and verification strategy.
- **Handover to:** implementor agent
- **Handover prompt:** Implement NIMBUS-131 using `issues/NIMBUS-131/manifest.md`, `issues/NIMBUS-131/PLAN.md`, `issues/NIMBUS-131/01-backend-business-central-customer-number-implementation.md`, and `issues/NIMBUS-131/02-storefront-business-central-customer-number-implementation.md`. Preserve scope exactly: add a manually maintained numeric-only `business_central_customer_number` on backend company; expose it through relevant backend APIs/workflows/query fields; surface it in storefront company/customer information where present; and keep no-regression behavior when value is absent. Do not expand scope beyond these artifacts.

- **Date:** 2026-07-15
- **Updated by:** implementation-planner agent
- **Outcome:** Plan updated to explicitly include admin dashboard company controls for the Business Central customer number in addition to backend and storefront surfaces.
- **Handover to:** implementor agent
- **Handover prompt:** Implement NIMBUS-131 using `issues/NIMBUS-131/manifest.md`, `issues/NIMBUS-131/PLAN.md`, `issues/NIMBUS-131/01-backend-business-central-customer-number-implementation.md`, `issues/NIMBUS-131/03-admin-company-business-central-customer-number-ui-implementation.md`, and `issues/NIMBUS-131/02-storefront-business-central-customer-number-implementation.md`. Preserve scope exactly: add a manually maintained numeric-only `business_central_customer_number` on backend company; expose it through relevant backend APIs/workflows/query fields; add admin company create/update/details controls for the field; surface it in storefront company/customer information where present; and keep no-regression behavior when value is absent.