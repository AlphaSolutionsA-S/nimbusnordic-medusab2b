# NIMBUS-175 implementation contracts

Draft contracts shared by tasks 01-08. Proposed limits and fallback semantics are
subject to review with PLAN.md. Paths below are relative to the repository root.

## Types

Create `apps/backend/src/types/storefront-translation.ts`. Admin imports it with
`import type`; Task 06 mirrors the public/read/report subset in
`apps/storefront/src/types/ui-translations.ts`. Do not import backend runtime code
or its Zod 4 schemas into the Zod 3 storefront bundle.

```ts
export interface MessageDocument {
  [segment: string]: string | MessageDocument;
}
export interface LocaleSummary {
  id: string;
  locale: string;
  version: number;
  is_active: boolean;
  updated_at: string;
}
export interface TranslationDocument extends LocaleSummary {
  messages: MessageDocument;
}
export interface IcuWarning {
  key: string;
  code: 'invalid_icu' | 'arguments' | 'structure' | 'reference_unavailable';
  message: string;
}
export interface DocumentDiff {
  added: string[];
  changed: string[];
  removed: string[];
  empty: string[];
}
export interface ImportInput {
  locale: string;
  expected_version: number | null;
  mode: 'merge' | 'replace';
  messages: MessageDocument;
  confirm_removed: boolean;
}
export type CreateInput = {
  locale: string;
} & (
  | { source: 'copy'; source_locale: string; source_version: number }
  | { source: 'import'; messages: MessageDocument }
);
export type MutationInput =
  | { operation: 'create'; input: CreateInput }
  | { operation: 'save'; locale: string; expected_version: number; messages: MessageDocument }
  | { operation: 'import'; input: ImportInput }
  | { operation: 'activate'; locale: string; expected_version: number; is_active: boolean }
  | { operation: 'resolve'; locale: string; expected_version: number; missing_id: string; value: string };
export interface MutationResult {
  translation: TranslationDocument;
  warnings: IcuWarning[];
}
export interface MutationResponse extends MutationResult {
  refresh: 'not_needed' | 'requested' | 'deferred';
}
export interface PreviewResponse {
  locale: string;
  expected_version: number | null;
  mode: 'merge' | 'replace';
  diff: DocumentDiff;
  warnings: IcuWarning[];
}
export type MissingReport = {
  locale: string;
  page_path: string;
} & (
  | { kind: 'key'; key: string }
  | { kind: 'locale_unavailable' }
);
export interface MissingKeyRecord {
  id: string;
  locale: string;
  key: string;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
  last_page_path: string;
  dismissed: boolean;
}
export interface RefreshInput {
  locale: string;
  version: number;
  is_active: boolean;
}
```

Use UTC ISO strings in wire DTOs; explicitly map ORM dates. `expected_version`
is a positive integer; null means create-if-absent and is allowed only for import.
The initial version is 1. There is no revision history or audit actor field.

`flattenMessages` represents string leaves only; it does not represent empty object
groups and must not be used to rebuild a complete persisted document. Normal Admin
edits apply the edited leaf values to the original validated `MessageDocument`,
preserving empty groups and the rest of the document structure.

## Validation and limits

- Canonical locale: `Intl.getCanonicalLocales(value)` must return exactly one
  locale; reject non-string, whitespace, slashes, and >64 characters. Use the
  returned value consistently for DB uniqueness, URL encoding, and cache keys.
- Document: plain nested objects, string leaves only; reject arrays/null/numbers,
  dotted or empty key segments, and `__proto__`, `prototype`, `constructor` at
  any depth. Inspect own keys safely. Preserve empty strings; do not trim values.
- Proposed caps: 512 KiB UTF-8 serialized document, 5,000 leaves, depth 12,
  16 KiB per string, 128 characters per key segment, 512 per full key path.
  HTTP admin JSON body cap 1 MiB accounts for import envelopes. Check decoded
  document size independently. Client file size checks supplement server checks.
- Import structural conflicts (`A` string versus `A.B`) are explicit validation
  errors for merge; replace may replace the structure after a removal preview.
  Removal confirmation counts text leaves only: a replace that drops only empty
  groups removes no texts and applies without `confirm_removed`.
- Reporting: 50 records / 32 KiB body; 512 characters per sanitized path;
  2,500 distinct records per locale and 20,000 globally, including dismissed
  markers. Enforce database caps transactionally, not with an in-memory counter.
  Accept individual key reports only for provisioned locales and absent/empty
  string values. Locale-unavailable events may describe a missing row.
- Reserve `__locale_unavailable__` as a database key for a typed outage report;
  reject that segment in ordinary message documents and individual key reports.
  It is shown as an outage notice, never an editable translation key. A successful
  import/activation clears the notice. The Admin inbox can list reports for an
  unprovisioned locale so a first-import failure remains visible.
- Browser route only accepts a locale in `SUPPORTED_LOCALES`, strips query/hash,
  masks dynamic customer/order/quote identifiers to route-template placeholders,
  and limits keys to the valid format. Never accept interpolation values, messages,
  names, tokens, or arbitrary URLs in reporting payloads.
- Proposed browser queue: 50 entries; flush after 2 seconds or on pagehide using
  keepalive; deduplicate locale/key for 5 minutes, capped at 1,000 entries.
  Server dedup maps also expire after 5 minutes and cap at 1,000 entries.
- Public report route: same-origin JSON POST, 30 requests/minute per trusted
  client identifier and 300/minute process-wide. If trusted proxy identification
  is unavailable, the global limiter is mandatory; never trust arbitrary forwarded
  headers. These process-local limits supplement authoritative DB cardinality caps.

## API surface

All admin paths start `/admin/ui-translations`; framework admin authentication
must remain enabled. Validate bodies with Zod and `validateAndTransformBody`.
Do not rely on a company employee role for any of these routes.

| Method and suffix | Input | Response / semantics |
| --- | --- | --- |
| GET `/` | None | `{ locales: LocaleSummary[] }`; exclude document bodies |
| POST `/` | `CreateInput` | 201 `MutationResponse`; always inactive |
| GET `/:locale` | Canonical locale | `{ translation: TranslationDocument }` |
| POST `/:locale` | `{ expected_version, messages }` | `MutationResponse`; existing key set only |
| POST `/:locale/import-preview` | `{ expected_version, mode, messages }` | `PreviewResponse`; no writes |
| POST `/:locale/import` | `ImportInput` without locale | `MutationResponse`; 201 when created, otherwise 200 |
| POST `/:locale/activation` | `{ expected_version, is_active }` | `MutationResponse`; version increments |
| GET `/:locale/export` | None | Messages only, JSON attachment named from canonical locale |
| GET `/missing-keys` | Optional locale, offset, limit <=100 | `{ missing_keys, count, offset, limit }`; includes unprovisioned outage notices |
| POST `/:locale/missing-keys/:id/resolve` | `{ expected_version, value }` | `MutationResponse`; ID must match locale and be a real missing key |
| POST `/:locale/missing-keys/:id/dismiss` | Empty object | 200 `{ dismissed: true }`; locale-scoped ID check |

Use 400 for invalid structure/confirmation, 401/403 for authentication, 404 for
absent entities, 409 for stale version/duplicate creation, 413 for parser-size
limits, and 429 for reporting limits. Preserve the configured framework error
handler; do not return database or integration error details to clients.

`GET /store/ui-translations/:locale`: requires a publishable API key, no customer
login. 200 `{ translation: TranslationDocument }` for active rows only; never
exposes reports. 404 codes `translation_not_found` / `translation_inactive` allow
the storefront to distinguish an outage fallback from intentional deactivation.
Set both `code` and `message` to that stable token: the installed Medusa SDK keeps
`status` and `message` on FetchError but discards other response-body properties.
Do not parse prose error messages. Do not HTTP-cache error responses. The storefront
may cache a recognized inactive result as an explicit tombstone, so background refresh
can replace an old active document; network/absent results are never tombstones.
Next's server Data Cache owns the normal 300-second cache;
do not add a second long CDN TTL that defeats the callback.

`POST /internal/ui-translations/missing-keys`: `{ reports: MissingReport[] }`;
requires `Authorization: Bearer <TRANSLATION_REPORT_SECRET>` from the storefront
server. Missing secret configuration fails closed. Valid batches return 202
`{ accepted, ignored }`; report errors never recurse through the reporting system.

Storefront routes (new, Node runtime, already excluded by middleware `/api` matcher):

- `POST /api/translations/revalidate`: `RefreshInput`, Bearer `REVALIDATE_SECRET`;
  validate before calling `revalidateTag('ui-translations:' + locale)`. Do not
  expose a generic user-supplied tag/URL invalidation interface.
- `POST /api/translations/missing`: `{ reports: MissingReport[] }`; public,
  bounded, same-origin browser ingestion. No shared secret in the browser bundle.

## Persistence ordering

Every document mutation and missing-report operation takes the same PostgreSQL
transaction-level advisory lock derived from a namespaced canonical locale.
This coordinates report resolution, import creation, and capacity checks across
processes; it does not replace version compare-and-swap. Global capacity checks
also take one reporting-cap lock in a consistent order (global, then locale).
Document-only mutations need only the locale lock. Dismissal is serialized too.

Dismissal sets `dismissed=true`; repeat reports do not reopen or update a dismissed
entry. A nonempty value removes its record; a future removal and real miss may
create a new report. Reports racing a save must recheck the current document
inside the lock, so a delayed report cannot resurrect a resolved key.

Backend callback env: `STOREFRONT_TRANSLATION_REVALIDATE_URL`, `REVALIDATE_SECRET`.
Report env on both apps: `TRANSLATION_REPORT_SECRET` (separate secret). Configure
through the existing Medusa Cloud workflow during rollout, not during planning.
Use HTTPS for hosted callbacks; loopback HTTP is allowed in local validation.
Reject redirects, use a 3-second timeout, and never log credentials or raw payloads.
