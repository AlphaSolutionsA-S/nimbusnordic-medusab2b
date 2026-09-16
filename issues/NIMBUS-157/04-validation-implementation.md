# Task 04 — Cross-application tests and validation

**Apps:** backend + storefront
**Depends on:** 01, 02, 03
**Base branch:** \`develop\`

## Goal

Prove the profile is genuinely read-only to customers, financially safe at the server boundary,
and informative-but-editable in Admin.

## Required checks

1. Run the Task 01 integration tests against a regular employee, a company admin, and a
   cross-company customer. Inspect response bodies for omitted financial keys, including nested
   employee values and field-selection bypasses.
2. Run storefront component/page tests for the read-only card, empty values, permitted values,
   and absence of edit controls.
3. Run Admin tests for the persistent warning, all twelve field indicators, and a successful
   Admin update of blocked, credit-limit, and VAT values.
4. Run backend and storefront lint/type/build commands from the relevant package scripts.
5. Perform a short OWASP authorization review: actor identity and company ownership are derived
   server-side; no writable storefront route remains for the profile; no financial data appears
   in JSON, cacheable page data, or errors for a non-admin.

## Completion evidence

Record the commands and outcomes in \`issues/NIMBUS-157/PROGRESS.md\`. If an existing unrelated
test failure prevents a full suite, record the exact command, failure, and focused tests that
did pass; do not mark this task validated without that distinction.
