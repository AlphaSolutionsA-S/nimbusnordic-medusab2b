---
name: medusa-api-route
description: "Medusa v2 (Node/TypeScript) backend layer skill for L6: the HTTP routes and their middlewares (src/api/**/route.ts and middlewares.ts). Load before adding or changing a backend API route, its request validation, its authentication or its response shape."
---

# API route (L6)

The layer ids come from the Medusa Tier 0 starter shipped with the `medusa-backend` skill. Paths are
relative to the backend's `src/`; written against Medusa 2.17.

Layer row: [layers.md](../../architecture/layers.md) (L6). Route contracts are tested at the layer
[verification.md](../../architecture/verification.md) names for them. Medusa detail: the
`medusa-backend` skill's reference/api-routes.md, reference/authentication.md and
reference/error-handling.md.

## Responsibility

A route validates the request (Zod schema in a middleware), then either runs one workflow for a
mutation or reads through Query (or a core read workflow), and shapes the response. It does not
branch on a business condition and never mutates through a module service. Work that cannot
finish within the request is handed off with an event-bus emit that a subscriber picks up
(`arch-route-emits-long-work`, `medusa-triggers`). The body stays within `limit-route-body`.

## Allowed dependencies

| ID | Applies here as |
|---|---|
| `bound-route-no-service` | no value import of `modules/*/service.ts` (read through Query instead) |
| `bound-api-private` | files outside `api/` never import from `api/` |
| `bound-model-private` | no import of a module's `models/` |
| `bound-app-isolation` | nothing from another app in the repo (e.g. the storefront) |

L6 calls L4, Query and the event bus.

## Forbidden

- `arch-workflow-required`, `arch-layer-bypass`, `arch-http-methods`, `arch-query-config-fields`,
  `arch-route-emits-long-work`
- `type-request-schema`, `type-authenticated-request`, `type-export-schema`, `file-middleware-exports`
- `import-top-level`, `import-static-only`, `import-no-dynamic-routes`
- `logic-workflow-validation`, `logic-ownership-checks`, `data-auth-middleware`
- `limit-route-body`
- `NO_LOCKING_IN_ROUTES`, `NO_FIRE_AND_FORGET`, `NO_SET_IMMEDIATE`, `NO_UNKNOWN_CAST`
- `data-core-read-workflows` for core-entity reads
- Raw SQL in a route (data-ownership.md)

The shape to follow: only the HTTP methods the route needs; `MedusaRequest<Schema>`; the Zod schema
and its inferred type exported from the middleware file and applied with
`validateAndTransformBody`; the route's middlewares array spread into `src/api/middlewares.ts`; the
body runs the workflow and maps the result, with no `if`.

## Canonical example

Set per project in `project.md`: one file in this repo that passes every rule above, and the files not to copy.

## Checklist

- [ ] Every ID under Allowed dependencies and Forbidden
- [ ] A route contract test covers the request and response (verification.md)

## Project specifics

If `project.md` exists next to this file, read it as well. It holds this project's paths, canonical examples, exceptions and extra rules, and it wins where the two differ.
