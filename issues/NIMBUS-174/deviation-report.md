# NIMBUS-174 implementation review

Date: 2026-10-24

## Review

The main agent repeated the whole product diff review after the user requested another review. The prior component reviewer stopped because workspace credits were exhausted; this final review was performed by the main agent, not a separate reviewer. No blocking findings were found in the changed code.

The action returns a message-free success/failure result, preserves the full manual-code list, handles removal of the last code, and catches backend/cart failures. The component uses real form actions, keeps the controlled input after failure, clears it after successful add, and displays one translated error for both add and remove. Tests cover these behaviors without stubbing React action state. No backend, authorization, payment, dependency or translation contract changes were introduced.

Installed Medusa `get-promotion-codes-to-apply.js` confirms unknown codes throw INVALID_DATA and REPLACE clears the old code list. Existing authenticated cart mutation and backend promotion validation remain authoritative. Client-supplied applied codes do not authorize access.

## Deviations and limitations

- Typecheck baseline is 58 errors with the current installed dependencies, rather than the September plan's 9. Final typecheck also reports 58; none originate in the new promotion code. Existing cart.ts revalidateTag diagnostics remain.
- Lint is blocked by existing Next/ESLint setup: `next lint` is unavailable, and direct ESLint fails on the legacy configuration.
- Production build was attempted and stopped at missing NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY. No successful build or deployed result is claimed.
- Existing `lib/util/medusa-error.ts` logs response data and headers for Axios-shaped errors. It is outside this task and unchanged; the new action logs through logCustomerError. This is an existing OWASP A09 follow-up concern.
- Concurrent mutations using stale client lists are not claimed to merge. The approved plan explicitly uses client-submitted manual codes without an extra cart read.
- User authorized commit, push and merge and explicitly took ownership of manual validation. Production `/dk` and `/gb` checks remain with the user: invalid code/error text/input retention; add two valid codes; remove one then the last; failed removal.

## Delivery

The final automated suite result and handover are recorded in PROGRESS.md. Jira remains in review pending user validation; merge is not evidence of production behavior.
