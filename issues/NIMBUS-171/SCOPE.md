# Validate country codes in submitted orders

- **Date:** 2026-09-30
- **Status:** Approved by the user on 2026-09-30
- **Type:** Story
- **Tracker:** JIRA — https://alphasolutionsdk.atlassian.net/browse/NIMBUS-171
- **Priority:** Medium
- **Project Folder:** issues/NIMBUS-171/
- **Size:** S
- **Area:** Backend — order ingestion (canonical order contract and validation); NIMBUS-145 APIM contract artifacts
- **Base Branch:** develop
- **Requested by:** Klaus Petersen (klp@alpha-solutions.dk)
- **Requested at:** 2026-09-29T12:06:33Z (Jira issue created)

> Scoping answers were given by the user on 2026-09-30 through the main session and relayed
> to the scoper. They are recorded under "Decisions" below. The user's replies to the last
> open questions were relayed as approval with amendments. The scoper cannot take a relayed
> message as approval, so the user still needs to confirm approval directly.

## Background

External B2B customer systems submit orders as JSON or XML through Azure APIM into the Medusa
order API (epic NIMBUS-129). The canonical order contract (NIMBUS-147) accepts any non-empty
text as the `country` of the `billTo` and `shipTo` addresses. Since NIMBUS-149 the address is
saved on the Medusa order, and the value is only lowercased into the order address's country
code. So values like "Denmark" or "DNK" are stored as invalid country codes. Order creation does
not catch this, because the order address's country code is plain text with no link to Medusa's
country list (NIMBUS-149 decision D8, which left validation to the contract).

The issue was raised during the NIMBUS-149 code review on 2026-09-29.

Affected parties:
- the customer systems that send orders through APIM, which currently get no feedback for a bad
  country;
- the order data that goes on to Business Central (NIMBUS-148), which would carry invalid codes.

## Decisions (user answers, 2026-09-30)

D1–D8 come from the first round of answers. D9–D11 come from the user's replies to the three
open questions, quoted: "1 no second list - smaller check in APIM", "2 yes", "3 fine - but have
a place to handle exceptions".

| # | Topic | Decision |
|---|-------|----------|
| D1 | Where the check lives | **Both.** The backend canonical order schema is the check that must hold. The NIMBUS-145 APIM contract states the same rule so APIM can reject early. |
| D2 | Which codes are valid | **All ISO 3166-1 alpha-2 codes** (fixed list). Limiting orders to the countries in Medusa regions is a separate decision. |
| D3 | Case and whitespace | Any case is accepted and surrounding spaces are trimmed. The value is stored in lowercase, as now (e.g. `" dk "` → `dk`). |
| D4 | Error format | The existing order validation error format (the 400 schema-validation response), naming the field (e.g. `shipTo.country`) and the value that was sent. No new error code. |
| D5 | Which addresses | Every address in the order, currently `billTo` and `shipTo`. |
| D6 | Existing data | Out of scope. Cleaning up invalid codes that are already stored is a separate issue. |
| D7 | Apps | Backend plus the contract docs. No storefront changes. |
| D8 | Business Central format | The implementation-planner checks what country-code format Business Central needs, and flags it if it differs from what is stored. |
| D9 | APIM strictness | APIM runs only a small shape check: two letters, any case, surrounding spaces allowed. There is no second ISO list in APIM. The backend checks the real ISO list. |
| D10 | Source of the ISO list | The implementation-planner uses a library that is already installed, or else a fixed list kept in the backend. Not Medusa regions. |
| D11 | Codes not officially assigned (e.g. XK, UK, EU) | Only officially assigned ISO 3166-1 alpha-2 codes are valid by default. The design must include one explicit, documented place to add exceptions later, such as a small allowlist next to the ISO check. No exceptions are added now. |

## Requirements

### Functional

- When an order includes a `billTo` or `shipTo` address, its `country` must be an
  ISO 3166-1 alpha-2 code after trimming and ignoring case. Examples: `DK`, `dk` and `" SE "`
  are accepted. `DNK`, `Denmark`, `XX` and `""` are rejected.
- An order with an invalid country is rejected with a validation error before anything is
  created. No Medusa order, external reference or ingestion record is created.
- The validation error uses the existing order validation response format. It names the field
  path and the value that was sent.
- Only officially assigned codes are valid. One explicit, documented place (an exceptions
  allowlist next to the ISO check, empty for now) lets codes such as `XK` be allowed later
  without changing the check itself.
- Accepted country codes are stored in lowercase on the Medusa order address, as now.
- `billTo` and `shipTo` stay optional. The rule only applies when an address is present.
- The NIMBUS-145 contract artifacts (the JSON schema, the XSD and the contract/test-payload docs)
  state the rule. The APIM gateway must never reject a value that the backend accepts.
- The NIMBUS-147 contract description records the rule for the `country` field.

### Non-Functional

- Validation happens synchronously, in the same request, before order creation, as the other
  canonical checks do.
- The error response shows only the field path and the country value the customer sent. It must
  not echo other payload content, internal ids, tokens or credentials.
- No new network calls or database lookups are needed for this check. The ISO list is fixed.

## Affected Apps

- **backend** — the canonical order schema's address `country` rule, with trimming and case
  normalisation. The existing lowercasing into the order address stays. Tests for valid and
  invalid countries at schema, mapping and HTTP level.
- **Contract artifacts (NIMBUS-145 / NIMBUS-147 docs)** — the country rule in the JSON schema,
  the XSD (shape check only, D9), the test payloads and the contract description. Redeploying the APIM policy or schema
  follows NIMBUS-145's deployment instructions.
- **storefront** — not involved. Storefront checkout uses Medusa's own address and region flow,
  not the canonical order contract.

## Proposed Structure

High-level tasks for the implementation-planner:

1. **Backend schema rule.** Change the canonical address `country` to trim, ignore case and accept
   only ISO 3166-1 alpha-2 codes (D10). Put one explicit, documented, initially empty exceptions
   allowlist next to the ISO check (D11). Keep the error in the existing 400 validation format with the
   field path and the value sent. Confirm that order mapping keeps storing the lowercased value.
2. **Contract artifacts.** Add the shape-only check (D9) to the NIMBUS-145 JSON schema and XSD, and update the test payloads (add an
   invalid-country negative case) and the NIMBUS-147 contract description with the rule.
3. **Business Central check (D8).** Find out what country format Business Central expects in the
   NIMBUS-148 order payload, and record it. Change nothing beyond this story's scope; raise a
   follow-up if the format differs.
4. **Tests.** Unit tests for the schema (valid, lowercase, padded, three-letter, full name,
   unknown two-letter, empty), a mapping test for the lowercased output, and an HTTP test showing
   an invalid country gives a 400 with nothing created.

## Open Questions

None open. The three earlier open questions were answered on 2026-09-30 and are recorded as
decisions D9–D11 above.

## Out of Scope

- Cleaning up or reporting on already-stored invalid country codes (D6).
- Limiting orders to the countries in Medusa regions (D2).
- Storefront changes (D7).
- Validating other address fields (post codes, states).

## Dependencies

- **NIMBUS-147** (Internal review) — owns the canonical order contract this story tightens.
- **NIMBUS-149** (Internal review) — order mapping that lowercases `country` into the order
  address's country code; decision D8 there deferred validation to the contract.
- **NIMBUS-145** — APIM contract artifacts (JSON schema, XSD, APIM policy, test payloads) that
  must reflect the rule. Redeploying them follows its deployment instructions.
- **NIMBUS-148** — sends orders to Business Central; relevant to the country-format check (D8).
- Parent epic **NIMBUS-129**.
