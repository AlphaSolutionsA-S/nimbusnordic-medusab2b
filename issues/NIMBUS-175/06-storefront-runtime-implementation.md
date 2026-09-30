# Task 06: Storefront runtime source, cache, and fallback

**Status:** IN PROGRESS (production build pending a reachable backend; see Task 08)
**App:** storefront
**App Root:** apps/storefront
**Task ID:** 06
**Date:** 2026-09-30
**Branch:** feature/NIMBUS-175 (from develop)
**Depends on:** 03

## Environment

Load building-storefronts/references/frontend-integration.md and
storefront-best-practices references connecting-to-backend/design/medusa.
Next 15.5.18, React19, next-intl4; existing Jest is `jest.config.ts` with jsdom.
Use `src/lib/config.ts` SDK. Do not share backend Zod4 schemas into this app.

## New files and skeletons

`src/types/ui-translations.ts`: copy MessageDocument, TranslationDocument,
RefreshInput, and MissingReport contracts (and LocaleSummary needed by the DTO).
Add:

```ts
export interface RuntimeMessages {
  locale: string;
  messages: MessageDocument;
  availability: 'available' | 'unavailable' | 'inactive';
  version: number | null;
}
```

`src/lib/data/ui-translations.ts`:

```ts
import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { sdk } from '@/lib/config';
import type { RuntimeMessages, TranslationDocument } from '@/types/ui-translations';

export function translationCacheTag(locale: string): string {
  return `ui-translations:${locale}`;
}
type CachedRead =
  | { state: 'active'; translation: TranslationDocument }
  | { state: 'inactive'; locale: string };
async function readRuntimeDocument(locale: string): Promise<CachedRead> {
  // IMPLEMENT: sdk.client.fetch<{translation: TranslationDocument}>(
  //   `/store/ui-translations/${encodeURIComponent(locale)}`, {cache:'no-store'})
  // Validate response shape/locale/version before it can enter the cache.
  // Exact status404/message translation_inactive -> inactive tombstone.
  // All other failures throw and cannot become successful cache entries.
}
export const getRuntimeMessages = cache(async (locale: string): Promise<RuntimeMessages> => {
  // IMPLEMENT: canonicalize; stable per-locale unstable_cache key/tag, 300s TTL;
  // update bounded last-good snapshot only on valid active success.
  // Catch outside cached fetch. Existing snapshot -> raw keys, never files/English.
});
export function recordTranslationRefresh(input: {
  locale: string; version: number; is_active: boolean;
}): void {
  // IMPLEMENT: monotonic callback watermark; clear snapshot on confirmed inactive.
  // Do not let older callbacks or in-flight fetches reinstate older state.
}
```

`src/lib/i18n/translation-errors.ts` is browser-safe:

```ts
import { IntlErrorCode } from 'next-intl';
import type { ComponentProps } from 'react';
import type { NextIntlClientProvider } from 'next-intl';
type ProviderProps = ComponentProps<typeof NextIntlClientProvider>;
export function makeTranslationErrorHandlers(input: {
  available: boolean;
  onMissing: (key: string) => void;
  onFormattingError: (code: string) => void;
}): Pick<ProviderProps, 'onError' | 'getMessageFallback'> {
  // IMPLEMENT: getMessageFallback has namespace/key; join only nonempty parts.
  // MISSING_MESSAGE -> onMissing once and raw full key.
  // Other error -> formatting diagnostic without interpolation values, raw key.
  // Whole-locale unavailable suppresses per-key reporting entirely.
}
```

`src/modules/common/components/translation-provider/TranslationProvider.tsx`:

```tsx
'use client';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import type { MessageDocument } from '@/types/ui-translations';
import { makeTranslationErrorHandlers } from '@/lib/i18n/translation-errors';
export interface TranslationProviderProps {
  locale: string;
  messages: MessageDocument;
  available: boolean;
  children: ReactNode;
}
export function TranslationProvider(props: TranslationProviderProps) {
  // IMPLEMENT: define callbacks here, not passed from a Server Component.
  // Task07 wires onMissing to the bounded browser queue; render existing children.
}
```

## Existing files to change

- `src/i18n/request.ts`: retain getRequestConfig and current header-derived locale
  validation; replace dynamic file import with `await getRuntimeMessages(locale)`.
  Return its messages plus error handlers. Locale-selection default behavior is
  retained; it is distinct from falling back to English messages for a failed locale.
- `src/app/[countryCode]/layout.tsx`: retain the country mapper/HtmlLangSync. Pass
  messages, locale, and availability to TranslationProvider. Obtain availability
  from the same React-memoized loader used by request config, avoiding duplicate
  backend requests. SetRequestLocale receives the resolved locale, not country code;
  keep middleware's locale header, which is the proven path in this repo.
- `src/app/not-found.tsx`: continue using getTranslations; test that it shares the
  runtime loader and raw-key behavior. Do not add a new file import or parallel fetch.
- `src/lib/i18n/README.md`: explain DB runtime, developer/import files, fallback,
  cache TTL, activation, and adding locale/country/formatting mappings in code.

## Cache acceptance requirements

Use tags independent of customer/cache-ID cookies because UI messages are public.
Keep the in-process snapshot bounded (64 locales / 32 MiB maximum) and clone or
treat documents as immutable. Never overwrite it with failed/invalid/empty fallback
responses. An explicitly active empty document is a legitimate success and still
reports missing keys individually. Callback monotonicity guards overlapping fetches.

Timed revalidation is request-driven, not a cron job or promise of live updates to
an open browser. Other workers may serve older data until a timed refresh. A confirmed
inactive response must replace the cached active result with an inactive tombstone,
not throw during background refresh and leave the old active document cached
forever. The SDK exposes only status/message for errors, so match the exact token
specified in CONTRACTS.md. Use a per-locale generation counter to discard loads
that started before a newer refresh/deactivation signal. For absent-row or network
failures, keep the old cached document if Next serves one; otherwise use the last-good
snapshot. During a cold start with no data/snapshot, return `{}` and raw keys. Do not
silently invent a durable guarantee across processes/deployments.

## Tests

Create `src/__tests__/lib/data/ui-translations.test.ts`,
`src/__tests__/lib/i18n/translation-errors.test.ts`,
`src/__tests__/i18n/request.test.ts`, and
`src/__tests__/modules/common/components/translation-provider.test.tsx`.
Update `src/__tests__/app/country-code-layout.test.tsx`; verify root404 and metadata
in focused tests. Test the real error-handler factory; automatic next-intl mocks
must not hide missing-message behavior. Keep file-parity tests and JSON-based
component fixtures as developer fixtures, explicitly distinguished from runtime tests.

- **TC-1:** Given dk/se paths, when rendering server and client content, then use
  da/sv API messages consistently, including metadata; no runtime JSON import.
- **TC-2:** Given a successful cache load followed by outage and invalidation,
  then use the last-good copy; given cold cache, render the full key. Recovery
  replaces fallback. No English/file fetch occurs in any branch.
- **TC-3:** Given inactive404, then clear old snapshot; absent404 preserves last
  good when available. Older callbacks/in-flight responses cannot overwrite a
  newer inactive/version watermark.
- **TC-4:** Given missing or malformed ICU, then page/provider do not crash. Exact
  namespace/key is available without parsing an error string or logging values.
- **TC-5:** Given one unavailable locale with many t() calls, then suppress per-key
  reports. An active empty document still produces individual missing-key reports.
- **TC-6:** Given root404 or metadata outside the country layout, then the same
  request config and fallback apply without requiring a client provider.

Run focused Jest, standalone typecheck, lint, and a production build. Mocked cache
tests are insufficient: Task08 must verify cache/invalidation/outage behavior with
the pinned Next15 runtime. Remove any runtime message-file reads found by `rg`;
retain imports under tests/mocks and the JSON files themselves.
