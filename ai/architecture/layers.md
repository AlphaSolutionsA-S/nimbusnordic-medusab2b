# Layers

Every file belongs to one layer and calls only what its row allows (checked in `boundaries.md`).
Paths are relative to `apps/backend/src/`, `apps/storefront/src/` and `apps/cms/src/`.

## Backend

| # | Layer | Location | Owns | May call | Must never |
|---|---|---|---|---|---|
| L0 | Data model | `modules/<m>/models/*.ts` | its tables (`data-ownership.md`) | — | be imported outside its module |
| L1 | Module service | `modules/<m>/service.ts` | CRUD + invariants on its own tables | its own L0, its module's L2 client | resolve another module, do HTTP itself or while holding a transaction, know a workflow exists |
| L2 | Infra adapter | `modules/business-central/service.ts` (Business Central HTTP client, no tables); notification provider `notification-local` (`medusa-config.ts`) | exactly one external system | that vendor's HTTP API | hold a domain rule |
| L3 | Step | `workflows/<domain>/steps/*.ts` | one compensatable unit | L1, L2, L5, Query | orchestrate other steps |
| L4 | Workflow | `workflows/<domain>/workflows/*.ts`; core-flow hooks in `workflows/hooks/*.ts` | logic spanning more than one module; compensation | L3, L5 inside `transform()`, other workflows via `runAsStep` | `await`, branch outside `when()`, `new Date()` |
| L5 | Decision fn | `workflows/<domain>/utils/*.ts`, `utils/*.ts` (pure parts) | one pure business rule | nothing | any I/O |
| L6 | API route | `api/{store,admin,orderapi,internal}/**/route.ts`, `api/**/middlewares.ts`, `api/middlewares/*.ts` | validate → run L4 or Query → shape the response | L4, Query, event bus | branch on a business condition; mutate via L1 |
| L7 | Trigger | `subscribers/*.ts`; `jobs/` (none yet) | call one workflow | L4 | hold logic |

Only the pure functions in `utils/` are L5. Admin UI (`admin/**`) calls the backend only over HTTP
through `admin/lib/client.ts`.

Limits: an L6 route body is at most 40 lines, with no `if` on a domain value
(`limit-route-body`); no L1 method touches more than one module's data (`limit-service-one-module`).

L5 names a business rule, never a mocking seam.

## Storefront (Next.js App Router, Medusa JS SDK)

| # | Layer | Location | Must never |
|---|---|---|---|
| S0 | Transport client | `lib/config.ts` (the single `sdk`); `middleware.ts` uses raw `fetch` because the Edge runtime cannot load the SDK | map, validate, decide |
| S1 | Mapper | `lib/util/*.ts` (pure helpers; no dedicated mapper files yet, UNVERIFIED as a layer) | fetch |
| S2 | Data fn / action | `lib/data/*.ts`: `"use server"` actions; `cms.ts` and `ui-translations.ts` are `server-only` loaders | hold a domain rule |
| S3 | Route / server component | `app/[countryCode]/**`, `app/api/**`, `i18n/request.ts` | fetch vendor APIs directly |
| S4 | Feature component | `modules/<feature>/{components,templates}/**` | fetch, or import `lib/` beyond S1 helpers and S2 actions |

## CMS (Payload, `apps/cms`)

`collections/*.ts` and `blocks/*.ts` define the schema, registered in `payload.config.ts`; migrations
in `migrations/`. The storefront reads the CMS only through `lib/data/cms.ts`.

Not retrofitted: each layer skill's `project.md` lists the legacy files that break these rows
("Do not copy"); new code never copies them.
