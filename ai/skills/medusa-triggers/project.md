# Subscribers and jobs: Nimbus Nordic

- Canonical subscriber: `apps/backend/src/subscribers/order-ingestion-created.ts` (runs
  `enrichOrderWorkflow`).
- Error handling and idempotency: `apps/backend/src/subscribers/business-central-order-ready.ts`
  (idempotent `transactionId`; treats `SkipExecutionError` as a normal skip).
- No scheduled jobs exist yet (`apps/backend/src/jobs/` holds only the Medusa README).
