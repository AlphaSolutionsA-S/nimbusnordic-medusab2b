# Infra adapters: Nimbus Nordic

- The only vendor adapter is `apps/backend/src/modules/business-central/service.ts` (Dynamics 365
  Business Central over HTTP, OAuth via `login.microsoftonline.com`; no tables). It is 2,399 lines:
  don't copy its size. New BC operations go in focused files beside it (as `return-history.ts`
  does) and are exposed through the service.
- No clean canonical adapter exists yet (a gap). Notifications go through Medusa's
  `notification-local` provider, configured in `apps/backend/medusa-config.ts`.
- BC errors are typed in the business-central module; callers import the error class, not the
  service (baseline exception: `apps/backend/src/api/store/bc-orders/[id]/returns/route.ts`).
