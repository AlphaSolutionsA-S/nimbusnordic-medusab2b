# Workflows and steps: Nimbus Nordic

Paths under `apps/backend/src/workflows/`. Layout: `<domain>/workflows/*.ts`, `<domain>/steps/*.ts`,
pure helpers in `<domain>/utils/*.ts`; core-flow hooks in `hooks/*.ts`.

- Canonical workflow: `quote/workflows/customer-accept-quote.ts` (`useQueryGraphStep`, a validate
  step, `runAsStep`, core-flows reuse).
- Canonical step: `quote/steps/create-quotes.ts` (with compensation).
- Steps resolve modules with `container.resolve<IXModuleService>(X_MODULE)`; importing a service
  class for its type only is allowed.
- Do not copy: `order/steps/update-order.ts` (`any` casts; its compensation calls `updateOrder` with
  an array); `hooks/cart-created.ts` and `hooks/order-created.ts` (trust `metadata.company_id`,
  rule `trust-no-client-company`).
- Spending-limit and approval checks run in `hooks/validate-cart-completion.ts` and the other
  `validate-*` hooks; their rules are in Tier 0 `decisions.md`.
