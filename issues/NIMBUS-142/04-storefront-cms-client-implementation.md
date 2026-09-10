# Task 04 — Storefront server-only CMS client + types + tests

**App:** storefront · **Depends on:** 03 (test infra), and the Payload API shape from 02

## Project Environment

- **App root:** `apps/storefront`
- **Test command:** `pnpm --filter @b2b-starter/storefront test`
- **Test location:** `apps/storefront/src/__tests__/lib/data/cms.test.ts`

## Objective

Provide a **server-only** integration that fetches the **published** Claims page from the
Payload service and returns typed, safe data. The browser must never receive the Payload
API key or call Payload directly. Failure states (network error, unpublished, not found)
resolve to `null` so the route (task 05) can render a customer-safe unavailable state.

## Solution Design

Payload runs as a separate service, so this client does **not** use the Medusa SDK. It
uses server-side `fetch` against `PAYLOAD_API_URL` with an `Authorization: users
API-Key <PAYLOAD_API_KEY>` header. Both env vars are **server-only** (no `NEXT_PUBLIC_`
prefix). The module is marked `"server-only"` to guarantee it never bundles into client
code.

The client requests exactly the published `claims` document:
`/api/portal-pages?where[slug][equals]=claims&where[_status][equals]=published&depth=2&limit=1`
and maps the first result into a narrow `ClaimsPage` type. Unknown block types are kept
as `{ blockType: string }` so the renderer (task 05) can fail closed rather than trust
arbitrary shapes.

## New Files (verbatim skeletons)

### `apps/storefront/src/types/cms.ts`

```typescript
export type ClaimsRichTextBlock = {
  blockType: 'richText';
  // IMPLEMENT: serialized lexical content type (constrained nodes only)
  content: unknown;
};

export type ClaimsImageBlock = {
  blockType: 'image';
  url: string;
  alt: string;
  caption?: string;
};

export type ClaimsCalloutBlock = {
  blockType: 'callout';
  title: string;
  content: unknown;
  variant: string;
};

export type ClaimsCtaBlock = {
  blockType: 'cta';
  label: string;
  url: string;
};

export type ClaimsFaqBlock = {
  blockType: 'faq';
  rows: ReadonlyArray<{ question: string; answer: unknown }>;
};

export type ClaimsKnownBlock =
  | ClaimsRichTextBlock
  | ClaimsImageBlock
  | ClaimsCalloutBlock
  | ClaimsCtaBlock
  | ClaimsFaqBlock;

// Unknown blocks are preserved so the renderer can fail closed.
export type ClaimsBlock = ClaimsKnownBlock | { blockType: string };

export type ClaimsPage = {
  title: string;
  layout: ReadonlyArray<ClaimsBlock>;
};
```

### `apps/storefront/src/lib/data/cms.ts`

```typescript
import 'server-only';

import type { ClaimsPage } from '@/types/cms';

const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL;
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

// Returns the published Claims page, or null on any failure / unavailable state.
export async function getClaimsPage(): Promise<ClaimsPage | null> {
  if (!PAYLOAD_API_URL || !PAYLOAD_API_KEY) {
    return null;
  }

  // IMPLEMENT:
  //   - build the published-only query URL (slug=claims, _status=published, limit=1)
  //   - fetch with Authorization: `users API-Key ${PAYLOAD_API_KEY}`
  //   - use Next fetch caching/revalidation (e.g. next: { revalidate, tags: ['claims'] })
  //   - on non-2xx or empty docs -> return null (never throw to the caller)
  //   - map docs[0] into a narrow ClaimsPage; never forward the API key or raw errors
  return null;
}
```

### `apps/storefront/.env.template` (append)

```bash
# Payload CMS (server-only — never exposed to the browser)
PAYLOAD_API_URL=http://localhost:3001
PAYLOAD_API_KEY=
```

## Impacted Files

### `apps/storefront/.env.template`
- Append the two server-only Payload keys above (documented placeholders only).

## Test Cases

### TC-1: Missing config → null
- **Given:** `PAYLOAD_API_URL`/`PAYLOAD_API_KEY` unset
- **When:** `getClaimsPage()` is called
- **Then:** returns `null` and performs no fetch

### TC-2: Published page mapped
- **Given:** a mocked Payload response with a published `claims` doc
- **When:** `getClaimsPage()` is called
- **Then:** returns `{ title, layout }` with the expected blocks; the request carried the
  `Authorization: users API-Key …` header and the published-only query

### TC-3: Non-2xx / empty → null
- **Given:** a mocked 401/500 or empty `docs`
- **When:** `getClaimsPage()` is called
- **Then:** returns `null` and does not throw or leak the key/error body

### TC-4: Key never appears in returned data
- **Given:** any successful response
- **When:** inspecting the returned object
- **Then:** it contains only mapped content — no headers, credentials, or raw payload

## Implementation Steps

1. Add `src/types/cms.ts` and the `"server-only"` `src/lib/data/cms.ts` client.
2. Implement the published-only query, auth header, revalidation tag, safe mapping, and
   null-on-failure behaviour.
3. Append the server-only env keys to `.env.template`.
4. Add `src/__tests__/lib/data/cms.test.ts` covering TC-1..TC-4 by mocking `fetch`.

## Guardrails

- `PAYLOAD_API_KEY` and `PAYLOAD_API_URL` are server-only (no `NEXT_PUBLIC_`).
- Import `"server-only"` at the top of the client module.
- Never throw to the route; unavailable/unpublished/error all map to `null`.
- Do not render or return raw HTML from Payload; only structured, typed data.
