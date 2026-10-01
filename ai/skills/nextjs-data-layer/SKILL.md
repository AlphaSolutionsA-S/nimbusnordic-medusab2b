---
name: nextjs-data-layer
description: "Next.js App Router (Node/TypeScript) layer skill for the storefront data layer S0–S2: server-only transport clients, pure mappers, and data functions or server actions under lib/<vendor>/, for Medusa or any other backend or vendor. Load before adding or changing how the storefront fetches, maps or mutates data."
---

# Storefront data layer (S0–S2)

Written for Next.js 16 (App Router). The layer ids are the storefront rows of the Medusa Tier 0
starter (`medusa-backend`'s `tier0/layers.md`). Where the project's Tier 0 `layers.md` has
storefront rows, those are the rules and the table below does not apply; it is the default only for
a project without them. Test layer: Tier 0 `verification.md`. Vendor detail: for a Medusa backend,
`medusa-storefront`; for other vendors, their own skill.

| # | Layer | Location (default) | Must never |
|---|---|---|---|
| S0 | Transport client | `lib/<vendor>/client.ts` or `live-client.ts`; a single-file vendor keeps it in `lib/<vendor>/index.ts`. All `server-only` | map, validate, decide |
| S1 | Mapper | `lib/<vendor>/mappers.ts` (pure) | fetch |
| S2 | Data fn / action | `lib/<vendor>/index.ts`, `lib/<vendor>/*-actions.ts` (`"use server"`) | hold a domain rule |

Routes and Server Components (`app/**`) and presentation components consume S2 and never reach S0.

## Responsibility

S0, the transport client, is `server-only` and does one thing: authenticated HTTP to one vendor,
returning raw vendor shapes or throwing. S1, the mapper, is a pure function from a raw shape to a
view model. S2, the data function or server action, composes them: picks mock or live mode,
validates the contract at the boundary, calls S0, maps with S1, and reports failure as a distinct
state rather than an empty result. None of them decides a business rule; the storefront renders
the backend's verdict (Tier 0 `decisions.md`, where the project has one).

What a clean slice looks like:
- S0: `import "server-only"`, the secret (e.g. a Bearer token) read from server-only config, one
  exported function per endpoint, a fetch with a timeout and Next.js `next: { revalidate }`, 404
  returned as `null`, other non-OK statuses thrown.
- S1: pure, type-only imports, time injected as a parameter rather than read from the clock.
- S2: mock mode only when explicitly configured; an unconfigured or failed vendor reported as
  unavailable rather than backfilled with mock data; each record validated with an assertion
  function before mapping; error logs without the payload.
- A server action: `"use server"`, calls the backend through its client (for Medusa,
  `sdk.client.fetch` on a custom Store route), returns a typed response.

## Allowed dependencies

| ID | Applies here as |
|---|---|
| `bound-sf-transport-private` | only files in the same `lib/<vendor>/` import its client or the vendor SDK (`@medusajs/js-sdk` for Medusa) |
| `bound-sf-transport-leaf` | a client imports no mapper and no `*-actions.ts` |
| `bound-sf-server-only` | every `client.ts` / `live-client.ts`, and a single-file vendor's `index.ts`, imports `server-only` |
| `bound-sf-mapper-pure` | a mapper imports no client, no action, no `next/*`, no `server-only` |
| `bound-app-isolation` | nothing from another app in the repo (e.g. the backend) |

S2 calls S0 and S1; S1 calls nothing; S0 calls only its vendor's HTTP API or SDK.

## Forbidden

- A business rule in S0–S2 (Tier 0 `decisions.md`; "One home per business rule" in `rules.md`)
- `sdk-always-use`, `sdk-client-fetch`, `sdk-no-json-stringify`, `sdk-plain-objects` (Medusa calls; `medusa-storefront`)
- `data-price-format` (Medusa prices; `medusa-backend`)

## Canonical example

Set per project in `project.md`: one file in this repo that passes every rule above, and the files not to copy.

## Checklist

- [ ] Every ID under Allowed dependencies and Forbidden
- [ ] Failure of a vendor shows as a distinct state, not an empty list or mock data

## Project specifics

If `project.md` exists next to this file, read it as well. It holds this project's paths, canonical examples, exceptions and extra rules, and it wins where the two differ.
