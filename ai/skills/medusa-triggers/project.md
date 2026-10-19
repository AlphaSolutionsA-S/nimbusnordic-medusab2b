# Subscribers and jobs: Nimbus Nordic

- Canonical subscriber: `apps/backend/src/subscribers/order-ingestion-created.ts` (runs
  `enrichOrderWorkflow`).
- Error handling and idempotency: `apps/backend/src/subscribers/business-central-order-ready.ts`
  (idempotent `transactionId`; treats `SkipExecutionError` as a normal skip).
- Canonical job: `apps/backend/src/jobs/poll-shipment-notices.ts` (single-run lock tried once,
  per-run `ownerId`, released in `finally`; runs one workflow and logs its result).
- A job file calls `defineFileConfig({ isDisabled: () => process.env.NODE_ENV === "test" })`:
  otherwise the in-memory scheduler fires it inside every integration spec. Specs import the job
  and call it directly.
