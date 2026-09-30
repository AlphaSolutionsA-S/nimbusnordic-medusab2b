# Task 03: APIs and mutation workflows

**Status:** TODO
**App:** backend
**App Root:** apps/backend
**Task ID:** 03
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-175 (from develop)
**Depends on:** 01, 02

## Environment

Load building-with-medusa references api-routes, authentication, workflows, and
querying-data; apply secure-coding-owasp. Follow existing company workflows and
middleware aggregators. HTTP tests use `medusaIntegrationTestRunner` with
`JWT_SECRET: 'supersecret'` and existing admin/store auth helpers. Retain the
Business Central test-environment guard and use local disposable PostgreSQL.

## Workflow skeletons

Create `src/workflows/storefront-translation/steps/mutate-translation.ts`:

```ts
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { STOREFRONT_TRANSLATION_MODULE } from '../../../modules/storefront-translation';
import type StorefrontTranslationModuleService from '../../../modules/storefront-translation/service';
import type { MutationInput } from '../../../types/storefront-translation';
export const mutateTranslationStep = createStep(
  'mutate-storefront-translation',
  async (input: MutationInput, { container }) => {
    const service = container.resolve<StorefrontTranslationModuleService>(STOREFRONT_TRANSLATION_MODULE);
    return new StepResponse(await service.mutateDocument(input));
  },
);
```

Create `workflows/mutate-translation.ts` under the same feature:

```ts
import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import { mutateTranslationStep } from '../steps/mutate-translation';
import type { MutationInput } from '../../../types/storefront-translation';
export const mutateTranslationWorkflow = createWorkflow(
  'mutate-storefront-translation', function (input: MutationInput) {
    return new WorkflowResponse(mutateTranslationStep(input));
  },
);
```

Two additional step/workflow pairs use exactly the same imports/structure:
`report-missing-translations` takes `MissingReport[]`, calls `service.reportMissing`,
returns `{accepted, ignored}`; `dismiss-missing-translation` takes
`{locale: string; id: string}`, calls `dismissMissing`, returns `{dismissed: true}`.
Each pair is one transactional mutation with no later failing mutation to compensate.
Never implement a rollback that overwrites a subsequently committed version.

Task 07 adds a callback after the successful mutation workflow resolves. Until
then, return `refresh: 'deferred'` for active changes and `not_needed` for inactive
document edits; runtime TTL already provides a safe interim behavior.

## API files

Under `src/api/admin/ui-translations/`, create `route.ts`, `validators.ts`,
`middlewares.ts`, and the route files matching every Admin suffix in CONTRACTS.md:
`[locale]/route.ts`, `[locale]/import-preview/route.ts`, `[locale]/import/route.ts`,
`[locale]/activation/route.ts`, `[locale]/export/route.ts`, `missing-keys/route.ts`,
`[locale]/missing-keys/[id]/resolve/route.ts`, and
`[locale]/missing-keys/[id]/dismiss/route.ts`.

Every POST file uses this skeleton, replacing the body schema and operation:

```ts
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { z } from 'zod';
import { SaveTranslationSchema } from '../validators'; // adjust relative depth
import { mutateTranslationWorkflow } from '../../../../workflows/storefront-translation/workflows/mutate-translation'; // adjust depth

export async function POST(
  req: AuthenticatedMedusaRequest<z.infer<typeof SaveTranslationSchema>>,
  res: MedusaResponse,
): Promise<void> {
  // IMPLEMENT: canonical validated params + validatedBody -> exact MutationInput.
  // await workflow(req.scope).run({input}); return contract DTO, not ORM object.
}
```

Use actual relative depth from each route; target modules are fixed above. GET
handlers use `MedusaRequest`/`MedusaResponse`, resolve this module for same-module
reads, explicitly select fields, and map dates. Preview is a POST read: validate,
check expected version, compute proposed merge/replace and warnings, return no
mutation. Export uses application/json and a safe canonical filename; output only
messages, without ID/version/history. Global missing-key GET is paginated and
supports the unprovisioned-locale outage case.

`validators.ts` imports Zod and Task 01's schemas; export strict
`CreateTranslationSchema`, `SaveTranslationSchema`, `ImportPreviewSchema`,
`ImportTranslationSchema`, `ActivationSchema`, `ResolveMissingSchema`, and
`MissingListQuerySchema` with the shapes in CONTRACTS.md. Validate params too.
In `middlewares.ts`, use `defineMiddlewares`, explicit method/matcher entries,
`validateAndTransformBody`, and `bodyParser: { sizeLimit: '1mb' }` on import/save.
Register these entries from `src/api/admin/middlewares.ts`. Preserve framework
admin authentication; no `AUTHENTICATE=false` export and no employee-role override.

Create `src/api/store/ui-translations/[locale]/route.ts` (GET only), validate
locale, retrieve the row, and return active-only data per CONTRACTS.md. Register
any custom validators through `src/api/store/middlewares.ts`, preserving the
publishable-key gate. Do not add customer authentication to public translation reads.

Create `src/api/internal/ui-translations/missing-keys/{route,validators,middlewares}.ts`.
POST validates the bounded discriminated report batch and calls its workflow.
Internal middleware, registered in `src/api/middlewares.ts`, verifies a configured
server-only Bearer secret using Node `timingSafeEqual` after length checks and
applies the 32 KiB parser limit before parsing. Reject an empty configured secret.
Neither a publishable key nor a customer JWT grants reporting permission.

## Tests

Create `integration-tests/http/translations/translations.spec.ts`. Use real HTTP
and PostgreSQL, not mocked authorization or a mocked service for the CAS tests.

- **TC-1:** Given admin, customer, and anonymous callers, when exercising each
  Admin read/write, then only admin succeeds. Active public read succeeds with a
  publishable key; inactive/absent404 and missing publishable key fails.
- **TC-2:** Given an existing document, when saving a removed/new key through
  normal edit, then reject; import may change keys only under its explicit rules.
- **TC-3:** Given replace preview with removals, when applying without confirmation
  or using a stale version, then reject with 400/409 and preserve data. A confirmed
  current preview succeeds. Two new-locale imports yield one201 and one409.
- **TC-4:** Given empty environment, when importing English first with no reference,
  then create an inactive language with a warning, not a fatal dependency on English.
- **TC-5:** Given malformed/prototype/oversized inputs or excessive report batches,
  when sent over HTTP, then reject at the boundary with no partial writes.
- **TC-6:** Given no/wrong report secret, then deny; valid reports deduplicate,
  caps hold, and reports for already-filled keys do not recreate inbox entries.
- **TC-7:** Given an ID belonging to another locale or an outage sentinel, when
  attempting to resolve it as a missing message, then refuse. Export/import round
  trips retain all string content and nesting.

Run focused HTTP tests and backend build. Do not loosen global relation limits or
existing auth/security middleware to make this feature work.
