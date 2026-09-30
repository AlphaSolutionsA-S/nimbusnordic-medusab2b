# Task 07: Revalidation and missing-key reporting

**Status:** IN PROGRESS (production builds and TC-7 refresh check pending; see Task 08)
**App:** backend + storefront
**App Roots:** apps/backend, apps/storefront
**Task ID:** 07
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-175 (from develop)
**Depends on:** 03, 06

## Environment

Reload backend/storefront skills and OWASP guidance. Node22 provides fetch,
AbortSignal.timeout, and node:crypto timingSafeEqual. Use Next15's single-argument
revalidateTag and `after` from `next/server` for request-lifetime server reporting.
Do not use middleware for cache invalidation. Test Node route handlers with Jest's
node environment where necessary; retain normal jsdom for client components.

## Backend callback

Create `apps/backend/src/utils/translations/revalidate-storefront.ts`:

```ts
import type { Logger } from '@medusajs/framework/types';
import type { RefreshInput } from '../../types/storefront-translation';
export async function revalidateStorefrontTranslations(
  input: RefreshInput, logger: Logger,
): Promise<'requested' | 'deferred'> {
  // IMPLEMENT: trusted configured URL only; HTTPS hosted/loopback HTTP local;
  // POST JSON, Bearer REVALIDATE_SECRET, redirect:'error', 3-second timeout.
  // Catch configuration/network/non2xx errors, log sanitized code/locale/version,
  // return deferred; never throw a network error into a committed mutation.
}
```

Add the call to every successful document mutation route from Task03, after its
workflow resolves/commits. Creation/inactive edits may return `not_needed`;
activation/deactivation and active saves/imports/resolutions must call it. Do not
couple locale-save success to event-bus/subscriber reliability or add history.

## Storefront files

Create `src/app/api/translations/revalidate/route.ts`:

```ts
import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { recordTranslationRefresh, translationCacheTag } from '@/lib/data/ui-translations';
export const runtime = 'nodejs';
export async function POST(request: NextRequest): Promise<NextResponse> {
  // IMPLEMENT: size <=2KiB, configured secret + constant-time length-safe check,
  // Zod-valid RefreshInput; ignore outdated callbacks using Task06 watermark.
  // record refresh then revalidate only this locale's tag; return {revalidated:true}.
}
```

Create `src/lib/i18n/missing-key-client.ts` (browser-safe):

```ts
import type { MissingReport } from '@/types/ui-translations';
export function enqueueMissingTranslation(report: MissingReport): void {
  // IMPLEMENT: bounded dedup/queue/timer from CONTRACTS.md; no network in render.
  // Flush same-origin JSON to /api/translations/missing after render or pagehide.
}
export function flushMissingTranslations(): Promise<void> {
  // IMPLEMENT: best effort; handle rejected promise; avoid retry storms/recursion.
}
```

Create `src/lib/i18n/missing-key-server.ts` (server-only):

```ts
import 'server-only';
import { after } from 'next/server';
import type { MissingReport } from '@/types/ui-translations';
export function reportMissingTranslation(report: MissingReport): void {
  // IMPLEMENT: sanitize, dedup, structured warning, schedule bounded forwarding
  // with after(), not an unhandled fire-and-forget promise during server rendering.
}
export async function forwardMissingTranslations(reports: MissingReport[]): Promise<void> {
  // IMPLEMENT: server-only SDK client (debug:false), internal report endpoint,
  // Bearer TRANSLATION_REPORT_SECRET, timeout; handle/log failures without recursion.
}
```

Use a server-only Medusa SDK client for secret-bearing reports with backend URL from
existing environment configuration and `debug:false`. This avoids exposing the
secret through browser imports or development request diagnostics. This client
is distinct from public translation reads using the normal storefront SDK.

Create `src/lib/i18n/missing-key-validation.ts` with browser/server-neutral report
types and a Zod3 schema for CONTRACTS.md's bounds. Export
`sanitizeTranslationPagePath(path: string): string`, normalizing to a local route
template and stripping query/hash/dynamic order/customer/quote identifiers; unknown
paths become a neutral bounded placeholder. No client can nominate a callback URL.

Create `src/app/api/translations/missing/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { forwardMissingTranslations } from '@/lib/i18n/missing-key-server';
export const runtime = 'nodejs';
export async function POST(request: NextRequest): Promise<NextResponse> {
  // IMPLEMENT: origin/content-type/byte limit, bounded streaming body read,
  // schema + supported locale, trusted-IP/global limiter, sanitize and dedup,
  // structured warning then await bounded forwarding; 202 accepted or 429 limited.
}
```

Do not trust Content-Length as the only size check: count streamed bytes, stop at
32 KiB, then JSON parse. A claimed same-origin header is only defense-in-depth,
not authentication. Apply the DB-side capacity/race protections from Task02.
Every reporting failure must be swallowed at this telemetry boundary with a safe
diagnostic; it must not fail storefront rendering or call itself recursively.

## Wire existing runtime

- `src/i18n/request.ts`: provide sanitized route context from a trusted middleware
  request header and wire handler's onMissing into server reporting. Emit one
  locale_unavailable report for unavailable state; suppress key reports then.
- `src/middleware.ts`: overwrite `X-STOREFRONT-PATHNAME` from `request.nextUrl.pathname`
  alongside the existing locale header before NextResponse.next. Never trust an
  incoming value or forward query strings. Preserve preview/cart/redirect logic.
  Paths not routed through this middleware use a safe unknown/root404 context.
- Task06 TranslationProvider: use `usePathname`, call enqueue from missing-key
  callback, and emit a single unavailable-locale event after mount. Use path
  sanitization and dedup; do not log interpolation variables or update React state
  during another component's render.
- `apps/backend/.env.template`, `apps/storefront/.env.template`: document the new
  env names with empty placeholders, never an actual shared secret. Extend the
  i18n README/runbook with generation and rotation steps; no live env edits here.

## Tests

Backend: `src/utils/translations/__tests__/revalidate-storefront.unit.spec.ts` and
the Task03 HTTP suite. Storefront:
`src/__tests__/app/api/translations/revalidate.test.ts`, `missing.test.ts`, and
`src/__tests__/lib/i18n/missing-key-{client,server}.test.ts`. Use fake timers for
queue/rate-limit tests. Mock only network and framework scheduling boundaries.

- **TC-1:** Given absent/wrong secret or invalid locale/body, when invoking refresh,
  then no tag is invalidated. Valid refresh invalidates only the selected locale;
  an old callback cannot overwrite a newer activation decision.
- **TC-2:** Given successful DB save and callback timeout/non2xx, then the Admin
  response still succeeds, persisted version increments once, refresh is deferred,
  and logs omit secret/URL credentials/payload.
- **TC-3:** Given repeated server/client misses and a dynamic status key, then raw
  full keys render; reports batch/dedup without parsing error prose or flooding.
  Locale-wide outage produces one typed event, not hundreds of entries.
- **TC-4:** Given forged origin, unsupported locale, oversized chunked body, excess
  batch, or rate exceeded, then reject/drop before forwarding. A report storm stays
  bounded in memory and PostgreSQL; browser bundles contain no report secret.
- **TC-5:** Given reporting backend outage, then page rendering is successful and
  the failure diagnostic does not recursively report another missing key.
- **TC-6:** Given sensitive query parameters and order/customer IDs, then stored
  and logged paths use sanitized templates, without those values.
- **TC-7:** Given import/save/activation on a populated locale, then next request
  observes refresh and a simulated lost callback recovers through timed refresh.

Run focused suites and both production builds. Keep proxy trust and per-process
rate-limit limitations explicit in rollout documentation rather than claiming
global rate limiting from an in-memory map.
