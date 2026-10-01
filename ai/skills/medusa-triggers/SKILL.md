---
name: medusa-triggers
description: "Medusa v2 (Node/TypeScript) backend layer skill for L7: the event subscribers (src/subscribers/**) and scheduled jobs (src/jobs/*.ts) that start a workflow. Load before adding or changing a subscriber, a cron job or an event-driven background sync."
---

# Triggers (L7)

The layer ids come from the Medusa Tier 0 starter shipped with the `medusa-backend` skill. Paths are
relative to the backend's `src/`; written against Medusa 2.17.

Layer row: [layers.md](../../architecture/layers.md) (L7). Medusa detail: the `medusa-backend`
skill's reference/subscribers-and-events.md and reference/scheduled-jobs.md (the home of the job
and route rules).

## Responsibility

A trigger turns an event or a schedule into one workflow run: read the payload, call
`someWorkflow(container).run({ input })`, log the outcome. It holds no logic: filtering on a
business condition, status bookkeeping and error aggregation belong to the workflow. A job runs its
workflow directly and emits no event (`arch-job-runs-workflow`).

A subscriber has typed `SubscriberArgs`, one `<workflow>(container).run(...)` and a `config` with
the event name. A job that must not overlap takes the single-run lock with a per-run `ownerId`,
runs its workflow, logs the result and releases in `finally`.

## Allowed dependencies

| ID | Applies here as |
|---|---|
| `bound-trigger-thin` | no value import of `modules/*/service.ts`, no import of any `steps/` |
| `bound-api-private` | nothing from `api/` |
| `bound-model-private` | no import of a module's `models/` |
| `bound-app-isolation` | nothing from another app in the repo (e.g. the storefront) |

L7 calls L4. Pure logic a trigger needs lives in `workflows/helpers/` (`file-workflow-helpers-shared`).

## Forbidden

- Logic in the trigger (layers.md L7), such as an actor-type or eligibility rule in a subscriber
- `arch-job-runs-workflow`
- `type-container-resolve`
- `NO_UNKNOWN_CAST`
- `no-plan-id-comments`

Locks: `lock-single-run`, `lock-ttl`. A single-run lock around the workflow run is the one thing a
trigger adds besides the call; a lock around changing specific data belongs in the workflow.

Recording a failed run: a trigger may catch its workflow's failure and record it through the owning
module's service (for example `markSyncFailed(operationType, getErrorMessage(err))`), importing the
service type-only. A workflow cannot record its own failure with the real message: compensations
never receive the error. Where one step already wraps the whole run, record it in that step
instead; don't add a nested workflow just to move this call.

## Canonical example

Set per project in `project.md`: one file in this repo that passes every rule above, and the files not to copy.

## Checklist

- [ ] Every ID under Allowed dependencies and Forbidden, and the lock IDs
- [ ] One workflow run, no business branching (layers.md L7); pure logic in `workflows/helpers/`
  (`file-workflow-helpers-shared`)

## Project specifics

If `project.md` exists next to this file, read it as well. It holds this project's paths, canonical examples, exceptions and extra rules, and it wins where the two differ.
