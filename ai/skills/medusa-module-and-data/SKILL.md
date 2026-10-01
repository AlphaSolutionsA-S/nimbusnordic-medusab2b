---
name: medusa-module-and-data
description: "Medusa v2 (Node/TypeScript) backend layer skill for L0–L1: the data models (src/modules/<m>/models/), module services (service.ts) and module links (src/links/). Load before adding or changing a custom module, a data model, a module service method, a module link or a migration."
---

# Module and data (L0–L1)

The layer ids come from the Medusa Tier 0 starter shipped with the `medusa-backend` skill. Paths are
relative to the backend's `src/`; written against Medusa 2.17.

Layer rows: [layers.md](../../architecture/layers.md) (L0, L1). Table ownership:
[data-ownership.md](../../architecture/data-ownership.md). Medusa API detail: the `medusa-backend`
skill's reference/custom-modules.md, reference/data-models.md and reference/module-links.md.

## Responsibility

A module owns its tables and nothing else. L0 declares them with `model.define`; L1 is the
`MedusaService` class that does CRUD and enforces invariants on those tables only. A module does
not resolve another module, call HTTP itself, or know that a workflow exists. It may call its own
L2 client, an internal service in `modules/<m>/services/`, but never while holding a transaction:
read and audit in one short transaction, make the external call with none open, then write.
Anything spanning two modules is a workflow; relationships to other modules are links in
`src/links/`, and cross-module reads go through Query.

## Allowed dependencies

| ID | Applies here as |
|---|---|
| `bound-model-private` | `models/` is imported only from inside its own module |
| `bound-module-isolation` | no import from another module's folder |
| `bound-module-no-upward` | no import from `workflows/`, `api/`, `subscribers/`, `jobs/`, `links/` |
| `bound-links-index-only` | a link file imports only `modules/*/index.ts` and `@medusajs/medusa/*` |
| `bound-app-isolation` | nothing from another app in the repo (e.g. the storefront) |

L1 may call its own L0. A pure rule about the module's own tables may sit beside the service, as
its own file in the module folder.

## Forbidden

- `arch-module-isolation`, `logic-module-service`, `limit-service-one-module`
- `type-linkable-auto`, `type-module-name-camelcase`
- `data-service-async`, `data-service-transaction`
- `data-migrations-required`, `file-links-directory`
- `data-price-format`
- `NO_UNKNOWN_CAST`
- Foreign keys to another module's table, and raw SQL on tables the module does not own
  ([data-ownership.md](../../architecture/data-ownership.md)).

Patterns: a plain `<entity>_id` column with a `readOnly: true` link over it
([data-ownership.md](../../architecture/data-ownership.md)); the service and `index.ts` shape in the
`medusa-backend` skill's reference/custom-modules.md.

## Canonical example

Set per project in `project.md`: one file in this repo that passes every rule above, and the files not to copy.

## Checklist

- [ ] Every ID under Allowed dependencies and Forbidden
- [ ] Table registered in `data-ownership.md`

## Project specifics

If `project.md` exists next to this file, read it as well. It holds this project's paths, canonical examples, exceptions and extra rules, and it wins where the two differ.
