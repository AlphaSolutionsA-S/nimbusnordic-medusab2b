# NIMBUS-156: Sync Business Central customer data to Medusa company on login

**Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-156

## Objective
After every successful Customer Portal login, refresh the authenticated company's approved
fields from its authoritative Business Central customer record, without ever letting a BC
failure break the login.

## Analysis

### Trigger
Medusa v2.18 emits **no** successful-login event, so there is no backend subscriber to hook.
The scoped and only viable trigger is an explicit, protected, bodyless backend mutation the
storefront calls immediately after it stores the auth token in the existing `login` server
action (`apps/storefront/src/lib/data/customer.ts`). The endpoint is a *trigger*, not a
company-update API: it accepts no company id, BC number, or field values. Company authority is
resolved server-side from `customer -> employee -> company` (the exact `query.graph` pattern
already used by `GET /store/bc-orders`), satisfying OWASP access-control (no
caller-supplied authority identifier; one employee cannot sync another company).

### Business Central module
`BusinessCentralModuleService` already validates the BC host (`api.businesscentral.dynamics.com`,
https-only), derives the tenant, obtains a client-credentials token, escapes OData string
filters, and resolves a customer by `number` — but its private `getCustomerId` returns only the
GUID. We add a public, typed `getCustomer(customerNumber)` that queries `customers()` filtered by
the escaped `number`, `$top=1`, and `$expand=currency`, then validates the response at the
external boundary: it normalizes BC's empty/null/`_x0020_` blocked value to `"not_blocked"`, rejects any unknown
blocked enum value (throws rather than coercing to unblocked), reads `currency.code` from the
expanded navigation property (null when absent — no fallback), and returns a typed `BCCustomer`
or `null` when no customer matches.

### Company model
The `company` model has `currency_code` and `business_central_customer_number` but not
`blocked`, `credit_limit`, or `vat_number`. We add these three fields (enum defaulting to `"not_blocked"`,
nullable decimal, nullable text) and generate a company-module migration with
`npx medusa db:generate company`. `ModuleCompany` gains the fields; `ModuleUpdateCompany`
(a `Partial<ModuleCompany>`) and `QueryCompany` (extends `ModuleCompany`) inherit them
automatically. The new fields are **not** added to any store/admin create/edit validator — they
are integration-owned, not caller-writable form inputs.

### Workflow boundary
A dedicated `syncCompanyFromBusinessCentralWorkflow` takes only the authenticated customer id.
A prepare step resolves the company + BC number, fetches the BC customer, and maps only the
approved fields; expected errors thrown by that BC service call are logged with safe context and
converted to a `failed` preparation result. The existing `updateCompaniesStep` (with its
compensation) performs the mutation, guarded by a `when` condition so a skip or failed/invalid
fetch never invokes the update step (no partial overwrites). The workflow returns a small
`{ status }` result (`updated | skipped | failed`), never the BC payload. The route does not
broadly catch programming or database failures; those remain observable as backend errors while
the storefront treats any failure from this secondary call as non-fatal.

### Field mapping (BC → Medusa company)
| BC source | Medusa target | Rule |
|---|---|---|
| `displayName` | `name` | copy |
| `email` | `email` | copy |
| `phoneNumber` | `phone` | copy |
| `addressLine1` + `addressLine2` | `address` | join non-empty lines with `", "` |
| `city` | `city` | copy |
| `state` | `state` | copy |
| `postalCode` | `zip` | copy |
| `country` | `country` | copy |
| `blocked` (normalized) | `blocked` | empty/null/`_x0020_`→`"not_blocked"`; validate enum |
| `creditLimit` | `credit_limit` | bare decimal, nullable |
| `taxRegistrationNumber` | `vat_number` | copy |
| `currency.code` | `currency_code` | from expanded nav; null if absent |

Preserved (never overwritten): `id`, `logo_url`, `business_central_customer_number`,
`spending_limit_reset_frequency`, `employees`, `customer_group`, approval settings, timestamps.

## Execution Plan
1. **BC module** — add `BCCustomer` + blocked-state types and `getCustomer` to the module
   contract; implement `getCustomer` (escaped filter, `$top=1`, `$expand=currency`, boundary
   validation/normalization); extend `service.spec.ts`.
2. **Company model + migration** — add `blocked`, `credit_limit`, `vat_number` to the model and
   `ModuleCompany`; generate and review the company-module migration.
3. **Sync workflow** — add the prepare/map step and the workflow composing it with the existing
   `updateCompaniesStep` via `when`; return `{ status }`; add module tests.
4. **Protected route** — add `POST /store/customers/me/company/sync-business-central` (bodyless,
   authenticated), run the actor-scoped workflow, return its minimal status, register middleware,
   and add an integration HTTP test. Expected BC errors are already represented as `failed`;
   unexpected backend errors remain non-2xx.
5. **Storefront** — add an SDK helper for the sync route and invoke it once after successful
   login, awaiting token persistence before the call; keep any endpoint/transport failure
   non-fatal with a safe warning; revalidate the customers cache tag; add a storefront test.
6. **Validation** — build, run focused BC/workflow/route/storefront tests, apply the migration
   on a disposable DB and verify defaults/nullability on existing rows.

## Decisions & Trade-offs
- **`credit_limit` as `model.bigNumber().nullable()`** (consistent with `employee.spending_limit`)
  to preserve decimal precision and avoid the flagged integer/minor-unit corruption risk. Cost:
  the generated migration also adds a `raw_credit_limit` column (Medusa's bigNumber convention).
  `model.float().nullable()` is a simpler alternative but risks precision; bigNumber is preferred.
- **Boundary validation lives in `getCustomer`** (blocked normalization/rejection, currency
  extraction) so unknown BC enum values never propagate into company types (OWASP: validate at
  the external-service boundary). Business field-name mapping (displayName→name, address join)
  lives in the workflow step.
- **Expected BC failures become `{ status: "failed" }` in the workflow**, so the protected route
  can return a non-failing outcome without a broad catch. Unexpected programming/database
  failures remain backend errors, but the storefront's best-effort boundary still prevents them
  from changing the completed authentication result. Unauthenticated requests remain 401.
- **No validator changes.** New fields are integration-owned; exposing them as writable store
  inputs is explicitly out of scope.
- **Skip semantics** (no company / no BC number / no BC match) return `skipped` without throwing;
  only transport/HTTP/invalid-payload/unknown-enum conditions throw and are caught at the route.

## Verification
- [ ] BC `getCustomer`: escaped `number` filter, `$top=1`, `$expand=currency`, full mapping,
      `null` on no match, throw on non-OK response, `_x0020_`→`"not_blocked"` normalization, throw on unknown
      blocked value, `currency.code` extraction, null currency when nav absent.
- [ ] Workflow: no linked company → `skipped`; no BC number → `skipped`; no BC match → `skipped`;
      valid customer → `updated` with exact mapping; unknown blocked/BC service error → `failed`
      and does **not** call the update step; unrelated fields preserved; repeated runs are
      idempotent; programming/database failures still reject.
- [ ] Route: authenticated actor selects the company from its own employee link; unauthenticated
      request rejected; BC failure yields a non-failing response; no secrets/BC record leaked.
- [ ] Storefront: token persistence is awaited; exactly one sync attempt immediately follows a
      successful login; endpoint/transport failure is safely warned and does not fail the login
      action; customers cache tag revalidated after a successful request.
- [ ] Migration applies to existing rows: `blocked` defaults to `"not_blocked"`, `credit_limit`/`vat_number`
      remain null until first sync; reversible.
- [ ] `pnpm --filter @b2b-starter/backend build` and storefront type/build pass.
