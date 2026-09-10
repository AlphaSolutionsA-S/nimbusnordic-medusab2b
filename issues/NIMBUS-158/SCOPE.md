# Show Business Central status and retry in Medusa Admin

- **Date:** 2026-09-02
- **Status:** Scoped
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-158
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-158/
- **Size:** M
- **Area:** Backend — Medusa Admin order-detail widget and Business Central submission trigger
- **Base Branch:** develop
- **Requested by:** Klaus Petersen (klp@alpha-solutions.dk)
- **Requested at:** 2026-08-21T07:46:49.447Z

## Background

Internal order operations need a simple way to see whether a persisted Medusa order has been
written to Business Central and to start that process from the Medusa Admin order page when
needed.

NIMBUS-149 supplies the persisted Medusa order and its Business Central integration-state
metadata. NIMBUS-148 supplies the reusable workflow that writes the order to Business Central
and records the resulting status and Business Central order identifier. This story exposes that
existing state and workflow to authenticated Medusa Admin users; it does not implement a
scheduled monitor, automatic retry engine, or another Business Central submission process.

The normal submission path remains duplicate-safe. An Admin may deliberately send an already
sent order again, but only through an explicit force-resend confirmation that clearly warns that
another Business Central order may be created. This approved exception supersedes NIMBUS-148's
general rule that a previously sent order must always be short-circuited.

## Requirements

### Functional

- Add a widget to the Medusa Admin order-detail page.
- Display the order's current Business Central integration status from the integration-state
  metadata established by NIMBUS-149 and updated by NIMBUS-148.
- Display the current Business Central order identifier when one is present; show a clear empty
  value when no identifier has been recorded.
- Provide a **Refresh** action that explicitly reloads the displayed integration status and
  Business Central order identifier. The widget does not poll or refresh automatically.
- Provide a **Write to BC** action that starts NIMBUS-148's reusable Business Central submission
  process for the current Medusa order.
- Start the submission asynchronously. After the start request is accepted, tell the Admin that
  processing has started; do not wait for Business Central completion. The Admin uses **Refresh**
  later to retrieve the outcome.
- Disable the submission and refresh controls while their respective requests are in progress,
  and show a clear error if either request cannot be started or completed.
- For an order that has not been sent, invoke the normal duplicate-safe submission path.
- For an order whose status is `sent` or that already has a Business Central order identifier,
  treat another submission as a deliberate force resend:
  - show a confirmation before starting it;
  - state clearly that the order has already been sent;
  - display the current Business Central order identifier in the warning when available;
  - state clearly that continuing may create another order in Business Central; and
  - proceed through a distinct force-resend path only after explicit confirmation.
- Enforce the distinction between a normal submission and a confirmed force resend on the
  backend. A normal request must not bypass NIMBUS-148's duplicate guard.
- Make the widget and both actions available to all authenticated Medusa Admin users for now.
  Role-specific visibility and execution permissions are not required by this story.
- After a submission or force resend completes in the background, a later refresh must show the
  status and Business Central order identifier recorded by NIMBUS-148.

### Non-Functional

- Protect all status and submission operations as authenticated Admin functionality.
- Use the existing NIMBUS-148 workflow for Business Central writes rather than duplicating its
  item lookup, payload construction, delivery, or outcome-persistence logic.
- Keep ordinary retries idempotent and duplicate-safe. Only the explicitly confirmed force-resend
  path may bypass the already-sent guard.
- Do not expose the raw canonical order payload, credentials, customer tokens, internal exception
  details, or other secret material in the widget or its API responses.
- Keep the interaction usable during slow Business Central processing by returning after the work
  has been accepted rather than holding the Admin request open until completion.
- Use Medusa Admin's authenticated SDK client and established Admin UI components and feedback
  patterns.

## Affected Apps

- **backend** — add the Medusa Admin order-detail widget and the authenticated Admin interface
  needed to read integration state and start NIMBUS-148's reusable submission workflow, including
  the explicitly confirmed force-resend variant.
- **storefront** — not involved.
- **Azure integration** — not involved.

## Proposed Structure

1. Define the Admin-facing read contract for the current Business Central integration status and
   Business Central order identifier using the metadata contract supplied by NIMBUS-149 and
   NIMBUS-148.
2. Define an authenticated Admin mutation that starts NIMBUS-148's reusable submission workflow
   asynchronously for a Medusa order, preserving its normal duplicate guard.
3. Extend the reusable submission entry point only as needed to accept an explicit force-resend
   intent and bypass the already-sent guard for that deliberate path.
4. Build the order-detail widget with status and Business Central order-ID display, manual
   **Refresh**, and **Write to BC** actions.
5. Add the force-resend confirmation for already-sent orders, with an unambiguous duplicate-order
   warning and no submission until the Admin confirms.
6. Add coverage for status display, missing and present Business Central identifiers, explicit
   refresh, asynchronous start feedback, normal duplicate protection, cancelled force resend,
   confirmed force resend, request failures, and authenticated-Admin access.

## Out of Scope

- Scheduled jobs that search for orders not written to Business Central.
- Automatic retries, retry schedules, polling, or automatic widget refresh.
- Reimplementation of Business Central item lookup, order mapping, or submission logic already
  owned by NIMBUS-148.
- Role-specific widget visibility or submission permissions.
- Storefront, APIM, Logic App, or other Azure integration changes.
- Displaying or managing a history of prior Business Central order identifiers created by force
  resends; the widget shows the current identifier recorded by the integration state.

## Open Questions

- The implementation planner must reconcile the concrete metadata keys and status values with
  the final contracts produced by NIMBUS-149 and NIMBUS-148.
- The implementation planner must determine the smallest safe force-resend input and workflow
  change that preserves the default duplicate guard while allowing only an explicit override.
- The implementation planner must define how concurrent start requests are rejected or serialized
  so repeated clicks or parallel Admin sessions do not unintentionally submit the same order
  multiple times.
- Role-based access can be reconsidered as a separate enhancement if the deployed Medusa Cloud
  plan and application authorization model expose suitable RBAC capabilities.

## Dependencies

- **NIMBUS-129** — parent epic defining the asynchronous order-ingestion and internal-operations
  outcome.
- **NIMBUS-149** — supplies the persisted Medusa order and initial Business Central
  integration-state metadata.
- **NIMBUS-148** — supplies the reusable Business Central submission workflow, duplicate guard,
  status updates, and Business Central order identifier. Its already-sent guard must gain a
  narrowly scoped, explicit force-resend override for this story.
