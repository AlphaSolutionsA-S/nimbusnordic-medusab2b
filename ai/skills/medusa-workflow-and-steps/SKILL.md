---
name: medusa-workflow-and-steps
description: "Medusa v2 (Node/TypeScript) backend layer skill for L3–L5: the workflows (src/workflows/<wf>/index.ts), their steps (steps/*.ts) and the pure decision functions in helpers/. Load before writing or changing a workflow, a step, a compensation, a workflow hook or a business-rule helper."
---

# Workflows and steps (L3–L5)

The layer ids come from the Medusa Tier 0 starter shipped with the `medusa-backend` skill. Paths are
relative to the backend's `src/`; written against Medusa 2.17.

Layer rows: [layers.md](../../architecture/layers.md) (L3, L4, L5). Test layer per kind:
[verification.md](../../architecture/verification.md). Medusa detail: the `medusa-backend` skill's
sections "Workflow Composition Rules", "Reusing another workflow" and "Workflow Step Testability",
plus its reference/workflows.md, reference/workflow-hooks.md and reference/querying-data.md.

## Responsibility

A workflow (L4) owns every piece of logic that spans more than one module, and its rollback. Its
composition function only wires steps: `transform()` for data, `when()` for branches,
`runAsStep` for other workflows. A step (L3) is one compensatable unit of I/O: it resolves
services, reads through Query, calls one mutation or adapter, and returns a `StepResponse` with
the data its compensation needs. A decision function (L5) is one named business rule as a pure
function on plain data; steps and `transform()` call it. When two steps do the same thing, share
the step (`file-shared-step`).

## Allowed dependencies

| ID | Applies here as |
|---|---|
| `bound-workflow-no-upward` | nothing from `api/`, `subscribers/`, `jobs/` |
| `bound-helper-pure` | `<wf>/helpers/` imports no service, no step, no `workflows-sdk` value |
| `bound-model-private` | no import of another module's `models/` |
| `bound-api-private` | nothing from `api/` |
| `bound-app-isolation` | nothing from another app in the repo (e.g. the storefront) |

L3 may call L1, L2, L5 and Query. L4 calls L3, L5 inside `transform()`, and other workflows via
`runAsStep`. L5 calls nothing.

## Forbidden

- `file-workflow-folder`, `file-workflow-composition`, `file-workflow-steps`,
  `file-workflow-helpers-local`, `file-workflow-helpers-shared`, `file-workflow-tests`,
  `file-shared-step`
- `logic-workflow-validation`, `logic-ownership-checks`
- `arch-module-isolation`
- `data-core-read-workflows`, `data-schema-vs-model`, `data-no-core-internals`
- `data-query-method`, `data-query-graph`, `data-query-index`, `data-linked-filtering`,
  `data-no-js-filter`, `data-no-computed-filter`, `data-price-format`
- `type-container-resolve`, `type-metadata-optional`
- `NO_FIRE_AND_FORGET`, `NO_SET_IMMEDIATE`, `NO_UNKNOWN_CAST`
- A second implementation of a rule already in `decisions.md`
- A `helpers/` file that resolves services or runs `query.graph`: that is I/O in a helpers folder,
  not L5 (`bound-helper-pure`)

Locks: `lock-critical-section`, `lock-ttl`. A lock that keeps a sync to one run at a time belongs in
the trigger (`lock-single-run`).

Patterns to follow:
- Prefer OOTB core-flows steps and workflows (`findSalesChannelStep`, `emitEventStep`,
  `sendNotificationsStep`, `refreshCartItemsWorkflow.runAsStep`) over hand-written ones.
- One compensatable mutation per step with its rollback beside it (soft-delete and restore; revert
  the field it changed).
- The pure decision in `helpers/` (`file-workflow-helpers-local`), unit-tested in
  `helpers/__tests__/`.
- A `query.graph` read of a core entity in a step carries a one-line comment marking it as a
  deliberate exemption (`data-core-read-workflows`); core-flows has no cart read workflow.

## Canonical example

Set per project in `project.md`: one file in this repo that passes every rule above, and the files not to copy.

## Checklist

- [ ] Every ID under Allowed dependencies and Forbidden, and the lock IDs
- [ ] Rule registered once in `decisions.md`
- [ ] OOTB primitive behaviour verified before adding a pre-check or retry (medusa-boundary.md)

## Project specifics

If `project.md` exists next to this file, read it as well. It holds this project's paths, canonical examples, exceptions and extra rules, and it wins where the two differ.
