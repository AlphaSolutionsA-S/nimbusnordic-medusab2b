# Backend locks are in-memory and don't hold across Medusa Cloud instances

- Tracker: Jira (NIMBUS) — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-179 (relates to NIMBUS-130)
- Severity: Major (latent; no incident observed)
- Area: Backend (`apps/backend`): `medusa-config.ts` locking provider; BC order submission; approval cart locks
- Reported by: Klaus Petersen (raised during NIMBUS-130 scoping)
- Reported at: 2026-10-15T18:21:00Z

## Summary
The backend uses short-lived "locks" to make sure some actions happen only once at a time: sending an
order to Business Central, and changing a cart while it is waiting for approval. Today those locks are
kept in the memory of a single server. Medusa Cloud may run the backend on more than one server
(instance) at the same time, and our Medusa Cloud project is on the Develop plan, which does not
provide the shared Redis service that would make the locks work across servers. If two servers handle
the same order or cart at the same moment, both can go ahead: an order could be sent to Business
Central twice, or an approval could be recorded against a cart that is changing. Scheduled jobs added
later (for example the order-confirmation polling in NIMBUS-150) would also run on every server.

## Steps to reproduce
Not reproduced; a latent risk derived from configuration and installed source. A reproduction needs
two backend processes against one database:
1. Start two backend instances (both `shared` or `worker` mode) on the same database.
2. Trigger the same order's Business Central submission on both (e.g. the Admin resend on one while
   the automatic `ready-for-business-central` subscriber runs on the other), or run two approval
   updates for the same cart on different instances.
3. Both acquire `bc-submission-<orderId>` (or the cart-id lock) because each instance has its own
   in-memory lock store.

## Expected
A lock acquired on one instance blocks the same key on every other instance; a scheduled job runs
once per tick across the deployment.

## Actual
Each instance has its own in-memory lock store and workflow engine, so locks only exclude work on the
same instance, and every instance fires every scheduled-job tick.

## Environment
- Runtime: Medusa 2.21.x (installed `@medusajs/medusa` 2.21.2) on Medusa Cloud, Develop plan
  (confirmed by Klaus Petersen, 2026-10-15). Redis event bus, caching, locking and workflow engine are
  auto-configured only on Launch, Scale and Enterprise.
- Medusa Cloud may run multiple worker instances (confirmed by Klaus Petersen).
- Build / commit: `develop` @ `49e3751`.

## Evidence (from NIMBUS-130 scoping and triage)
- `apps/backend/medusa-config.ts`: no `workerMode`, no `@medusajs/medusa/locking` module with
  providers, no Redis modules: locking and the workflow engine default to in-memory.
- `@medusajs/medusa` `dist/loaders/index.js`: scheduled jobs load whenever `workerMode` is `worker`
  or `shared`; with the in-memory workflow engine every instance fires every tick.
- Installed lock providers: in-memory (default), `@medusajs/medusa/locking-redis`,
  `@medusajs/medusa/locking-postgres` (advisory locks; needs `db:migrate` for its `locking` table),
  registered under `@medusajs/medusa/locking` → `options.providers` with `is_default`.
- Locks in our code (triage search of `apps/backend/src`, tests excluded):
  - `subscribers/business-central-order-ready.ts`: `locking.acquire` on
    `getBcSubmissionReservationKey(orderId)` with renewal timer (`lock-single-run`).
  - `workflows/business-central-order/steps/reserve-bc-submission.ts`: acquire / release of the same
    reservation key (Admin resend path).
  - `workflows/approval/workflows/create-approvals.ts`, `update-approval.ts`,
    `delete-editable-cart-line-item.ts`: `acquireLockStep` / `releaseLockStep` keyed on the cart id
    (`timeout: 2, ttl: 30`). The cart-id key is the same key Medusa's core cart flows lock on, so core
    cart completion is equally affected.
  - No `src/jobs/` exist yet; NIMBUS-150 plans one.
- Docs that assume one instance: Tier 0 `ai/architecture/boundaries.md` (Locks: "don't hold across
  instances (unverified for production)"), `docs/architecture/business-central-order.md`,
  `docs/security-remediation.md`.

## Decisions
1. Decided 2026-10-15 by Klaus Petersen: register `@medusajs/medusa/locking-postgres` as the default
   lock provider (not a move to a Medusa Cloud plan with Redis).

## Open decisions (human)
2. Does production stay on the Develop plan?
3. Scope boundary: locking only, or also the in-memory workflow engine and event bus (scheduled-job
   fan-out, long-running workflow state)?

## Analysis
*(Empty. The scoper / pipeline fills this in.)*
