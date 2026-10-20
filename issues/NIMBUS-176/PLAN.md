# NIMBUS-176: Manage country languages from Admin

**Status:** Approved by Klaus Petersen on 2026-10-20; Region Query evidence verified; ready for dispatch handoff · **Base:** develop · **Scope:** approved SCOPE.md

## Summary [High]

Keep country assignments in the existing storefront translation module, expose validated Admin operations and a public publication, and let the storefront consume that publication without deployment. A versioned configuration document and database transactions protect assignment/deactivation races. The server resolves a single publication per request; middleware supplies country context instead of maintaining a second language decision.

How to review this plan: approving this document permits dispatch readiness, after its evidence gates are resolved; implementation still requires a separate handoff. Answer the Critical section, then read the High sections closely, especially data ownership, retention, state side effects, security and new decisions. Task files contain optional depth. Questions in chat are often faster than reading further. This plan and its task files fit the approximate 100-lines-per-task budget.

## Needs your decision [Critical]

- Removed-country assignments must not trap an administrator behind an undeactivatable language. May the Admin list also show retained assignments and permit reassignment of those existing entries, while refusing creation for unconfigured countries? **Answer:** yes, approved by Klaus Petersen on 2026-10-20; retained entries still block deactivation until explicitly reassigned.
- **Evidence gate resolved:** Klaus ran the read-only script against the configured running backend's database and supplied passing output on 2026-10-20. Region IDs and countries.iso_2 are strings; countries is an array. One region returned nine lowercase alpha-2 codes, and an unknown region returned []. See samples/region-query-verification.json and apps/backend/scripts/verify-region-query.ts. Country removal/re-addition was not exercised; that new assignment lifecycle remains an implementation integration-test obligation, rather than evidence of the existing projection's shape.

## Flows [High]

### A. Prepare a safe rollout (01, 02, 05)
1. Generate and apply the new module migration in local/test; the schema alone changes no language activation or country availability.
2. A dry-run bootstrap reports currently configured legacy assignments and every missing/inactive required language, including English. An explicit apply validates all prerequisites again and atomically inserts the configuration only when absent.
3. Bootstrap records existing configured-country languages; other configured countries use English. Repeating it never overwrites Admin edits or silently activates languages.
4. Read back stored assignments and publication before deploying the storefront consumer. A missing configuration or broken active-language invariant returns unavailable, allowing the agreed cold-start behavior rather than publishing a misleading default-only map.

### B. Admin changes an assignment (01, 02, 03)
1. An authenticated Admin user opens the Translations country-language view. It lists configured countries and effective/default languages, plus retained assignments in a separate section.
2. The Admin edits one country using existing active languages, submitting the configuration version loaded with the form. Bodies are bounded to 1 KiB and tags to 64 characters.
3. A workflow checks current Region membership for new entries. The translation service serializes the configuration change and activation checks in the database, validates the active target and expected version, and commits once.
4. A stale version returns conflict; invalid input or inactive language leaves the document unchanged. The UI displays the failure and reload option without pretending the submitted value was saved.
5. On success, list and language queries refresh. Existing pages stay open; subsequent fresh requests observe the assignment within five minutes under healthy operation.

### C. Language deactivation (01, 02, 03)
1. The existing activation action enters the same database critical section as assignment saves.
2. English deactivation is refused. Deactivation of another language is refused while any configured or retained explicit assignment references it, with sorted country codes in the response message.
3. After the Admin explicitly reassigns those entries, deactivation succeeds with the existing language version semantics and refresh notification. No assignment changes implicitly.

### D. Storefront render and outage (04, 05)
1. Middleware removes incoming locale/country context and writes the URL-derived country and sanitized-path context. Existing country routing, URLs and commerce selection stay in place.
2. A server-only loader retrieves the complete published mapping, validates its structure and memoizes one snapshot for the request. Request configuration, layouts, metadata, switcher labels and translation-refresh actions consume that verdict.
3. Each worker reuses a successful snapshot for at most 240 seconds, then waits for a fresh bounded read with a three-second timeout. Refreshes share one in-flight read; failures are never cached as successful empty maps, and failed refreshes retry after at most ten seconds.
4. During failure a worker serves its last successful mapping for its remaining process lifetime. Without one it uses the agreed legacy country map. Workers restart by reading persistent backend configuration; outage snapshots are neither shared nor durable across restarts.
5. Locale and messages reach client components through the translation provider. Missing-text reports accept canonical tags dynamically while keeping all existing size, sanitation, rate and dedup bounds.
6. Formatting preserves today's eight tags and uses valid new canonical language tags directly. Alternate links use distinct language-region tags for configured countries, without changing region currency or URL paths.

## What gets built [High]

### 01. Configuration persistence and integrity
A model and generated migration (L0) add one configuration document to the existing translation module. Transactional service methods (L1) perform bootstrap, versioned assignment updates, publication reads and the assignment/deactivation invariant on their own tables. The document contains explicit assignments only; absent keys mean the English default. The existing activation operation acquires the shared configuration critical section before its locale lock. No new module, external adapter, cross-module foreign key or process lock is introduced.

### 02. Workflows, contracts and bootstrap
Steps and workflows (L3/L4) compose narrow Region membership reads with configuration operations. Thin validated routes (L6) expose the Admin list/save and public publication; the touched activation route moves onto the existing mutation workflow if needed. An idempotent operator script invokes the bootstrap workflow, defaulting to dry-run. The Admin list distinguishes current Region membership from retained keys. Public output is limited to effective configured-country assignments and the default; it contains no actor or history. Protected routes explicitly require user sessions and preserve framework MFA behavior. JSON-only mutations reuse framework cookie/CORS protection and reject simple form content types.

### 03. Country-language management in Translations
Admin UI and SDK/TanStack hooks add the country list, edit interaction, default indication and retained section. Selection scales from Select to searchable table selection for larger active-language lists. Loading, pending, errors, conflicts and deactivation feedback remain visible and keyboard accessible. Mutation completion refreshes both mapping and relevant language display queries. The implementation follows the Admin skill's forms, data-loading and display references.

### 04. One runtime publication across storefront consumers
A server-only data loader (S2) uses the existing SDK transport (S0), bounded blocking TTL and request memoization. A pure validator/lookup helper (S1) separates contract interpretation from I/O; business defaults remain backend-owned except the explicitly approved outage fallback. Middleware forwards country context and deletes the old locale header; request configuration and route/server components (S3) resolve the shared snapshot. Feature components (S4), including country switching, receive published labels as props. Dynamic tag acceptance replaces the eight-language runtime gates; database message loading and its cache remain intact. Workers reload storefront skills and relevant backend-connection/design references before changing components.

### 05. Formatting, alternate links and operational verification
Pure formatting/SEO helpers (S1) preserve existing outputs while handling dynamic tags and same-language countries without overwritten alternate links; server metadata consumers receive the request snapshot. Behaviour and browser integration coverage proves a ninth language works end to end. Current translation documentation, the architecture rule registry and a new country-language architecture page describe the deployed design and staged rollout; frozen NIMBUS-175 records remain untouched. The rollout checklist includes explicit readbacks of the stored map, public publication and rendered page after an Admin save.

## Data model [High]

One country has one key in the assignments object; many keys can reference one existing language. There is one live configuration document, at most 676 two-letter keys and 64 KiB of canonical JSON. Configuration values are non-sensitive and require no new field encryption. Existing database-at-rest controls apply.

| Entity / field | Key, meaning and existing callers | Owner / writer | Stored or derived; encryption | Mutable until; retention / deletion | Index |
|---|---|---|---|---|---|
| Region country catalogue | Existing region ID and countries.iso_2; current routing, regions loader and switcher | Medusa Region; existing region management | Existing stored catalogue; no new encryption | Existing Region lifecycle and deletion | Existing core indexes |
| Translation locale / is_active / version | Existing canonical BCP 47 key, publication flag and CAS; editor, runtime loader, reporting | storefrontTranslation; existing Admin workflow | Existing stored; no new encryption | Existing language lifecycle; this story adds no delete operation | Existing unique live locale |
| country_language_configuration.id | Fixed singleton identifier; no existing callers | storefrontTranslation; bootstrap only | Stored text primary key; no | Immutable; retain indefinitely, no automatic deletion | Primary key enforces one named singleton |
| assignments | Lowercase country code to canonical existing locale; no existing callers | Same module; bootstrap and authenticated Admin workflow | Stored JSON, validated references within the same module; no | Admin may reassign; retain removed-country keys indefinitely, no automatic deletion or history | No JSON index needed for a bounded singleton scan |
| version | Positive global CAS counter, starts at 1; no existing callers | Same module; successful assignment save only | Stored number; no | Increment on each accepted assignment save; previous values discarded | Singleton lookup, no separate index |
| created_at / updated_at / deleted_at | Framework timestamps; no existing callers | Same module / framework | Stored Date / nullable Date; no | Updated per write; document has no exposed deletion, retained indefinitely | Framework defaults |
| effective country / locale / source | Configured-country publication; source is explicit or default | Backend workflow and module publication rule | Derived; no | Current Region membership and committed map; snapshots expire for freshness, LKG survives only its process | None |
| configuration version and availability in Admin/read loader | Loaded CAS value; available, stale or legacy fallback state | Server loader / Admin SDK response | Derived or process-local; no | Current form or request; no durable history | None |
| acting Admin | Existing signed session context, never request body | Existing platform auth; no new actor storage | Existing auth context only; no new personal-data column | Existing session expiry/logout policy | Existing platform |

## Business rules as state tables [High]

| Current state | Event / precondition | Outcome | Side effects on rows and sessions | Writer / recorded actor |
|---|---|---|---|---|
| Configuration absent | Bootstrap apply, all current legacy targets and English exist and active | Insert singleton, version 1 | No language activation; publication becomes available | Operator workflow; no new actor history |
| Configuration present | Bootstrap repeated | No overwrite | Existing assignments/version unchanged | Operator; none newly recorded |
| Configured country without key | Publication read | English, source default | No write | Backend derived |
| Configured country, current version | Save existing active locale | Insert/replace key, version +1 | Other countries unchanged; existing pages/sessions not reloaded | Session-authenticated Admin; existing auth context only |
| Retained country with key | Explicit reassignment, current version | Replace existing key, version +1 | Approved retained-edit rule; never creates an unconfigured entry | Session-authenticated Admin |
| Unconfigured country without key | Save | Refused | Entire prior configuration retained | Backend |
| Any assignment | Stale version, missing/inactive locale, malformed input | Refused | No partial write or version bump | Backend |
| Country configured with a key | Country removed from Region | Key retained, absent from public publication | Still blocks referenced-language deactivation | Existing region writer; no configuration write |
| Retained key | Country re-added | Reuse explicit locale, which must still be active | No configuration write; invalid invariant fails publication closed | Existing region writer |
| Active English | Deactivate | Refused always while English is the default | No language-version change | Session-authenticated Admin |
| Active language with any explicit references | Deactivate | Refused, affected countries listed | Retained keys count; no automatic reassignment | Session-authenticated Admin |
| Active unreferenced non-English language | Deactivate, current language version | Existing activation mutation succeeds | Existing message refresh behavior; no session invalidation | Session-authenticated Admin |
| Concurrent save / save or save / deactivate | Both contend on configuration transaction lock | One serial order, stale CAS or inactive-target rejection as applicable | No inactive assigned locale, across independent service instances | Backend database transaction |
| Fresh snapshot / stale snapshot / no snapshot | Refresh succeeds / fails | New snapshot / last good / legacy fallback | No DB mutation; no forced reload | Each storefront worker |

## Security-property matrix [Critical]

| Property | Control | Trust root / signed? | Failure behavior | Negative test and task |
|---|---|---|---|---|
| Admin trust anchor | Explicit user session authentication on list/save and touched activation | Framework session cookie signed with cookie secret, server session auth_context | 401; no mutation | Anonymous, customer session, secret API key and bearer-only requests rejected; 02 |
| Replay / competing edits | Validate global expected_version inside transaction; existing language CAS retained | Shared Postgres, not a submitted actor | 409 for stale write; old document retained | Repeat same write and overlapping stale forms; 01/02 |
| Cross-instance integrity | Database configuration transaction lock before locale lock on save/activation/bootstrap | Shared database transaction, no process mutex | Serializes or bounded timeout with rollback | Independent connections/services race assignment with deactivation in both orders; 01 |
| Browser binding / CSRF | Framework SameSite=Lax, Secure cookies in production/staging plus strict application/json bodies and configured CORS preflight | Browser cookie and same-origin policy; signed session remains required | Foreign page cannot submit an authenticated mutation | Form/text/plain requests refused; real browser foreign-origin fetch/preflight and form fail to change map; 02/05 |
| Logout and expiry | Session-only routes; framework session destruction / expiry | Current server-side session | Logged-out or expired session rejected | Reuse captured session cookie after logout/expiry; 02 |
| Session cross-instance limits | Reuse existing configured session store; no new auth subsystem | Existing deployment session store | Missing session on another worker gives 401, never anonymous write | Missing-session request fails closed; 02. Global logout not claimed with local session storage |
| Public read minimization | Explicit publication DTO, configured-country verdicts only | Server-generated DB-backed result | No Admin version/history/identity or unconfigured-country records leaked | Assert exact exposed field names/types and absent sensitive fields; 02 |
| Personal data on failure | Existing concise structured logging; no body/cookie/actor logging | Server logging controls | Generic validation/unavailable response, no credential echo | Malformed payload/session content absent from errors and captured logs; 02 |
| Untrusted locale/path inputs | Canonical bounded tags, strict schemas, existing missing-key sanitation/caps; refresh accepts published countries only | Backend publication, not client locale header | Invalid response rejected; no arbitrary cache tags or report expansion | Forged locale header, malformed tags/unknown country/oversized report; 04 |

## Decisions [High for new; Medium for approved scope]

### New in this plan
- Store one versioned JSON map in the existing module instead of a table per country: bounded data, one CAS, no new module or cross-module relationship. Sources: current service transaction pattern and module/data checklist.
- Serialize bootstrap, mapping writes and activation on a configuration transaction lock, then existing locale lock. Use database lock/statement timeouts and rollback; advisory transaction locks release with the transaction rather than requiring an application TTL. Existing primitives verified; new race behavior is an implementation integration-test obligation.
- A missing configuration fails publication rather than silently replacing legacy countries with default English; bootstrap is an explicit gate before storefront rollout.
- Move locale selection into one server request snapshot; middleware keeps country-routing responsibility and removes the old locale header. This avoids independent Edge/server caches choosing different languages. Installed next-intl request-config behavior verified from current integration and installed implementation; no custom framework internal is called.
- Use 240-second blocking freshness, three-second read timeout and at-most-ten-second failure backoff. Persistent truth is Postgres; process LKG has no maximum age during an outage and is lost at restart. This leaves room inside the five-minute healthy bound without Next stale-while-revalidate assumptions.
- Session-only management endpoints exclude bearer and secret-key authentication and align browser logout with the requested Admin identity. Reuse existing SameSite cookie protection and require JSON; do not promise cross-worker sessions/global logout beyond the existing session store. Verified installed auth/session source listed below.
- Preserve formatting tags da-DK, en-GB, sv-SE, nb-NO, pl-PL, it-IT, fr-FR, de-DE. For new valid tags use the canonical tag; preserve script/region subtags. Structurally valid tags can use Intl's normal fallback if the host lacks their locale data; no new translation-completeness gate.
- Use locale language/script plus URL country for hreflang country variants, replacing a tag's existing region rather than appending a second region. Preserve meaningful variants; exclude Unicode/private formatting extensions from hreflang. This avoids shared-language collisions while retaining each configured URL.
- OOTB first: checked core Region workflows (create/update/delete) and Medusa Translation workflows. They do not manage this custom UI-language/country policy or our existing translation module. Reuse public workflow/Query and module transaction facilities; no framework internal helper is called, and no core computed entity read is introduced. Narrow Region membership is an explicit existence/scope-check exemption.

### From the scope
- One language per country, active languages only, English default, configured Region countries only for new assignments (B1–B5).
- Retain removed-country entries, block referenced-language deactivation, keep English active; no automatic reassignment (B5–B6).
- Five-minute healthy convergence, no forced reload, process last good or legacy cold fallback (B7–B8).
- Preserve formatting and commercial currency; no picker, formatting editor, CMS translation or new audit-history UI (B9 and out of scope).

## Framework assumptions and evidence

Paths below are repository-relative. Installed code, not copied skill signatures, is the evidence for security claims.

| Primitive | Input → output / side effects checked | Evidence and status |
|---|---|---|
| Medusa module service transaction decorators | Optional context → fresh manager or reused transaction; failure rolls back repository transaction | **Verified:** node_modules/@medusajs/utils/dist/modules-sdk/decorators/inject-{manager,transaction-manager}.js; inspected actual branches for provided/missing transaction context |
| Existing translation lock and CAS | Locale and current version → one atomic write; repeated stale version conflicts | **Verified primitive:** apps/backend/src/modules/storefront-translation/service.ts and real-PG module spec coverage. New independent-instance assignment/deactivation race remains required test intent, not a claim of completed verification |
| Region Query projection | Narrow region IDs and countries.iso_2 → current configured catalogue; no mutation or computed business fields | **Verified from user-executed probe, 2026-10-20:** samples/region-query-verification.json records one region, nine country codes, asserted string/array types, empty unknown-region result and zero mutations. Country removal/re-addition remains required implementation coverage, not a completed probe claim |
| Explicit session authentication and MFA | User session → registered user context; no customer, API-key or bearer fallback when only session is allowed | **Verified:** apps/backend/node_modules/@medusajs/framework/dist/http/middlewares/authenticate-middleware.js; actor/auth-method checks, missing input and MFA branches inspected |
| Session cookie and logout | Session cookie → stored context; logout destroys session and clears cookie; absent external store remains process-local | **Verified:** framework/dist/http/express-loader.js and medusa/dist/api/auth/session/route.js under the preceding installed prefix; no medusa-config.ts cookie override found |
| SDK custom request transport | Custom path + plain object / no-store timeout init → serialized JSON request, response or error | **Verified:** existing Admin hooks/client and storefront translation loader; use public SDK only, existing project usage confirmed by source. Worker checks installed SDK if changing transport options |
| Request configuration and shared loader | Middleware-overwritten country context → server configuration locale/messages; request memoization shares one promise | **Verified existing mechanisms:** src/i18n/request.ts, src/lib/data/ui-translations.ts and country layout. Changed country-resolution wiring has explicit browser integration coverage in 04/05 |
| Migration generation | Added model → generated schema migration and snapshot; apply once | **Verified supported interface:** existing module model/migrations and Medusa module documentation. Generate with db:generate storefrontTranslation, apply db:migrate; never hand-write schema SQL |

## Open risks and gates [Critical for blockers]

- **Resolved, user:** plan and retained-entry edit rule approved on 2026-10-20. Jira child tasks NIMBUS-194–198 represent the five deliverables. Approval does not start implementation.
- **Resolved, planner:** user-executed Region Query probe passed; output is preserved in samples/region-query-verification.json. Separate dispatcher handoff authorization remains required.
- **Blocking, implementation verification:** new lock/CAS races, auth/browser negatives and ninth-language runtime checks must pass before branch handoff; workers own the tests and dispatcher runs final integration/build checks.
- **Blocking, release operator:** apply migration, run bootstrap prerequisite report, deliberately fix any absent/inactive target languages, apply bootstrap and read back publication before enabling the storefront consumer. This is an explicit ordered release gate, not a promise of delivery.
- **Non-blocking, deployment owner:** inherited process-local session storage can produce authentication misses across workers; this story does not add a global session store. Assignment integrity remains database-backed.
- **Non-blocking, deployment owner:** outage last-good maps may differ between workers and disappear at restart. Documented legacy cold fallback is intentional; backend DB preserves configuration through restarts.
- **Non-blocking, reviewer:** a competing-model review is recommended because this plan touches protected mutations and authentication controls. It is optional and separate from plan approval.
- Guardrails: no app source cross-imports, manual migrations, process locks for integrity, client company/auth changes, pricing/currency edits, runtime messages JSON imports, or edits to frozen cases.

Architecture review completed against Tier 0 and the medusa-backend, medusa-module-and-data, medusa-workflow-and-steps, medusa-api-route, medusa-admin, medusa-storefront, nextjs-data-layer, storefront-best-practices and secure-coding-owasp checklists. The design satisfies the layer and ownership checks, and the real-data Region projection check passed. Implementation tests and deployed-feature verification remain outstanding.
