# Plan: Show the size on shipment notice lines

> Record of NIMBUS-231, frozen when the work shipped. Not maintained: the code and docs/architecture/ describe current behaviour.

**Key:** NIMBUS-231 · **Scope:** `scope.md` (approved 2026-10-24) · **Branch:** `feature/NIMBUS-231` from `develop`
**Apps:** backend only, plus customer artifacts in `issues/NIMBUS-231/artifacts/` · **Tasks:** 4 ·
**Skills used:** `medusa-backend`, `medusa-infra-adapter`, `medusa-workflow-and-steps`

## 1. Summary [High]

Order API customers get shipment notices whose lines name the item but not the size shipped. Since
NIMBUS-180 sized items reach Business Central (BC) as item + variant, and the variant code is the
size. BC's API v2.0 shipment lines carry no variant, so each check run adds one read of the
third-party ODataV4 web service `TRCShipmentLine` (shipment number, line number, variant code) per
20 shipments, and every notice line recorded from the release on gets `variant_code`. Notices
stored earlier are served with `variant_code: null`; nothing is back-filled.

Decisions that shape it:

- The BC adapter only reads the variant rows; joining them to the shipment lines, the "missing row"
  rule and the undo-correction pairing are one pure decision rule (L5). The scope sketched the join
  inside the adapter; moving it out keeps the domain rule out of L2 and lets one shipment with a
  missing row fail alone instead of failing its whole batch of 20.
- The size is not part of change detection, so the release creates no `revised` notice for
  shipments already notified, and a failed or throttled size read fails the check exactly like a
  failed shipment read today: no notice, retried on the existing back-off.
- The company name the ODataV4 call needs is read through the shipment-read request path (timeout,
  deadline, throttling) and kept with the shipment-read token, so it costs one request per token
  lifetime rather than one per call.

How to review this plan: this plan is the human review gate; approving it is what allows dispatch.
Section headings carry review levels (Critical, High, Medium); rows flagged `Critical` are where
review matters most: both items under Needs your decision and the B4 row of the state table. The
data model and state tables are rated High because past misses were found there. The task files
hold more depth for anyone who wants it but are not required reading. Uncertainties are often
quicker to resolve by asking the planning agent in chat than by reading further.

## 2. Needs your decision [Critical]

1. `Critical` **Next-link origin of `TRCShipmentLine` (UNVERIFIED, blocks dispatch).** The adapter
   follows `@odata.nextLink` only to the configured BC origin (`api.businesscentral.dynamics.com`)
   and refuses any other. The scoper's probe saw next links but did not record their host, and my
   probe could not reach BC from this sandbox (the token request succeeded, the BC call timed out at
   the network). If BC returned another host, a batch with more than 200 lines would fail the check
   every time (fail-closed, no wrong data). Check: run
   `node issues/NIMBUS-231/samples/probe-trc-paging.mjs apps/backend/.env` from the repo root
   (read-only, TestDK only, prints no tenant or ids) and confirm line `1 nextLink origin equals
   request origin: true`; or allow me network access to run it. *Default:* you run it before
   dispatch and paste the output into `samples/bc-shipment-line-variant-testdk.md`.
2. **Deployed APIM policy and Logic App.** I cannot see Azure. The repo copies
   (`issues/NIMBUS-130/artifacts/apim-policy.xml`, last changed in dfad6bc, and
   `logic-app-workflow-definition.json`) render every JSON property as an element of the same name
   and pass Medusa's body through, so `variant_code` needs no change there. Check in the Azure
   Portal that the deployed `GET /shipment-notices/{token}` operation policy and the
   `shipment-notices` workflow match those files (at least: the outbound walk over
   `Properties()` with no field list, and `Response_Medusa` body `@body('Get_Shipment_Notices_From_Medusa')`).
   *Default:* you confirm at the release, before publishing the new schemas; no task depends on it.

**Answers (Klaus Petersen, 2026-10-24):** 1. Verified: Klaus ran the probe in TestDK; the next link
stays on the request origin (`true`), output in `samples/probe-trc-paging-output.md`. 2. Default
accepted (Klaus checks the deployed APIM policy and Logic App at release). Plan approved.

## 3. Flows [High]

### A. A check run reads and records a shipment (tasks 01, 02)

1. The poll job takes up to 200 due tracking rows; closing, superseded and company checks run first,
   unchanged.
2. For each batch of up to 20 shipment numbers, the step reads the shipments and their lines from BC
   API v2.0 as today.
3. Right after, in the same batch, it reads `TRCShipmentLine` rows (`documentNumber, lineNo,
   variantCode`) for the same numbers: one GET with an `or` filter, following next links to the BC
   origin. The first such read after a token renewal also reads the company name.
4. For each tracked shipment, the decision rule joins the rows by shipment number and line number.
   Every item line needs a row; an empty variant code becomes null.
5. Undo corrections pair with the line they undo only when item, unit, opposite quantity and variant
   code all match; otherwise the shipment is unpairable, as today.
6. The content hash is computed from the same fields as today (BC line, item, unit, net quantity),
   so an unchanged shipment records nothing.
7. When a notice is recorded, every listed line carries `variant_code` (null for items without
   sizes), including quantity-0 lines of `revised` and `cancelled` notices. The payload is stored in
   `shipment_notice.payload` as today.

### B. The size read fails (tasks 01, 02)

1. Throttled (429 or 503) on either the size read or its company-name read: the run stops reading BC
   and sets the BC back-off, as a throttled shipment read does today; rows stay due.
2. Deadline reached before a request starts: the run stops; the batch's rows stay due, unchanged.
3. Any other failure (status, timeout, malformed body, foreign next link): every row in the batch
   fails with `bc_error` and backs off (15 min, 1 h, 4 h, 6 h; gives up after the window).
4. One of a shipment's item lines has no row (or the shipment has none at all): that shipment alone fails
   with `variant_missing` and backs off as in B3; the others in the batch are decided normally.

### C. A customer reads notices (task 03)

1. `GET /orderapi/shipment-notices` reads stored rows and builds the page as today.
2. Each line of a notice stored before the release, which has no `variant_code` key, is served with
   `variant_code: null`; a stored row is never rewritten.
3. APIM omits null fields in XML, so such lines have no `<variant_code>` element.

## 4. What gets built [High]

### 01. Read shipment line sizes from BC

A new read operation on the BC module service (L2 infra adapter): given shipment numbers and the
run's deadline, it returns one row per posted shipment line from the ODataV4 web service
`TRCShipmentLine`: shipment number, line number and variant code (trimmed; empty becomes null). It
selects only those three fields, chunks the numbers by 20 joined with `or` (quotes escaped as in the
shipment read), sends GET requests one at a time with the shipment-read token, the 20-second
timeout, the page-size preference and the deadline check, follows next links only to the BC origin,
and turns 429/503 into the existing throttling error. The company name for the ODataV4 `company`
parameter is read through the same request path and cached with the shipment-read token. The
adapter holds no rule about missing rows; unknown numbers simply return no rows. Pure URL building
and row mapping live beside the existing shipment-read helpers.

### 02. Size on notice lines: contract, decision rule and check wiring

The wire contract's notice line gains `variant_code`, a nullable string present on every line. The
notice decision rule (L5) takes the variant rows of its shipment and enforces B1 (size = posted
variant code, empty → null), B3 (undo pairing also matches variant code) and B4 (an item line with
no row → the new outcome "variant missing" with the BC line number); the content hash keeps its
current definition (B2). The check step (L3) calls the task 01 read after the shipment read for each
batch, inside the same failure handling (B5), passes each shipment's rows to the rule, and records a
missing row as the failure code `variant_missing` with the BC line number in the log line. The
business-rule registry row for shipment notices names the size join and pairing.

### 03. Serve notices stored before the release with a null size

The stored-notice row type (L1, `orderIngestion`) states the truth: lines stored before the release
may lack `variant_code`. The pure page builder (L5) fills `variant_code: null` on any line without
the key, so the endpoint never omits it; new rows pass through unchanged. No stored row changes, no
migration.

### 04. Customer artifacts and architecture doc

New JSON Schema, XSD and examples in `issues/NIMBUS-231/artifacts/`, copied from the NIMBUS-130
originals with `variant_code` added to the line (JSON: nullable string, required key; XSD: optional
`xs:string` element), one example line with a size and one without, and a short release note for
Klaus (what changed, that old schemas reject the field, deployment: customers and docs only, APIM and
Logic App unchanged). `docs/architecture/order-api/shipment-notices.md` gains the second BC read, its
request budget, the field, the cut-off, the `variant_missing` code and the TRC dependency risk, and
names that doc as where the current contract description lives (the case folder freezes at ship).

## 5. Data model [High]

No table, column or migration changes.

| Entity / field | Meaning | Existing callers | Owner | Written by | Stored or derived | Encrypted | Mutable until | Retention / deletion | Indexes |
|---|---|---|---|---|---|---|---|---|---|
| Notice line `variant_code` (in `shipment_notice.payload` JSON) | BC variant code (size) of the shipped line; null when the item has no variant | none (new) | `orderIngestion` | check step, from the decision rule | stored (JSON) | no | never (rows are append-only) | as the notice: no deletion mechanism today | none |
| Notice lines stored before the release | Payload lines without the key | page builder, endpoint | `orderIngestion` | nobody after the release | stored as is; null derived on read | no | never | as today | none |
| `shipment_notice.content_hash` | Change detection of shipped lines | decision rule, store | `orderIngestion` | check step | stored | no | never | as the notice | existing |
| `shipment_tracking.last_error` value `variant_missing` | A check failed because an item line had no `TRCShipmentLine` row | Admin shipment tracking page (shows the code as is) | `orderIngestion` | check step | stored (text, no constraint) | no | next check | as the row | none |
| `TRCShipmentLine` row (`documentNumber`, `lineNo`, `variantCode`) | Posted shipment line's variant, key shipment number + line number | none (new) | BC (third-party extension) | BC | read per check, kept only inside the notice | no | — | not stored | — |
| Cached company name (memory) | `company` parameter of ODataV4 calls | return reads use their own uncached read | BC module service instance | adapter | derived, in memory | no | renewed with the shipment-read token | process lifetime | — |

Cardinality: a shipment has N lines; each item line has exactly one `TRCShipmentLine` row (BC's
key), found by shipment number + line number (`lineNo` = v2.0 `sequence` = notice `bc_line_number`).

## 6. Business rules as state tables [High]

Tracking row (`shipment_tracking`), per due check of a current, enabled shipment. Actor: the poll
job; no user is recorded.

| State | Event | Outcome | Side effects on other rows and runs |
|---|---|---|---|
| open, due | both reads succeed, all item lines have a row, hash differs | notice stored (`shipped`/`revised`/`cancelled`) with `variant_code` on every line; rescheduled or closed as today | new `shipment_notice` row; poll state `last_sequence` |
| open, due | both reads succeed, hash equals the latest stored (incl. revisions stored before the release) | nothing stored, rescheduled (B2) | none |
| open, due | an undo correction's variant differs from the line it would undo | failed `unpairable` (B3), backs off | none |
| `Critical` open, due | an item line has no `TRCShipmentLine` row (B4) | failed `variant_missing`, backs off; other shipments in the batch unaffected | none; logged with shipment and BC order number and BC line number |
| open, due | size read or its company read throttled (429/503) | row untouched, stays due (B5) | run stops BC reads; poll state `bc_backoff_until` set, as today |
| open, due | size read fails otherwise (status, timeout, malformed body, foreign next link) | failed `bc_error` for every row of the batch (B5), backs off | none |
| open, due | deadline before the size read starts | row untouched, stays due | run ends its checks |
| open, failed 3 days past window and reopen | any failure | closed `gave_up` (unchanged rule) | error log line |

Stored notice (`shipment_notice`): written once, never updated (B6). Read: line without
`variant_code` → served as null; with it → served as stored.

## 7. Security-property matrix [High]

No auth, personal data or payment change; access stays as today (B8).

| Property | Control | Trust root | Failure behaviour | Negative test |
|---|---|---|---|---|
| Bearer token only goes to BC | next link resolved and refused unless its origin is the configured BC origin | `BUSINESS_CENTRAL_DISCOVERY_URL` (hostname pinned to `api.businesscentral.dynamics.com`) | read throws, batch fails `bc_error`, no request to the foreign host | 01: a foreign next link is refused and never requested |
| No widening of what BC returns | GET only; `$select` of three fields; filter by shipment numbers already matched to an enabled company's order | our DB | — | 01: method is GET and `$select` is exactly the three fields |
| No OData filter injection | shipment numbers quoted with `'` doubled | — | — | 01: a number with a quote is escaped |
| No personal data or BC text in logs or `last_error` | codes and numbers only (`variant_missing` + BC line number) | — | — | 02: the failure's log line and `last_error` hold no BC response text |
| A missing size is never guessed | B4 fails the check | BC key | retried, eventually `gave_up` | 02: item line without a row → `variant_missing`, nothing stored |

## 8. Decisions [High for new, Medium for scope]

New in this plan:

- Adapter returns raw variant rows; join, B3 and B4 live in the L5 decision rule. Why: L2 holds no
  domain rule (`layers.md`), and a missing row fails one shipment, not 20. Source: Tier 0.
- New failure code `variant_missing` rather than reusing `unpairable` or `not_returned`. Why: the
  Admin page and logs then say what is wrong. Source: this plan.
- The size read runs per batch right after the shipment read, inside the same try/catch. Why: one
  failure path for B5; a deadline between the two leaves the rows due, which is today's rule.
- Company name read through the shipment request path and cached with the shipment-read token.
  Why: the existing `getCompanyName` has no timeout, deadline or throttling classification, and an
  uncached read would double the request count. Lowers the scope's "one per run" budget. Verified:
  `GET {discovery}/companies({id})` returns `name` (used in production by the return reads, and the
  scoper's probe).
- The stored-row payload type marks `variant_code` optional while the wire type requires it. Why:
  Tier 0 "a declared type matches the runtime value"; old rows lack the key.
- `variant_code` is a required, nullable key in the JSON Schema (as every other nullable field) and
  `minOccurs="0"` in the XSD. Why: the contract's existing null rule.
- Throttling of `TRCShipmentLine` (scope item): the design does not depend on what BC returns. Any
  non-2xx fails the check (B5); 429/503 additionally trigger the run's back-off. Not provoked in
  TestDK; Microsoft documents shared operational limits for API and ODataV4 requests.
- Framework check: Medusa has no capability for BC reads; nothing to reuse beyond the adapter's own
  shipment request path. No framework internal is called.

From the scope (agreed): field name `variant_code`; source `TRCShipmentLine`, verified in TestDK
and ProductionDK; no back-fill, old notices served with null and the cut-off documented; new schemas
published with no opt-in or versioning; size excluded from the content hash (B2); undo pairing
includes the variant (B3, verified on 12 TestDK pairs); missing row fails the check (B4); APIM and
Logic App need no change (NFR 5, confirmation in Needs your decision 2); artifacts in this case
folder, deployed by Klaus.

## 9. Framework assumptions [Medium; Critical while row 4 is UNVERIFIED]

| # | Primitive | Verified input → output → side effect | Evidence |
|---|---|---|---|
| 1 | `GET <env>/ODataV4/TRCShipmentLine?company='<name>'` | `$filter` on `documentNumber`, `$select=documentNumber,lineNo,variantCode` → `value[]` with string, number, string; empty string for no variant; no side effect | verified: `samples/bc-shipment-line-variant-testdk.md` §3–4, production §1 of `bc-shipment-line-variant-production.md` |
| 2 | Join key | `documentNumber` = v2.0 shipment `number`; `lineNo` = v2.0 `sequence`; one row per line | verified: TestDK §4, §5 (v2.0 agrees on all lines of three shipments) |
| 3 | `or` filter of 20 numbers | one request, 84 rows, no next link; unknown numbers return no rows | verified: TestDK §6 |
| 4 | `@odata.nextLink` with `Prefer: odata.maxpagesize` | page size honoured and a next link emitted: verified (TestDK §6). Next link on the same origin as the request: verified by Klaus (`samples/probe-trc-paging-output.md`) | Needs your decision 1 |
| 5 | Undo corrections carry the undone line's variant | 12 of 12 pairs | verified: TestDK §5 |
| 6 | `GET {discovery}/companies({id})` | → `{ name }` | verified: existing return reads, probe |
| 7 | 429/503 from BC | classified by status in our code; nothing else assumed | by design (see Decisions) |

## 10. Open risks and gates [Medium]

- Blocking: next-link origin (Needs your decision 1). Owner: Klaus.
- Non-blocking: deployed APIM policy and Logic App match the NIMBUS-130 files (Needs your decision 2).
  Owner: Klaus, at release.
- Non-blocking: the TRC extension's owner is unknown; if the service changes or disappears every
  check fails and backs off, then gives up after the window, until the read is moved (fallback:
  Nimbus publishes the standard Posted Sales Shipment Lines page). Owner: Klaus. Documented in
  task 04.
- Non-blocking: customers validating against the old closed schemas reject responses from the
  release on (B7). Owner: Klaus, who publishes the new schemas at release.
- Non-blocking: integration specs that spy on `getShipmentsByNumbers` must also stub the new read,
  or they would call TestDK for real. Owner: task 02 (listed in its Also update).
