# Plan: Sync a company from Business Central now, from the Admin company page

**Key:** NIMBUS-254 · **Branch:** `feature/NIMBUS-254` from `develop` · **Date:** 2026-10-26
**Scope:** [scope.md](./scope.md) (approved by Klaus Petersen, 2026-10-26, with the three defaults)

## 1. Summary [High]

An Admin user gets a "Sync from Business Central" action in the company page's "..." menu. It runs
the same BC company sync that runs at customer login. The sync now also starts from a company id,
so it works for a company with no employees. A new Admin route returns the outcome. The Admin
company read now includes the last-synced time, and the page shows it in a new row. The action is
disabled, with a tooltip, when the company has no BC customer number. The page's banner text
changes so it no longer says the overwrite happens only at login. The store triggers (login sync,
10-minute freshness sync, NIMBUS-161 guard) keep their inputs and behaviour.

Three decisions shape the design:

- **One sync with two ways in.** The existing workflow and its prepare step take either a customer
  (today's input) or a company id. That keeps one field mapping and one BC error handling. There
  is no second workflow.
- **One set of outcome values.** The Admin route returns the workflow's own values, `updated`,
  `skipped` and `failed`, as the store route does. The Admin UI shows `skipped` as "Nothing to
  sync", so the route never branches on the outcome.
- **The integration cases cannot run in this checkout** (section 2). They are written in full but
  may only be proven after deploy.

How to review this plan: approving it is the human gate that allows dispatch. Each section heading
gives its review level. The `Critical` flags are in section 2 and in section 10, both about the
integration cases. Data model and state tables are rated High because past misses were found there.
The task files add depth but you don't need to read them. A question is often quicker to settle by
asking the planning agent in chat.

## 2. Needs your decision [Critical]

1. `Critical` **How the backend cases get verified.** Contract and integration cases (tasks 01, 02)
   can't run in this checkout. There is no `apps/backend/.env`. Jest global setup stops every
   `test:integration:*` run unless `BUSINESS_CENTRAL_DISCOVERY_URL` points to an allowed BC test
   environment. Even with that, NIMBUS-236 (login returns 401) breaks `companies.spec.ts` and
   `security-boundaries.spec.ts`. Only the Admin UI tests (`test:admin`), lint and typecheck run
   locally. *Default:* use the NIMBUS-243 rule. The worker writes the cases. At finalization the
   dispatcher runs `company-sync.spec.ts`, `companies.spec.ts` and `security-boundaries.spec.ts`.
   If the run aborts because the environment is missing, or a touched case fails only with 401 on
   login, the deviation report records those cases as "code complete, unverified because <reason>".
   Any other failure in a touched case blocks. The after-deploy checks in the task files are the
   proof. If you can supply a `.env` with local Postgres and the BC test discovery URL before
   finalization, say so, and the specs run for real.
   **Answer:** plan approved as written by Klaus Petersen, 2026-10-26, including the section 2
   rule and all decisions new in this plan; no competing-model review.

## 3. Flows [High]

### A. Admin syncs a company that has a BC customer number (tasks 01, 02, 03)

1. On the company page the admin opens "...". "Sync from Business Central" is enabled because the
   company has a BC customer number.
2. The Admin UI posts an empty body to the Admin sync route for that company id.
3. Medusa's Admin authentication admits only an authenticated Admin actor. The strict body schema
   accepts only `{}`.
4. The route runs the sync workflow with the company id from the path.
5. The prepare step reads the company by id. That read also yields the company's own BC customer
   number. It then reads that BC customer.
6. When BC returns the customer, the step builds the update. It writes the twelve BC-managed fields
   and `business_central_synced_at` = now. The shared update step writes them to the `company` row.
   No other field is written.
7. The route returns `{ status: "updated" }`. The UI shows a success toast and refetches the
   company. The page shows the new values and the new last-synced time.

### B. Nothing to sync (tasks 01, 02, 03)

1. The company has no BC customer number. The action is shown but disabled, and its tooltip says
   why.
2. If the route is called anyway, as in A2–A5, the step finds no BC number and makes no BC call. If
   BC has no customer with that number, the step's BC read returns nothing.
3. The step makes no write, so last-synced stays unchanged. The route returns `{ status: "skipped" }`
   and the UI shows "Nothing to sync" with the reason.

### C. BC fails (tasks 01, 02, 03)

1. As A1–A5. BC can't be reached or returns an error, and the BC client raises its own expected
   error type.
2. The step logs the company id and a fixed message, with no personal data, and makes no write. The
   route returns `{ status: "failed" }` (HTTP 200, like the store route).
3. The UI shows an error toast: "nothing was changed".
4. Any other error, such as a programming or database fault, is not converted. The request fails
   with 5xx and the UI shows a generic error toast.

### D. Unknown company or non-admin caller (task 02)

1. An unauthenticated caller or a storefront customer token gets 401 from Medusa's Admin auth
   before the route runs.
2. An unknown company id gets 404. The step raises "not found" and Medusa maps that to 404. Nothing
   is written and BC is not called.

### E. Store triggers (task 01; behaviour unchanged)

1. Login sync and the freshness sync call the same workflow with a customer id, plus the expected
   company id for the freshness sync. Resolution, the NIMBUS-161 guard, the outcomes and the
   responses are unchanged.

## 4. What gets built [High]

### 01. The BC company sync starts from a company id as well as a customer (backend)

The sync workflow (L4) and its prepare step (L3) accept one of two inputs: the existing customer
input (customer id plus optional expected company id) or a company id. Only the company lookup
differs. The customer path is unchanged: company through the customer's employee record, plus the
NIMBUS-161 guard. The company path reads the company by id. An unknown id raises Medusa's
"not found" error. From there both paths share the same code. That shared part covers the missing
BC number (skipped, no BC call), the BC read (an expected BC error is "failed" and an unexpected
one propagates), BC having no customer (skipped), and one field mapping with the sync time. No new
step or workflow is added. The update step is reused as is. Rules enforced: R2, R4–R6, the
no-employees requirement, one mapping, no personal data in logs.

### 02. Admin route to sync one company, and the last-synced time in the Admin read (backend)

A new Admin API route (L6), `POST /admin/companies/:id/sync-business-central`. Its middleware
applies a strict, empty body schema, so any field gets 400. The route runs the task 01 workflow with
the path id and returns `{ status }`. It has no branch and does no other read. Admin authentication
is Medusa's default for `/admin`. The Admin company field list (query config) adds
`business_central_synced_at`, so `GET /admin/companies/:id` and the list return it. A shared
response type for the route goes into the backend's HTTP types. The business-rule registry gets one
row: what a BC company sync writes and its outcomes, owned by the prepare step, used by login, the
freshness read and the Admin route. Rules enforced: R3 (server side), R7, "values only from BC".

### 03. Admin action, last-synced row and banner text (Admin UI)

These are Admin UI pieces (admin routes, components and hooks; HTTP through `admin/lib/client.ts`
only):

- **Mutation hook.** It posts `{}` to the task 02 route. After any response it invalidates the
  company detail and list queries, so the page refetches.
- **Menu action.** The company actions menu gets "Sync from Business Central" in its first group.
  It is disabled without a BC customer number, with a tooltip saying a BC customer number is needed.
  The shared action menu gains an optional per-action tooltip. Medusa UI disables pointer events on
  a disabled item, so the tooltip needs a wrapper that receives hover.
- **Toasts.** One per outcome: success for `updated`, "Nothing to sync" with the reason for
  `skipped`, an error saying nothing was changed for `failed`, and a generic error for HTTP errors.
- **Last-synced row.** The company information table gets a "Last synced from Business Central"
  row: a date and time, or "Never". It is not a BC-managed field and has no indicator.
- **Banner text.** The text in `bc-managed-fields.ts` changes to say the fields are overwritten when
  a customer logs in or opens the company page, or when an administrator runs "Sync from Business
  Central". The comment there changes to match.

There is no repeat-click guard or pending lock (R9). Rules enforced: R1–R5 as seen by the admin,
plus F5, F6 and F9.

## 5. Data model [High]

No new table or column, and no migration.

| Entity.field | Meaning | Existing callers | Owner | Written by | Stored / derived | Encrypted | Mutable until | Retention | Index |
|---|---|---|---|---|---|---|---|---|---|
| `company.business_central_synced_at` | last successful copy from BC | prepare step; store company read (freshness); integration tests | `company` | server: sync workflow (login, freshness, **Admin**); tests | stored (exists) | no | always | life of company; deleted with it | none |
| `company.name, email, phone, address, city, state, zip, country, blocked, credit_limit, vat_number, currency_code` | BC-managed copy | Admin page, store projection, BC order flow (currency) | `company` | server: sync workflow; Admin edit form (overwritten by the next sync) | stored (exist) | no | always (last writer wins, R9) | life of company | none |
| `company.business_central_customer_number` | key of the BC customer, decides which BC customer is read | prepare step, Admin form | `company` | Admin edit form only; **never** the sync | stored (exists) | no | always | life of company | none |
| `company.order_api_enabled`, `logo_url`, `spending_limit_reset_frequency`, employees, customer group link, approval settings | Medusa-only | many | `company` / links | Admin, store routes; **never** the sync | stored | no | — | — | — |
| `GET /admin/companies[/:id]` `company.business_central_synced_at` | added to default fields | Admin page (task 03) | Admin API | — | derived (read), ISO string or `null` over JSON | — | — | — | — |
| `POST /admin/companies/:id/sync-business-central` response `status` | `updated` \| `skipped` \| `failed` | Admin hook | Admin API | — | derived, not stored | — | — | — | — |

Cardinality: one company has at most one BC customer number, and one sync reads one BC customer. A
company may have zero employees. The company path does not depend on employees.

## 6. Business rules as state tables [High]

Entity: company, for one Admin sync. The precondition is an authenticated Admin actor (else 401,
before anything below). The actor is not recorded (R10); `business_central_synced_at` is the only
trace.

| Current state | Event | Outcome | Side effects on other rows / sessions |
|---|---|---|---|
| company id unknown | Admin sync | 404 | none; no BC call |
| no BC customer number | Admin sync (UI disabled; direct call) | `skipped` | none; no BC call; last-synced unchanged |
| BC number set, BC has no such customer | Admin sync | `skipped` | none; last-synced unchanged |
| BC number set, BC error (expected type) | Admin sync | `failed` (200) | none; one log line with company id only |
| BC number set, unexpected error (programming or DB) | Admin sync | 5xx | none committed |
| BC number set, BC returns customer | Admin sync | `updated` | the 12 BC-managed fields and last-synced are overwritten. Storefront sessions may show old values for up to about 120 s (cache, accepted 2026-10-26). The next freshness sync waits 10 min from the new last-synced. |
| any | Admin sync with any body field | 400 | none |
| any | Admin sync overlapping another sync | each runs; last writer wins (R9) | none |
| any | login or freshness sync | unchanged from today | unchanged |

## 7. Security-property matrix [Critical: company personal and credit data]

| Property | Control | Trust root | Failure behaviour | Negative test |
|---|---|---|---|---|
| Only Admin actors can trigger | Medusa's default `/admin` authentication (user: bearer, session, secret API key) | Medusa auth, verified (section 9) | 401, no write, no BC call | security-boundaries: no auth, and a storefront customer bearer token → 401, company unchanged (task 02) |
| Writes only the target company | company id from the path; that company's own BC number picks the BC customer | Medusa DB | unknown id → 404, no write | contract: unknown id → 404, no BC call; a second company stays unchanged after a sync (task 02) |
| No client-controlled values | strict empty body schema; route passes only the path id | Medusa body validation | 400, no write | contract: body with `name` or `business_central_customer_number` → 400 and company unchanged (task 02) |
| Medusa-only fields never change | single field mapping in the prepare step | code | — | contract: `order_api_enabled`, `logo_url`, `spending_limit_reset_frequency`, BC number unchanged after `updated` (task 02); existing store cases (task 01) |
| No personal data in logs | step logs company id and fixed text only | — | — | not testable by behaviour; review item (task 01) |
| CSRF | Medusa session cookie `SameSite=Lax` in production and staging; Admin CORS; no new mechanism | Medusa, verified (section 9) | cross-site POST carries no session cookie | none (framework guarantee) |
| Repeat calls (BC request volume) | none by decision (R9); Admin-only reduces exposure | — | each click makes one BC read | none |

## 8. Decisions [New: High; From scope: Medium]

New in this plan:

- **One workflow and one prepare step, with an input that is either a customer or a company id.**
  The alternative was a second workflow. Why: one field mapping and one BC error handling, as the
  scope requires. The project's shared-step rule calls for a discriminator, not a copy. Source: this
  plan.
- **Wire values `updated` / `skipped` / `failed`, and `skipped` labelled "Nothing to sync" in the
  UI.** Why: the store route already uses these values, and translating them in the route would be
  a domain branch there. Source: this plan.
- **`failed` is HTTP 200 with a status. An unknown company is 404, raised by the step as Medusa's
  "not found".** Why: this matches the store route, and verified framework behaviour maps it to 404
  (section 9). Source: this plan.
- **A body with any field is refused with 400 (strict empty schema).** The scope left "reject or
  ignore" open. Why: the project validates every route body with a strict schema, and refusing is
  the more explicit contract. Source: this plan.
- **The route returns only `{ status }`. The UI refetches the company after the response.** Why:
  there is no second read in the route, and the page already reloads through its query. Source:
  this plan.
- **`business_central_synced_at` is added to the shared Admin default fields, so the list returns
  it too.** Why: both reads share one field list, and an extra scalar in the list is harmless.
  Source: this plan.
- **A tooltip option on the shared Admin action menu.** Why: the menu has no tooltip today, and
  disabled items ignore hover (verified, section 9). Source: this plan.
- **No pending-state disable on the action.** Why: R9 says no guard. Source: scope.
- **The shared `QueryCompany` type stays as it is.** It declares `business_central_synced_at` as
  `Date`, but over HTTP the value is an ISO string. The UI converts it with `new Date(...)`. Why:
  changing the shared type touches every consumer and is out of scope. This is a known existing gap,
  flagged for the reviewer.
- **Register the rule "what a BC company sync writes and its outcomes" in `decisions.md`.** Why:
  there is one home per rule, and three triggers now use it. Source: scope non-functional
  requirement.
- **Does the framework already do this?** No. Medusa has no workflow that refreshes a custom module
  from an external system. The project's own sync workflow is reused, and its update step is
  reused unchanged.
- **No framework internal is called directly.** Only `query.graph`, `MedusaError`, the workflow SDK
  and the Admin SDK client are used.
- **Left alone:** `workflows/business-central-order/utils/resolve-bc-currency-override.ts` imports
  `resolveCurrencyCode` from the step file, an existing `bound-helper-pure` violation. Task 01 does
  not move it. It is mentioned for a later cleanup.

From the scope (Klaus Petersen, 2026-10-26): R1–R10. The answers: 120 s storefront cache accepted;
blocked and credit limit display-only, with checkout enforcement out of scope; no audit of the
actor.

## 9. Framework assumptions [Medium]

| Primitive | Verified behaviour | Evidence |
|---|---|---|
| `/admin` authentication | every `/admin/*` route not opted out gets `authenticate("user", ["bearer","session","api-key"])` | verified: `node_modules/@medusajs/framework/dist/http/router.js` (ApiLoader, `applyAuthMiddleware`) |
| Workflow error → HTTP status | `run()` throws the first step error. Step errors are serialized by copying own properties, so `MedusaError.type` survives. The error handler maps `type` `not_found` to 404 | verified: `workflows-sdk/dist/helper/workflow-export.js` (throws `errors[0].error`), `utils/dist/common/serialize-error.js`, `framework/dist/http/middlewares/error-handler.js` |
| `fields` query param merge | a `*relation` entry does not replace the defaults, so the page's `fields=*employees,...` still gets the default scalar list including the new field | verified: `framework/dist/http/utils/field-filtering/field-parser.js` |
| Session cookie CSRF | production and staging use `sameSite: "lax"`, `secure: true` | verified: `framework/dist/http/express-loader.js` (`resolveSessionCookieSecurity`) |
| BC `getCustomer` | returns the customer or `null` when not found. Throws `MedusaError` on expected failures | verified: `modules/business-central/service.ts`, `__tests__/service.spec.ts` |
| Disabled `DropdownMenu.Item` | `data-[disabled]:pointer-events-none`, so a tooltip on the item itself never opens | verified: `node_modules/@medusajs/ui/dist/esm/components/dropdown-menu/dropdown-menu.js` |

Installed Medusa packages are 2.21.2 (Tier 0 says 2.21.0). This does not matter here.

## 10. Open risks and gates [Medium; Critical where flagged]

- `Critical` Integration and contract cases can't run locally (missing `.env`, the BC test
  environment guard, NIMBUS-236). Rule: see section 2. Owner: dispatcher, then Klaus Petersen at
  the gate. Non-blocking for dispatch under the default; blocking for "verified" claims.
- A secret Admin API key, such as the Logic App's key for the order API, can call any `/admin`
  route, including this one. This exposure already exists for every Admin route and adds nothing
  new. Owner: Klaus Petersen. Non-blocking.
- The storefront can show stale values for about 120 s after a sync. This is accepted. Owner: none.
