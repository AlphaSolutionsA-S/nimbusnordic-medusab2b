# Plan: Company admins can add another person's existing account to their company

> Record of NIMBUS-243, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

**Key:** NIMBUS-243 · **Branch:** `feature/NIMBUS-243` from `develop` · **Date:** 2026-10-26
**Scope:** [scope.md](./scope.md) (approved by Klaus Petersen, 2026-10-26)

## 1. Summary [High]

The store route `POST /store/companies/:id/employees` stops accepting `customer_id`. Its body
schema keeps only the new-account form, with email and password now required fields instead of a
"one or the other" refinement, so a body that carries `customer_id` is refused with 400 by Medusa's
existing body validation before the route runs, and the route loses its existing-customer branch.
The access guard still runs first, so a caller outside the company keeps getting 403. The Admin
route, company registration and the storefront's behaviour are unchanged; the stale `customer_id`
on the backend and storefront request types goes.

Two decisions shape it: the refusal comes from the strict schema (unknown field, 400), not from
code in the route; and email and password become required in the schema, which keeps the same
accepted set of bodies as today's refinement minus `customer_id`.

How to review this plan: approving it is the human gate that allows dispatch. Section levels say
how closely to read; the only `Critical` flag is the verification of the integration cases
(section 10, NIMBUS-236). Data model and state tables are High because past misses were found
there; here there is no data-model change, so they are short. The task files add depth but are not
required reading. A question is often quicker to settle by asking the planning agent in chat.

## 2. Needs your decision [Critical]

None. The integration-test verification rule (section 10) is decided in this plan; say so if you
want it otherwise. **Answer:** plan approved as written by Klaus Petersen, 2026-10-26, including
required email and password and the section 10 rule.

## 3. Flows [High]

### A. Company admin invites a colleague from the portal (tasks 01, 02; unchanged behaviour)

1. The invite card sends email, password, optional name, phone, spending limit, admin flag and page
   country to the store route.
2. Authentication, then the company access guard: the caller must be an admin employee of `:id`
   (403 otherwise).
3. Body validation accepts the body (email and password present, no unknown field).
4. The route runs the employee-account workflow: new customer, employee row in the company, admin
   role marker if `is_admin`, invitation event staged and released on success.

### B. Company admin tries to link an existing account (task 01)

1. The caller sends a body containing `customer_id` (with or without `is_admin`, with or without
   email and password).
2. Authentication and the access guard as in A2; an outsider stops here with 403.
3. Body validation refuses the unknown field `customer_id` with 400; the message names fields only.
4. The route never runs: no employee row, no company link, no customer-group membership, no role
   marker on any identity, no invitation event.

### C. Nimbus staff link an existing account in Medusa Admin (no task; unchanged)

1. `POST /admin/companies/:id/employees` with `customer_id` keeps working as today.

## 4. What gets built [High]

### 01. Store employee creation accepts only a new account (backend)

The store request validator for creating an employee (L6, route validation) drops `customer_id`;
email and password become required, and the refinement whose message mentioned `customer_id` is
removed. Because the schema is strict, a body with `customer_id` is an unrecognized field and gets
400 from Medusa's body validation. The store employee route (L6) keeps only the new-account path:
it always runs the employee-account workflow, and the import of the plain employee-creation
workflow, now unused there, goes. The unused backend request type for this body loses
`customer_id`. Business rules enforced: a company admin can only create a new account from the
portal; linking an existing account from the portal is refused and changes nothing; the access
guard's 403 still comes first.

Tests: a unit case on the validator (a body with `customer_id` does not parse, also with email and
password present; a body without email or password does not parse); the existing invitation
contract test for a store link is retargeted to 400, no employee record and no invitation; a new
negative case in the security-boundaries suite proves an own-company admin cannot attach a
companyless customer as admin (400, no employee record, no `company_admin` marker on that
customer's identity). The foreign-company case stays as it is. The architecture doc's
invitation-email section is reworded: linking an existing customer is Admin-only.

### 02. Storefront request type matches the store contract (storefront)

The storefront's request type for creating an employee (shared type, used by the S2 data
function) loses the optional `customer_id` nobody sets. No runtime change.

## 5. Data model [High]

No change, no migration. For reference:

| Entity / field | Owner | Written by (after this change) | Stored | Note |
|---|---|---|---|---|
| `employee` (company, customer, is_admin, spending_limit) | `company` | store route (new account only), Admin route, company registration | yes | the store route can no longer write a row for a pre-existing customer |
| emailpass provider identity `user_metadata.role` | Medusa Auth | `setAdminRoleStep`, reached from the store route only for the account it just created | yes | legacy marker, grants no authority |
| `employee.invited` event | — | `createEmployeeAccountWorkflow` | transient | unchanged |

## 6. Business rules as state tables [High]

Entity: membership of a customer in company X, via the store route.

| Current state | Event | Outcome | Side effects on other rows / sessions |
|---|---|---|---|
| any | admin of X posts email + password | 200, new customer and employee of X | admin marker if `is_admin`; invitation staged |
| customer C has no company | admin of X posts `customer_id: C` (any other fields) | 400 | none: no employee, link, group, role marker or event |
| customer C is in a company | admin of X posts `customer_id: C` | 400 | none |
| any | non-admin or admin of another company posts anything | 403 (guard before validation) | none |

Actor recorded: none today, none added.

## 7. Security-property matrix [Critical: company authorization]

| Property | Control | Trust root | Failure behaviour | Negative test |
|---|---|---|---|---|
| A company admin cannot attach someone else's existing account | strict store body schema without `customer_id` | Medusa body validation (strict zod), verified | 400, no write | security-boundaries: own company, companyless customer, `is_admin: true`; invitation spec retargeted case; validator unit case |
| A company admin cannot give someone else's account the admin marker | same; the store route reaches the role step only for the account it created | same | 400, no role change | security-boundaries case asserts no `company_admin` on that identity |
| Only an admin of `:id` reaches validation | `ensureCompanyAccess(true)` registered before body validation | server-side employee record of the authenticated customer | 403 | existing foreign-company case (unchanged) |
| No personal data on failure | Medusa formats unknown keys as `Unrecognized fields: '<names>'` and missing ones as `Field '<name>' is required` | — | — | not separately tested (framework formatting) |

## 8. Decisions [New: High; From scope: Medium]

New in this plan:

- Email and password become required in the store schema and the refinement goes. Why: the
  refinement only existed to allow the `customer_id` alternative; required fields give the same
  accepted set, field-named errors, and remove the non-null assertions in the route. Source: this
  plan.
- Two tasks, split by app (backend, storefront). Why: the storefront change is a type only and runs
  its own typecheck. Source: this plan.
- `docs/security-remediation.md` is not changed (scope called the note optional; it does not
  describe store `customer_id` linking). Source: this plan.
- Does the framework already do this? Yes: Medusa's body validation rejects unknown keys of a
  strict schema with 400 (verified, section 9); no route code is added for the refusal.
- No framework internal is called directly.

From the scope:

- Drop `customer_id` from the store route if nothing depends on it (Klaus Petersen, 2026-10-26);
  checked, nothing does.
- Refuse with 400 rather than silently ignore.
- Admin route out of scope.

## 9. Framework assumptions [Medium]

| Primitive | Verified behaviour | Evidence |
|---|---|---|
| `validateAndTransformBody` / `zodValidator` | parses with the strict schema; on a zod error throws `MedusaError` `INVALID_DATA` (400) with "Invalid request: …"; unknown keys formatted as `Unrecognized fields: '<keys>'` (names only); missing fields as `Field '<name>' is required` | verified: `apps/backend/node_modules/@medusajs/framework/dist/zod/zod-helpers.js` (`zodValidator`, `formatError`); existing contract cases already get 400 for unknown `to` and `company_country` |
| Middleware order on POST `/store/companies/:id/employees` | `ensureCompanyAccess(true)` runs before `validateAndTransformBody` | verified: `apps/backend/src/api/store/companies/middlewares.ts` |
| `setAdminRoleStep` | writes `user_metadata.role = "company_admin"` on the emailpass identity whose `entity_id` is the customer's email | verified: `apps/backend/src/workflows/employee/steps/set-admin-role.ts` |

## 10. Open risks and gates [Medium; Critical where flagged]

- `Critical` Integration cases cannot pass locally while NIMBUS-236 is open (status Scoping on
  2026-10-26): both specs fail with 401 on login. Rule for the dispatcher (non-blocking): per task,
  run the validator unit test, lint and typecheck as normal. At finalization, run both specs anyway
  (`test:integration:http -- integration-tests/http/companies/employee-invitation.spec.ts` and
  `.../security/security-boundaries.spec.ts`). If the touched cases fail only with 401 on login,
  record them in the deviation report as "code complete, unverified because NIMBUS-236" and
  continue; if they pass, record that; any other failure in a touched case is a blocker. The
  validator unit test carries the core control meanwhile. Owner: dispatcher.
- A client outside this repository might call the store route with `customer_id`; none is known.
  After deploy, check Medusa Cloud logs for unexpected 400s on this route. Owner: Klaus Petersen.
  Non-blocking.
