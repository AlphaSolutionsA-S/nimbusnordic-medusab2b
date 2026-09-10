# NIMBUS-160: Ensure Business Central company data is fresh before viewing Company page

- **Status:** Scoped
- **Issue:** https://alphasolutionsdk.atlassian.net/browse/NIMBUS-160
- **Priority:** Medium
- **Area:** Backend company retrieval and Business Central synchronization
- **Size:** S
- **Base Branch:** develop

## Objective

Before returning a company to the authenticated Company page, ensure the company has been successfully synchronized from Business Central within the previous 10 minutes. When synchronization fails, return the last persisted company data and leave its successful-sync timestamp unchanged so the next request retries.

## Confirmed Decisions

- A stale or never-synchronized company blocks the Company page request while the existing Business Central synchronization runs.
- A failed synchronization does not fail the Company page. The endpoint returns the existing persisted company data.
- Only a successful synchronization updates the freshness timestamp. Failed attempts do not throttle subsequent requests.
- The synchronization covers exactly the company fields already synchronized on login: name, email, phone, address, city, state, postal code, country, blocked state, credit limit, VAT number, and currency code.
- Refresh is automatic only. There is no customer-facing "sync now" action in this story.

## Current State

- The storefront Company page calls `GET /store/companies/:id` through `retrieveCompany`.
- The endpoint is customer-authenticated but currently returns the stored company immediately.
- Login invokes `POST /store/customers/me/company/sync-business-central`, which runs the existing `syncCompanyFromBusinessCentralWorkflow`.
- The company model does not persist the time of the last successful Business Central synchronization.
- Storefront company data is tag-cached per browser cache ID. A successful refresh must invalidate the relevant company cache tag so later renders receive the refreshed record.

## In Scope

1. Add a nullable, durable last-successful-Business-Central-sync timestamp to the company module and generate the matching database migration.
2. Extend the existing synchronization workflow so it sets that timestamp only when it successfully applies Business Central data.
3. Add freshness handling to `GET /store/companies/:id`:
   - Read the company timestamp.
   - When missing or more than 10 minutes old, run the existing synchronization workflow using the authenticated customer identity.
   - Re-read and return the persisted company after a successful synchronization.
   - When the workflow reports a Business Central failure or skip, return the existing persisted company without changing the timestamp.
4. Preserve the existing authentication model and resolve the company from the authenticated customer when deciding whether to synchronize; do not trust a caller-supplied customer identity.
5. Ensure a successful automatic refresh invalidates the applicable storefront company cache entry before the Company page is rendered again.
6. Add focused backend integration coverage for the fresh, stale-success, stale-failure, and no-timestamp cases.

## Out of Scope

- Changing the existing login synchronization trigger or its public route.
- Manual refresh controls, freshness indicators, or error notices in the storefront UI.
- Webhooks, scheduled synchronization, polling, or real-time updates from Business Central.
- Retrying, backoff, or throttling failed Business Central requests. A failure intentionally leaves the prior successful-sync timestamp unchanged.
- Changing which Business Central company fields are mapped.
- Broad authorization refactoring of company endpoints.

## Behavioral Contract

| Situation | Required behavior |
| --- | --- |
| No successful-sync timestamp | Synchronize before returning the company. |
| Timestamp less than or equal to 10 minutes old | Return stored company data without a Business Central call. |
| Timestamp older than 10 minutes | Synchronize before returning the company. |
| Synchronization succeeds | Persist mapped Business Central fields and the current successful-sync timestamp; return refreshed company data. |
| Synchronization reports failure | Return existing company data; retain the old timestamp so the next request retries. |
| Company has no Business Central customer number | Preserve existing skip behavior and return stored company data. |

## Acceptance Criteria

- [ ] Opening the authenticated Company page checks a company-level, persisted successful-sync timestamp that works across browser sessions and devices.
- [ ] A company with no timestamp or a timestamp older than 10 minutes is synchronized before `GET /store/companies/:id` returns its response.
- [ ] A company synchronized within the prior 10 minutes does not make a Business Central request.
- [ ] A successful synchronization updates the mapped fields and the timestamp atomically through the existing company update workflow.
- [ ] If Business Central synchronization fails, the endpoint responds successfully with the last persisted company data and preserves the previous timestamp.
- [ ] A failed request is retried on the next Company-page request rather than treated as fresh.
- [ ] No manual refresh control or new storefront freshness state is added.
- [ ] Existing login synchronization continues to work and updates the same timestamp after success.

## Likely Implementation Areas

- `apps/backend/src/modules/company/models/company.ts`
- `apps/backend/src/modules/company/migrations/`
- `apps/backend/src/workflows/company/steps/prepare-company-bc-sync.ts`
- `apps/backend/src/workflows/company/workflows/sync-company-from-business-central.ts`
- `apps/backend/src/api/store/companies/[id]/route.ts`
- `apps/backend/integration-tests/http/customers/company-sync.spec.ts`
- `apps/backend/integration-tests/http/companies/companies.spec.ts`
- `apps/storefront/src/lib/data/companies.ts` only if cache invalidation cannot be completed from the backend response path without a small integration adjustment.

## Verification

- Run the focused backend HTTP integration tests for company retrieval and company synchronization.
- Verify a fresh timestamp suppresses `BusinessCentralService.getCustomer`.
- Verify a stale or missing timestamp invokes it and returns updated fields on success.
- Verify a Business Central failure returns HTTP 200 with pre-existing fields and unchanged timestamp.
- Verify the backend build and lint pass for changed files.

## Handover

Use the `implementation-planner` agent to convert this approved scope into dependency-ordered implementation tasks and a manifest. The plan must keep synchronization mutations inside the existing workflow and keep the Company GET route limited to freshness orchestration and response retrieval.
