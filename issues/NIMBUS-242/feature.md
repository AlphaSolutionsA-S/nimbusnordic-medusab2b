# Invited employees receive an invitation email

- Tracker: Jira (NIMBUS) — [NIMBUS-242](https://alphasolutionsdk.atlassian.net/browse/NIMBUS-242) (Story, component `Customer Portal`)
- Priority: Should (proposed; Jira is authoritative once filed)
- Size: S–M (proposed)
- Area: Customer Portal company account page ("Invite employee"); backend employee creation; customer email notifications
- Requested by: Klaus Petersen
- Requested at: 2026-10-24T00:00:00Z

## Description
When a company administrator invites a new employee from the company page in the Customer Portal,
the employee should receive an email telling them they now have an account. Today the employee
account is created straight away, the button says "Send invite" and the administrator sees an
"invited" message, but no email is sent.

## Why
The portal promises an invitation it does not deliver, so new employees do not learn they have
access.

## Decided (Klaus Petersen, 2026-10-24)
- The email is a plain notification: it tells the employee they have an account and for which
  company. It contains no password and no set-password link.
- The employee gets access either from the password the administrator typed (shared by the
  administrator outside the portal) or through "Forgot password" on the login page (NIMBUS-133).
- The invite form keeps the administrator-typed password; the invite form and its behaviour do not
  change otherwise.
- Production delivery uses Medusa Cloud's built-in email (Medusa Emails); no third-party email
  service.
- Translation of the invite email belongs to NIMBUS-162, together with the password-reset email:
  the email goes out in the language of the storefront country it was triggered from. The order of
  the two pieces of work is decided in NIMBUS-162.
- Employees that Nimbus staff create in Medusa Admin also receive the email. With no storefront
  country, its language follows the company's country, then English (NIMBUS-162).

## Acceptance criteria
- [ ] When a company administrator invites a new employee from the company page, that employee receives an email at the address entered, saying they have an account and naming the company.
- [ ] When Nimbus staff create a new employee account for a company in Medusa Admin, that employee receives the same email.
- [ ] The email contains no password, no set-password or reset link, and no other credential.
- [ ] Only the invited address receives the email.
- [ ] A failed email does not undo the invitation.
- [ ] The invite form and what the administrator enters are unchanged.

## Out of scope
- Email delivery setup: the Medusa Cloud email configuration and sender domain are already taken care of (Klaus, 2026-10-24); no delivery work in this issue.
- Translating the email: done under NIMBUS-162.
- Changing how passwords are set for invited employees.
- Linking an already-existing customer account to a company.

## Email text (decided 2026-10-24: Klaus asked for a simple proposal; English reference text)
The email links to the portal login page. Placeholders: `{firstName}`, `{companyName}`, `{loginUrl}`.

- Subject: `Your Nimbus Nordic customer portal account`
- Body:

  > Hi {firstName},
  >
  > {companyName} has created an account for you on the Nimbus Nordic customer portal. You log in
  > with this email address.
  >
  > Your company administrator will give you your password. You can also choose your own password
  > with "Forgot password" on the login page.
  >
  > [Log in to the customer portal]({loginUrl})

## Open questions
None.

## Mockups / references
- NIMBUS-133 (forgotten password): https://github.com/AlphaSolutionsA-S/nimbusnordic-medusab2b/blob/develop/issues/NIMBUS-133/SCOPE.md
- NIMBUS-162 multi-lingual transactional emails; NIMBUS-134 change password.
- Medusa Emails: https://docs.medusajs.com/cloud/emails

## Technical notes
Triage findings (light look, not a design):

- Storefront: `apps/storefront/src/modules/account/components/invite-employee-card/index.tsx` posts first/last name, email and an administrator-typed password (min 8) via `createEmployee` in `apps/storefront/src/lib/data/companies.ts`.
- Backend route: `POST /store/companies/:id/employees` (`apps/backend/src/api/store/companies/[id]/employees/route.ts`), guarded by `ensureCompanyAccess(true)` (company admin) in `apps/backend/src/api/store/companies/middlewares.ts`. Validator `StoreCreateEmployee` requires either `customer_id` or `email` + `password`.
- Workflow: `createEmployeeAccountWorkflow` (`apps/backend/src/workflows/employee/workflows/create-employee-account.ts`): registers the emailpass identity, runs core `createCustomerAccountWorkflow`, then `createEmployeesWorkflow`. No event of its own; the Admin route `apps/backend/src/api/admin/companies/[id]/employees/route.ts` and `register-company.ts` share the employee workflows.
- Core event: installed `@medusajs/core-flows` 2.21.2 `createCustomerAccountWorkflow` runs `createCustomersWorkflow`, which emits `customer.created`. It fires for every customer creation (self-registration, company registration, Admin), so on its own it cannot tell an invite apart; a dedicated event or a hook from the employee-account path is likely needed. The scoper/planner decides.
- Existing pattern: NIMBUS-133 password reset — subscriber `apps/backend/src/subscribers/customer-password-reset.ts` → `apps/backend/src/workflows/customer/workflows/send-password-reset.ts` (core `sendNotificationsStep`, channel `email`) → `apps/backend/src/workflows/customer/utils/password-reset-notification.ts` (English).
- Admin route `POST /admin/companies/:id/employees` (`apps/backend/src/api/admin/companies/[id]/employees/route.ts`) also runs `createEmployeeAccountWorkflow`; `register-company.ts` runs only `createEmployeesWorkflow`.
- Delivery: email configuration and sender domain on Medusa Cloud are handled outside this issue (Klaus, 2026-10-24). Delivery is confirmed only after deploy, in Cloud's Email Activity page.
- The CMS's Resend setup (`apps/cms/src/email.ts`) is for Payload editors only and belongs to another app.
- Security notes for scoping: the employee's email, name and company are personal data in the notification (persisted by Medusa Notification; logged by the local provider in development); never include the password.
- Side observation (not part of this request): the same store route accepts an existing `customer_id`, and `createEmployeesWorkflow` shows no check that the customer belongs to the caller (not verified whether `createEmployeesStep` or the module refuses it); worth a look by the scoper.
