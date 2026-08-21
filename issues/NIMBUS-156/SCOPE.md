# NIMBUS-156: Sync Business Central customer data to Medusa company on login

**Jira:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-156  
**Type:** Story  
**Status at scoping:** Scoping  
**Assignee at scoping:** Klaus Petersen  
**Component:** Customer Portal

## Problem statement

Company profile data is maintained separately in Medusa and Business Central. The Medusa
company currently stores the BC customer number, but name, contact, address, currency,
credit limit, VAT number, and blocked state can become stale because no synchronization
runs when a portal user signs in.

After each successful Customer Portal login, the system must read the BC customer selected
by the authenticated user's company `business_central_customer_number` and copy the agreed
BC-owned fields to that same Medusa company. A missing mapping or unavailable BC service
must not invalidate an otherwise successful login.

## Confirmed decisions

- Run the synchronization on every explicit Customer Portal login. Do not compare
  `lastModifiedDateTime` and do not add a freshness interval.
- Store `blocked` as a Medusa enum mirroring BC values: `""`, `"Ship"`, `"Invoice"`,
  and `"All"`.
- Normalize BC's `_x0020_` wire value for the unblocked state to `""` before persistence.
- Store `credit_limit` as a decimal value. Its currency is represented separately by
  `currency_code`.
- Read `currency_code` from the expanded BC `currency` navigation property.
- Do not sync `salespersonCode`, `website`, or `taxAreaDisplayName`.
- Join the two BC address lines with exactly `", "` when both are present.

## Goals

- Refresh the agreed company fields from authoritative BC customer data after every
  successful portal login.
- Resolve company authority solely from the authenticated Medusa customer and its employee
  link; callers cannot select a company or BC customer number.
- Add typed BC customer retrieval to the existing Business Central module.
- Add the three required company fields and a generated company-module migration.
- Perform the company mutation through a Medusa workflow.
- Preserve successful authentication and existing Medusa data when synchronization cannot
  run or BC returns an error.
- Keep the synchronization one-way from BC to Medusa.

## Non-goals

- Writing company or customer changes from Medusa back to BC.
- Synchronizing on registration, token refresh, customer retrieval, scheduled jobs,
  webhooks, admin actions, or any trigger other than the explicit login action.
- Synchronizing BC balances, overdue amounts, aged receivables, payment terms, shipment
  methods, payment methods, contacts, dimensions, or document attachments.
- Synchronizing `salespersonCode`, `website`, or `taxAreaDisplayName`.
- Adding admin or storefront UI for the new fields.
- Changing login credentials, authorization policy, cart transfer, company membership, or
  customer-group behavior.
- Refactoring the existing Business Central HTTP client beyond what customer retrieval
  requires.

## Current-state findings

- The storefront login server action in `apps/storefront/src/lib/data/customer.ts` calls
  `sdk.auth.login`, stores the bearer token, retrieves the authenticated customer, updates
  company metadata on the cart, and transfers the cart.
- Medusa v2.18 does not publish an event for successful login. The documented Auth Module
  events cover MFA, password reset, and verification, so a login subscriber cannot provide
  the required trigger.
- The backend already exposes authenticated customer routes and resolves company scope with
  `query.graph` through `customer -> employee -> company`, as used by BC order routes.
- The Business Central service already validates the BC host, obtains a client-credentials
  token, escapes OData string filters, and resolves customers by `number`, but its private
  helper returns only the BC customer GUID.
- The existing company update workflow and step provide the mutation and compensation
  pattern needed for company updates.
- The company model has `currency_code` and `business_central_customer_number`, but does
  not have `blocked`, `credit_limit`, or `vat_number`.

## Trigger and request flow

There is no supported backend login event to subscribe to. The scoped trigger is therefore
an explicit post-authentication call from the existing storefront login server action:

1. `sdk.auth.login` succeeds and the storefront stores the returned token.
2. The storefront calls a protected, bodyless backend mutation, proposed as
   `POST /store/customers/me/company/sync-business-central`, using the SDK and the newly
   stored auth header.
3. The route passes only the authenticated customer ID to the synchronization workflow.
4. The workflow resolves the customer's linked company and its BC customer number,
   retrieves the BC customer, maps the approved fields, and updates that company.
5. The storefront continues its existing customer/cart/cache login work regardless of the
   synchronization result.

The endpoint is a trigger, not a general company update API. It accepts no company ID, BC
customer number, or field values. The backend catches and logs expected integration
failures and returns a non-failing outcome so BC availability cannot turn valid credentials
into a failed login. The storefront also treats transport failure from this secondary call
as non-fatal before continuing the existing login flow.

An explicit login can take place concurrently for multiple employees of one company. The
operation is naturally repeatable because every execution writes the latest values from the
same BC customer record; no lock, timestamp, or deduplication record is required.

## Data contract and mapping

Add a typed BC customer contract and a public service method equivalent to:

```typescript
getCustomer(customerNumber: string): Promise<BCCustomer | null>
```

The request must query `customers()` by escaped `number`, limit the result to one, and
expand the `currency` navigation property. The service returns `null` when no customer
matches and throws a redacted integration error for token, transport, HTTP, malformed
payload, or unsupported enum failures.

| Business Central source | Medusa company target | Mapping rule |
|---|---|---|
| `displayName` | `name` | Copy |
| `email` | `email` | Copy |
| `phoneNumber` | `phone` | Copy |
| `addressLine1`, `addressLine2` | `address` | Join non-empty lines with `", "` |
| `city` | `city` | Copy |
| `state` | `state` | Copy |
| `postalCode` | `zip` | Copy |
| `country` | `country` | Copy |
| `blocked` | `blocked` | Normalize and validate enum |
| `creditLimit` | `credit_limit` | Copy as decimal |
| `taxRegistrationNumber` | `vat_number` | Copy |
| `currency.code` | `currency_code` | Copy from expanded navigation property |

Address normalization has these outcomes:

- both lines populated: `<addressLine1>, <addressLine2>`;
- only one line populated: that line without a comma;
- both lines empty: an empty value, without a comma artifact.

Blocked-state normalization accepts the declared BC states and maps `_x0020_` (the raw
unblocked value observed in BC) to `""`. An unknown value must not be coerced to unblocked;
the synchronization attempt fails safely and preserves the previous Medusa company.

The synchronization updates only the fields in the table. It must not spread the BC
payload into the company update. In particular, it preserves `id`, `logo_url`,
`business_central_customer_number`, `spending_limit_reset_frequency`, `employees`,
`customer_group`, approval settings, and timestamps.

## Company model and migration

Extend the company model and all internal/public DTOs that represent persisted company
data with:

- `blocked`: enum `"" | "Ship" | "Invoice" | "All"`, defaulting to `""` for existing
  companies;
- `credit_limit`: nullable decimal so pre-sync rows distinguish unknown from a real zero;
- `vat_number`: nullable text.

Keep `currency_code` nullable and update it from `currency.code`. If the expanded currency
is absent, persist `null`; do not fall back to a different BC currency field.

Generate the migration from the changed company model with Medusa's company-module
migration command. Do not hand-author a migration unless generation cannot represent the
model change and that reason is documented. The migration must preserve all existing
company rows and be reversible according to the repository's migration conventions.

The new fields are not added to store/admin create or edit validators in this story. They
are integration-owned values written by the internal workflow, not caller-controlled
company form inputs.

## Workflow boundary

Create a dedicated synchronization workflow whose input is the authenticated Medusa
customer ID. Keep route handling limited to authenticated context and response mapping.

The workflow/steps must:

1. Resolve the customer employee and company, including company ID and
   `business_central_customer_number`.
2. Return a skipped result when there is no linked company or no configured BC customer
   number.
3. Retrieve the BC customer through the Business Central module.
4. Return a skipped result when no BC customer matches the configured number.
5. Map and validate only the approved BC fields.
6. Update the company through a Medusa workflow mutation step, reusing the existing
   company update step where its input and compensation behavior fit.
7. Return a small status result such as `updated`, `skipped`, or `failed`; do not return
   the BC payload.

Expected BC integration errors are contained at the synchronization boundary after being
logged. A failed fetch or invalid payload must never invoke the company update step, which
prevents partial overwrites. Unexpected programming or database failures should remain
visible in backend logs, while the route/storefront boundary still preserves the completed
authentication result.

## Skip and failure behavior

| Condition | Result | Company data | Login |
|---|---|---|---|
| Customer has no linked company | Skip silently | Unchanged | Continues |
| Company has no BC customer number | Skip silently | Unchanged | Continues |
| BC customer number has no match | Skip; warning log | Unchanged | Continues |
| BC token/transport/HTTP call fails | Error log with safe context | Unchanged | Continues |
| BC payload or blocked value is invalid | Error log with safe context | Unchanged | Continues |
| BC customer is valid | Update approved fields atomically | Updated | Continues |

Logs may include Medusa customer/company IDs, the operation name, and failure category.
Do not log credentials, access tokens, raw authorization headers, client secrets, full BC
responses, or unnecessary contact/address/VAT data. Avoid putting the BC customer number
in routine logs; if needed for diagnosis, log only an appropriately redacted value.

## Authorization and security constraints

- Require customer session or bearer authentication for the sync endpoint. Use
  `AuthenticatedMedusaRequest` and derive the actor from `req.auth_context`.
- Resolve company membership server-side from the customer-company link. Never accept an
  authority identifier in route params, query, or body.
- Do not permit one employee to synchronize another company, even when a valid company or
  BC customer number is known.
- Keep existing HTTPS and `api.businesscentral.dynamics.com` host validation.
- Escape the OData customer-number filter with the existing helper.
- Validate the BC response at the external-service boundary and reject unknown enum values
  rather than broad-casting them into company types.
- Return a minimal customer-safe response with no BC endpoint, token, raw error, or customer
  record.
- Do not expose the new integration-owned fields as writable store inputs in this story.

## Acceptance criteria

```gherkin
Feature: Synchronize a company from Business Central after login

  Background:
    Given a Customer Portal user is linked through an employee to a Medusa company

  Scenario: A successful login refreshes mapped company data
    Given the company has a Business Central customer number
    And BC returns a matching customer with an expanded currency
    When the user logs in successfully
    Then the backend retrieves the BC customer by that configured number
    And the approved Medusa company fields are updated from the BC customer
    And the existing login and cart flow continues

  Scenario: Address lines use the required separator
    Given BC addressLine1 is "Street 1"
    And BC addressLine2 is "Floor 2"
    When synchronization succeeds
    Then the Medusa company address is "Street 1, Floor 2"

  Scenario: A missing second address line adds no separator
    Given BC addressLine1 is "Street 1"
    And BC addressLine2 is empty
    When synchronization succeeds
    Then the Medusa company address is "Street 1"

  Scenario: The raw BC unblocked value is normalized
    Given BC blocked is "_x0020_"
    When synchronization succeeds
    Then the Medusa company blocked value is the empty enum value

  Scenario: Currency comes from the navigation property
    Given the expanded BC currency code is "SEK"
    When synchronization succeeds
    Then the Medusa company currency_code is "SEK"

  Scenario: No BC number does not interrupt login
    Given the company has no Business Central customer number
    When the user logs in successfully
    Then synchronization is skipped
    And the company remains unchanged
    And login succeeds

  Scenario: No matching BC customer preserves current data
    Given the company has a Business Central customer number
    And BC returns no matching customer
    When the user logs in successfully
    Then the company remains unchanged
    And login succeeds

  Scenario: BC failure does not interrupt login
    Given the company has a Business Central customer number
    And the BC request fails
    When the user logs in successfully
    Then the failure is logged without secrets or customer master data
    And the company remains unchanged
    And login succeeds

  Scenario: A caller cannot select another company
    Given the user belongs to company A
    When the login-triggered synchronization runs
    Then company scope is derived from the authenticated user's employee link
    And the request cannot provide company B or its BC customer number

  Scenario: Non-BC company fields are preserved
    When synchronization succeeds
    Then logo, reset frequency, employees, customer group, and approval settings are not
      overwritten
```

## Technical tasks

### Backend

- Add `BCCustomer`, blocked-state, currency, and service method types to the Business
  Central module contract.
- Implement `getCustomer(customerNumber)` with escaped filtering, `$top=1`, and currency
  expansion using the existing token and URL security behavior.
- Extend the company model and company DTO/module types with `blocked`, `credit_limit`, and
  `vat_number`.
- Generate and review a company-module migration.
- Add workflow read/mapping steps and the company update composition with skip/failure
  outcomes.
- Add the protected, bodyless customer sync route and middleware registration where
  required by the current route conventions.
- Add structured, redacted logs for no-match and integration-failure outcomes.

### Storefront

- Add an SDK helper for the protected synchronization route using the stored auth headers.
- Invoke it once after each successful call in the explicit login server action.
- Keep synchronization failures non-fatal and continue existing customer retrieval, cart
  metadata, cache revalidation, and cart-transfer behavior.
- Revalidate affected customer/company cache tags after a successful update as needed so
  the authenticated view does not retain stale company data.

### Automated tests

- Extend Business Central service unit tests for the customer-number filter, currency
  expansion, full mapping input, no match, non-OK response, and blocked normalization.
- Test the synchronization workflow for no linked company, no BC number, no BC match,
  valid update, unknown blocked value, BC error, and preservation of unrelated fields.
- Add authenticated route coverage proving the actor selects the company and an
  unauthenticated request is rejected.
- Add storefront login coverage or a focused helper test proving one sync attempt follows
  successful login and its failure does not fail the login action.
- Verify repeated/concurrent synchronization produces the same final company values.

### Validation

- Run the focused Business Central and workflow/route tests.
- Run backend unit/integration tests for the touched slices and `pnpm --filter
  @b2b-starter/backend build`.
- Run the focused storefront tests and storefront type/build validation for the modified
  login data layer.
- Apply the generated migration in a disposable/test database and verify existing company
  rows receive the unblocked default while nullable values remain unknown until sync.
- Exercise a sandbox BC customer with two address lines, `_x0020_`, decimal credit limit,
  VAT number, and expanded currency.

## Risks and dependencies

- The trigger depends on the repository's storefront login action because Medusa has no
  successful-login event. Other clients that call Medusa auth directly will not trigger
  synchronization unless they also call the protected sync endpoint.
- Login completion now includes a best-effort external sync attempt. BC failure is
  non-fatal, but BC response time can add latency to the login path under the current
  synchronous requirement.
- The observed `_x0020_` value differs from the logical empty BC enum member. Normalization
  and unknown-value rejection require explicit tests against sandbox payloads.
- Existing company rows need migration-safe defaults/nullability before their first sync.
- `creditLimit` must remain a decimal through BC parsing, TypeScript contracts, Medusa
  persistence, and serialization; accidental integer or minor-unit conversion would corrupt
  the value.

## Open questions

No business decisions remain open for implementation planning. The planner should verify
the exact OData shape of the expanded `currency` navigation property against the target BC
sandbox and preserve the scoped `currency.code` source.

## Scoping validation performed

- Reviewed the storefront login action and its auth-token, customer, cart, and cache flow.
- Reviewed the official Medusa v2 Auth Module event reference and confirmed there is no
  successful-login subscriber event.
- Reviewed the current BC token, host validation, customer-number lookup, and order service
  patterns.
- Reviewed the authenticated BC order route's customer-to-company graph query.
- Reviewed the company model, DTOs, update workflow/step, migrations, and integration-test
  surface.
- Applied the installed Medusa backend/storefront and OWASP guidance to the mutation,
  authorization, external-response validation, and logging boundaries.

## Definition of done

- Every successful explicit portal login makes one best-effort authenticated sync attempt.
- A valid BC customer updates exactly the approved company fields with the specified
  address, blocked, decimal, VAT, and currency mappings.
- Missing mappings, no BC match, invalid BC data, and BC outages preserve company data and
  do not fail authentication.
- Company authority is derived only from authenticated customer membership.
- The generated migration applies to existing company rows without data loss.
- Focused service, workflow, route, storefront, migration, and build validation passes.
- `issues/NIMBUS-156/PROGRESS.md` records handover to `implementation-planner`.