# Merge Business Central Sales Orders and Sales Invoices in Order History

- **Date:** 2026-09-11
- **Type:** Story
- **Tracker:** JIRA — [NIMBUS-170](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-170) (child of Epic NIMBUS-125)
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-170/
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Wrote `manifest.md` and four task files (`01-bc-types-implementation.md`, `02-list-orders-merge-implementation.md`, `03-get-order-merge-implementation.md`, `04-storefront-updates-implementation.md`) plus `PLAN.md`. Test infrastructure already exists for both apps (backend `jest.config.js`, storefront `jest.config.ts`) — no Step 2c gate was triggered.
- **Handover to:** implementor agent
- **Handover prompt:** "Implement NIMBUS-170 using the plan in issues/NIMBUS-170/. Read manifest.md for the task order and dependencies, then implement each of the four task files in order (01 → 02 → 03 → 04): 01 updates apps/backend/src/modules/business-central/types.ts, 02 and 03 rewrite listOrders and getOrder in apps/backend/src/modules/business-central/service.ts and its test file, 04 updates two storefront files (apps/storefront/src/types/bc-order.ts and the bc-order-card component) plus its test. Each task file contains the exact code to write, the exact test cases to add/replace, and the build/lint/test commands to run before moving to the next task. Do not deviate from the join-key (order number, not id), pagination, or field-mapping decisions documented in each task and in PLAN.md — they were made deliberately to resolve open questions from SCOPE.md and are not to be re-derived."
