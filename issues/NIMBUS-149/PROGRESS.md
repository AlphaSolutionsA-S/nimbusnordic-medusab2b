# Create and persist the Medusa order

- **Date:** 2026-09-02
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-149
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-149/
- **Updated by:** scoper agent
- **Outcome:** Scope approved. Interviewed the user on the two genuinely open design questions
  from NIMBUS-147's prior scoping (line-detail retention mechanism, and shape of the "initial
  Business Central integration state"): (1) the complete raw canonical order JSON is persisted
  verbatim into a dedicated `metadata` key as the line-detail source of truth — not reshaped or
  re-derived — alongside mapped header fields as real Order columns; (2) a dedicated BC
  integration-state object (BC order id, status, timestamp(s), retry count) lives as a second,
  separate `metadata` key (not a separate data model), giving NIMBUS-148 and NIMBUS-158 a stable
  contract to build on. Confirmed: Medium priority, `develop` base branch, backend-only, normal
  backlog pace (same as NIMBUS-144/147). Confirmed constraint carried from NIMBUS-147: Medusa
  order created with header fields only, no `OrderLineItem` records. NIMBUS-149's Jira
  description was already in adequate Background/Goal/Scope shape at scoping time — no Jira
  update was needed. `issues/NIMBUS-149/SCOPE.md` written and approved as-is by the user.
- **Handover to:** implementation-planner agent
- **Handover prompt:** Read `issues/NIMBUS-149/SCOPE.md` and plan the implementation for Medusa
  order creation/persistence from the validated canonical order NIMBUS-147 hands off. Scope is:
  (1) create a Medusa order with header fields only (map canonical fields — currency, contact
  email/phone, dates, addresses, company/customer reference — onto native Order columns where
  they fit, using NIMBUS-144's BC field-mapping table and NIMBUS-147's finalized canonical schema
  as inputs; exact field-by-field mapping is your decision); (2) create NO `OrderLineItem`
  records (Medusa has no product catalog behind these SKUs — confirmed constraint from
  NIMBUS-147); (3) persist the complete, verbatim canonical order JSON (including the full
  `lines` array) into a dedicated `metadata` key, stored as received, as the line-detail source
  of truth for NIMBUS-148 to consume later; (4) design and persist a BC integration-state object
  as a second, separate `metadata` key (not a separate data model) with a BC order id (initially
  null), a delivery status (initial "not yet sent"/pending value), timestamp(s), and a retry
  count (initial 0) — exact field names/types are your decision, but keep this key clearly
  separate from the raw-payload key; (5) associate the order with the company/customer context
  NIMBUS-147 resolves and hands off; (6) ensure order-creation failures are surfaced/recoverable,
  not silently dropped — exact mechanism (logging, error state, alerting) is your decision; (7)
  guard against double-creating an order if invoked more than once for the same validated order.
  Do NOT implement NIMBUS-147's validation/matching (assume it's already done and handed off), and
  do NOT implement NIMBUS-148's actual Business Central delivery/API call — this story only
  initializes the integration-state object that NIMBUS-148 will later update. If SCOPE.md needs
  adjustment during planning, update it in place rather than creating a new scope document.

---

## 2026-09-02 — Implementation Planning Complete

- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan produced. PLAN.md, manifest.md, and three task files created.
  Plan is ready for dispatch but conditional on NIMBUS-129 Task 03's implementation status — this
  story modifies the files Task 03 plans to create.
- **Key insight:** NIMBUS-129 Task 03 already pulled a minimal slice of NIMBUS-149 into its
  synchronous workflow (bare `createOrders` with `currency_code`, `email`, and metadata
  containing `company_id`, `canonical_order`, `order_ingestion_state`). This story completes the
  remaining requirements: address mapping, phone mapping, BC integration-state metadata,
  idempotency verification, and failure-handling verification.
- **Key decisions:**
  - Modify the existing `createOrderAndReferenceStep` from NIMBUS-129 Task 03 — do not create a
    parallel workflow.
  - Map `billTo`/`shipTo` as inline `CreateOrderAddressDTO` objects in `createOrders`.
  - Map `name` → `first_name` (no split), `country` → `country_code` (lowercase),
    `phoneNumber` → `shipping_address.phone`.
  - BC integration-state: `{ bc_order_id: null, status: 'pending', timestamp, retry_count: 0 }`
    under `metadata.bc_integration_state`.
  - Idempotency: rely on existing `OrderExternalReference` dedupe check (no new code).
  - Failure handling: rely on existing compensation function (no new code).
- **Handover to:** implementor agent (once NIMBUS-129 Task 03 is implemented or in progress)
- **Handover prompt:** Implement NIMBUS-149 from the approved plan in issues/NIMBUS-149/. Start
  with Task 01 (header mapping + BC state), then Task 02 (verification), then Task 03 (tests).
  Before starting, check NIMBUS-129 Task 03's implementation status and complete the
  reconciliation checklist in manifest.md.

---

## 2026-09-29 — Re-plan against implemented NIMBUS-129 code

- **Date:** 2026-09-29
- **Updated by:** implementation-planner agent
- **Outcome:** The plan was reconciled against the NIMBUS-129 code on `develop`. NIMBUS-129
  Task 03 is DONE, so the "depends on NIMBUS-129 Task 03" blocker is removed. PLAN.md and
  manifest.md were rewritten. The three 2026-09-02 task files were replaced by
  `01-atomic-order-creation-steps-implementation.md`,
  `02-bc-integration-state-init-implementation.md` and
  `03-header-field-mapping-implementation.md`.
  - **Already satisfied:** header-only order via `Modules.ORDER` with no line items; verbatim
    `metadata.canonical_order`; company association (`metadata.company_id` + link); `currency_code`
    and `email` mapped; sequential duplicate rejection (422).
  - **Remaining gaps, now planned:**
    - **Task 01:** a failure inside the 3-mutation `createOrderAndReferenceStep` orphans the
      order. Its compensation receives `undefined` when the step throws, which was verified in
      the Medusa 2.21 orchestrator. There is also no DB-level duplicate guard for concurrent
      submissions. The fix is a split into one-mutation steps plus a unique index and migration.
    - **Task 02:** no BC integration state is written.
    - **Task 03:** addresses and phone are not mapped.
  - **Contract change:** the old plan's `bc_integration_state` / `retry_count` / `timestamp`
    shape is replaced. The plan adopts NIMBUS-148's `business_central_integration` contract
    (`attempt_count`, `initialized_at`, …) verbatim, and NIMBUS-149 creates
    `src/modules/order-ingestion/bc-integration-state.ts`. NIMBUS-148 Task 01 must switch from
    "create" to "append", and NIMBUS-158 must reconcile its placeholders. Neither sibling folder
    was edited.
  - **Ready for Dispatch:** `false`, awaiting user approval of the re-plan and of two open
    decisions in PLAN.md: adopting NIMBUS-148's contract, and the address mapping
    `name → company`, `contact → first_name`, phone on both addresses.
- **Handover to:** user (plan approval), then implementor agent
- **Handover prompt:** Implement NIMBUS-149 from the approved re-plan in `issues/NIMBUS-149/`
  (PLAN.md, manifest.md, task files 01–03) on branch `feature/NIMBUS-149` from `develop`. Run the
  tasks strictly in order 01 → 02 → 03, because all three edit `create-ingested-order.ts` and
  `create-order-workflow.spec.ts`. Follow the building-with-medusa skill and the task skeletons
  exactly: double quotes, named exports, no default export on the model.
  - **Task 01:**
    - Split `createOrderAndReferenceStep` into `createIngestedOrderStep`, `createRemoteLinkStep`
      and `createOrderExternalReferenceStep`, then delete the old step file.
    - Add the composite unique index on `order_external_reference`, generate the migration with
      the db-generate skill and apply it with db-migrate.
    - Report, and do not delete, any existing duplicate pairs found by the pre-check query.
  - **Task 02:** create `bc-integration-state.ts` exactly as specified. The key and field names
    are a cross-story contract with NIMBUS-148/158, so do not rename anything. Initialize
    `metadata.business_central_integration` at order creation.
  - **Task 03:** add `mapCanonicalOrderHeader` and spread it into `createOrders`. Replace only the
    placeholder comment in `enrich-order.ts`.
  - **Checks:** run `pnpm test:unit`, `pnpm test:integration:modules`, `pnpm test:integration:http`
    (run suites individually if the known hook-timeout flake appears), `pnpm build` and
    `pnpm lint`.
  - **Do not touch:** the route, subscribers, `match-company-and-check-duplicate.ts`,
    `update-order-ingestion-state.ts`, `hooks/order-created.ts`, `medusa-config.ts`, or the
    NIMBUS-148/158 folders.
  - **When done:** update this PROGRESS.md and the manifest statuses, and hand over per the
    definition-of-done, code-review and commit-messages skills. Do not commit unless asked.

## 2026-09-29 - Re-plan approved

- **Outcome:** User approved the re-plan and both open decisions: (1) adopt NIMBUS-148's
  `business_central_integration` contract, with NIMBUS-149 creating `bc-integration-state.ts`;
  (2) address mapping `name → company`, `contact → first_name`, phone on both addresses.
  `manifest.md` set to Ready for Dispatch: true.
- **Handover to:** implementor agent
- **Handover prompt:** Use the handover prompt in the previous entry unchanged.

## 2026-09-29 - Implementation complete (Tasks 01-03)

- **Updated by:** implementor agent
- **Branch:** `feature/NIMBUS-149` (from `develop`). Nothing committed. Jira status not changed
  (per coordinator instruction).
- **Outcome:** Tasks 01, 02 and 03 are DONE. `manifest.md` and the task files are updated.
  - **Task 01:**
    - `createOrderAndReferenceStep` is split into `createIngestedOrderStep` (compensation:
      `deleteOrders`), `createRemoteLinkStep` and `createOrderExternalReferenceStep` (compensation:
      delete reference). `create-order-and-reference.ts` is deleted.
    - A composite unique index on `order_external_reference(company_id, external_order_number)
      WHERE deleted_at IS NULL` is added.
    - The migration `Migration20260929100426.ts` was generated and the snapshot updated. The
      generator also emitted a no-op `drop constraint if exists` line, which is standard output.
    - The migration was applied to the local dev DB only (`nimbus-medusa-dev`). The duplicate-pair
      pre-check returned 0 rows, and the table was empty.
  - **Task 02:** `src/modules/order-ingestion/bc-integration-state.ts` is created verbatim per the
    plan (key `business_central_integration`, NIMBUS-148 contract).
    `metadata.business_central_integration = createInitialBcIntegrationState(now)` is written at
    order creation and shares its timestamp with `order_ingestion_state_updated_at`.
  - **Task 03:** `utils/map-canonical-order-header.ts` is added and spread into `createOrders`.
    The mapping is `name→company`, `contact→first_name`, lowercased `country_code`, and phone on
    both addresses. Only the placeholder comment in `enrich-order.ts` was replaced.
- **Deviations:** none from the task skeletons.
- **Validation:**
  - `pnpm test:unit`: 45/45 passed.
  - `pnpm test:integration:modules`: order-ingestion suites passed, including new TC-4. There are
    2 failures in `src/modules/business-central/__tests__/service.spec.ts` ("stops filling from
    salesInvoices after the round-trip guardrail…", a mocked `fetch` returning `undefined`). That
    module is untouched on this branch and does not depend on order-ingestion.
  - `pnpm test:integration:http`, run individually:
    - `create-order-workflow.spec.ts`: 9/9 passed.
    - `enrich-order-event-chain.spec.ts`: 4/4 passed.
    - `orderapi/orders.spec.ts`: passed.
  - `pnpm test:integration:http`, full run: it was stopped by the coordinator after it ran for
    more than 20 minutes. Before it stopped, `companies`, `customers/company-sync`,
    `region-countries`, `orderapi/orders` and `create-order-workflow` had passed. These suites
    failed:
    - `security/security-boundaries.spec.ts`: 120 s `beforeAll` hook timeout (the known
      hook-timeout flake).
    - `quotes/quotes.spec.ts` and `admin/quotes/quotes.spec.ts`: `cartSeeder` `POST /store/carts`
      returned 400.

    None of those files or their code paths were changed. Not investigated (out of scope).
  - `pnpm build`: the backend build succeeded. The storefront build failed at static page-data
    collection (`fetch failed`) because it needs a running backend; the storefront is untouched.
  - `pnpm lint`: 0 errors. There are 11 pre-existing backend warnings, none in changed files.
- **Environment note:** after applying migrations, `npx medusa db:migrate` stops at an
  interactive link-sync prompt for the pre-existing `product_variant_inventory_item` link, which
  is unrelated to this story. The prompt was not answered. Run `db:migrate` interactively if that
  link sync is wanted.
- **Handover to:** user (review), then code review / definition-of-done
- **Handover prompt:** Review the NIMBUS-149 changes on `feature/NIMBUS-149` (uncommitted) using
  the code-review and definition-of-done skills. Before deploying `Migration20260929100426` to any
  shared environment, run the duplicate-pair pre-check from Task 01 against that DB and report any
  rows rather than deleting them. Commit per the commit-messages skill when approved. Move Jira to
  Internal Review when the user asks. Carry the cross-story reconciliation in `manifest.md` into
  NIMBUS-148 Task 01 (append to `bc-integration-state.ts`, not create) and into NIMBUS-158.
  Separately triage the pre-existing failures: the business-central `service.spec.ts` guardrail
  test, the quotes `cartSeeder` 400, and the security-boundaries hook timeout.

## 2026-09-29 - Code review fixes

- **Outcome:** Code review found no blocking issues. Two fixes applied at the user's request:
  - `createOrderExternalReferenceStep` now turns a unique-index violation into the same
    `DUPLICATE_ERROR` (422, "already accepted") as the duplicate pre-check. Before, it surfaced
    Medusa's mapped DB error (400), which exposed the internal company id.
  - `src/links/order-company.ts` was a one-to-one link, so Medusa 2.21 rejected a company's
    second order ("Cannot create multiple links between 'order' and 'company'"). It is now
    `isList: true` on the order side (a company has many orders, an order has one company).
    This also affects storefront checkout via `workflows/hooks/order-created.ts`.
  - Tests: TC-6 asserts the loser's duplicate error; new TC-10 links two orders to one company.
    Order-ingestion specs 14/14 and `orderapi` 7/7 pass; backend build and lint clean.
  - Follow-up for ISO-2 validation of canonical `country` raised against NIMBUS-147.
- **Handover to:** user (merge to develop, then Jira Internal review)
- **Handover prompt:** Before deploying the migration, run the Task 01 duplicate-pair check on
  each shared database. Carry the `bc-integration-state.ts` reconciliation into NIMBUS-148
  Task 01 and NIMBUS-158.
