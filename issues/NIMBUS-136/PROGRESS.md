# NIMBUS-136 Progress

## 2026-07-16 — Scoping complete

**Outcome:** Created implementation-ready scope for Jira story `NIMBUS-136` (`Show order list`). The scope documents current storefront account order-list behavior, existing Medusa Store Orders API usage, backend order-related findings, UX states, acceptance criteria, technical tasks, risks, assumptions, and open questions.

**Next owner:** implementation-planner

**Handover prompt:**

You are the implementation-planner for `NIMBUS-136` in `D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-136\SCOPE.md` and create an implementation plan for the Customer Portal order-list story. Keep Jira business-facing and write technical planning only under `issues\NIMBUS-136\`. Investigate the existing storefront account order-list path, especially `apps\storefront\src\app\[countryCode]\(main)\account\@dashboard\orders\page.tsx`, `apps\storefront\src\lib\data\orders.ts`, `apps\storefront\src\modules\account\components\order-overview\index.tsx`, and `apps\storefront\src\modules\account\components\order-card\index.tsx`. Also verify backend/auth implications in `apps\backend\src\api\middlewares.ts`, `apps\backend\src\links\order-company.ts`, and `apps\backend\src\workflows\hooks\order-created.ts`. Decide whether built-in Medusa `sdk.store.order.list` and `sdk.store.order.retrieve` are sufficient, or whether a protected backend route is needed for company-wide/customer-safe access. Produce implementation tasks with dependencies, validation steps, and explicit handling of loading, empty, error, populated, pagination, and unauthorized states. Do not modify source code during planning.

## 2026-07-16 - Interview-driven scope revision

**Outcome:** Re-scoped `NIMBUS-136` using explicit interview decisions: company-wide visibility, Business Central-only order source for first delivery, all BC statuses, required status/date/search filters, required pagination with default page size 20, pending approvals removed/moved off `/account/orders`, and BC-backed order details explicitly deferred to `NIMBUS-137`.

**Next owner:** implementation-planner

**Handover prompt:**

You are the implementation-planner for `NIMBUS-136` in `D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-136\SCOPE.md` and produce an implementation plan aligned to the locked interview decisions: company-wide orders, Business Central-only list source, all BC statuses, status/date/search filters, pagination with default page size 20, and removal/move of pending approvals from `/account/orders`. Keep BC-backed order details out of scope and reference `NIMBUS-137` for details work. Keep Jira business-facing and store technical planning in repo issue files only.

## 2026-07-16 — Implementation complete

**Outcome:** All four tasks implemented and committed on `feature/NIMBUS-136` (commit `b8f411f`). Backend builds cleanly. Storefront TypeScript compiles cleanly; static-path fetch failure at build time is a pre-existing infra constraint (no backend running during CI build), not a code error.

**Changes:**
- `apps/backend/src/api/store/bc-orders/` — new authenticated GET endpoint
- `apps/backend/src/modules/business-central/service.ts` — `listOrders()` added
- `apps/backend/src/modules/business-central/types.ts` — interface extended
- `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/bcorders/` — new page + loading state
- `apps/storefront/src/modules/account/components/bc-order-*` — card, filters, overview components
- `apps/storefront/src/types/bc-order.ts` — shared BC order types
- `apps/storefront/src/modules/account/components/account-nav/index.tsx` — BC Orders nav link added

**Next owner:** reviewer / QA

**Handover prompt:**

Review `feature/NIMBUS-136` against the acceptance criteria in `issues/NIMBUS-136/SCOPE.md`. Verify: authenticated users see company-scoped BC orders on `/account/bcorders`; status/date/search filters work; pagination defaults to 20; `/account/orders` and approvals are unchanged; BC-backed order details are NOT present (deferred to NIMBUS-137).

## 2026-07-16 - Route split and nav clarification

**Outcome:** Updated scope with explicit route split decision: keep existing `/account/orders` UI unchanged (approvals stay there), add dedicated BC history route `/account/bcorders`, and add an account navigation item `BC Orders` linking to `/account/bcorders`.

**Next owner:** implementation-planner

**Handover prompt:**

You are the implementation-planner for `NIMBUS-136` in `D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-136\SCOPE.md` and produce an implementation plan aligned to the locked decisions: company-wide Business Central orders on `/account/bcorders`, all BC statuses, status/date/search filters, pagination default 20, add `BC Orders` nav link, keep `/account/orders` unchanged with approvals, and keep BC-backed details out of scope for `NIMBUS-136` (tracked by `NIMBUS-137`). Keep Jira business-facing and store technical planning only in repo issue files.

---

## 2026-07-16 — Implementation plan complete

- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage.
- **Handover to:** implementor agent
- **Handover prompt:** You are the implementor for `NIMBUS-136` in `D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-136\manifest.md` and implement all four tasks in dependency order (01 → 02 → 03 → 04). Task files are in `issues\NIMBUS-136\`. Work on branch `feature/NIMBUS-136` from `develop`. Do not implement BC-backed order detail pages — those are NIMBUS-137. After each task, run `pnpm build` (from repo root) to verify no TypeScript errors before proceeding to the next task.
