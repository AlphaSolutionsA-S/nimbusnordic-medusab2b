# Task 05 — Storefront Claims block renderer + `/account/claims` route

**App:** storefront · **Depends on:** 04

## Project Environment

- **App root:** `apps/storefront`
- **Route:** `/account/claims` (authenticated account dashboard)
- **Test command:** `pnpm --filter @b2b-starter/storefront test`

## Objective

Render the published Claims page inside the account dashboard using **fixed** React
components — one per allowlisted block. Unknown blocks are not rendered (fail closed). If
the CMS is unavailable or the page is unpublished, show a customer-safe unavailable state
with no internals. The route stays a Server Component and is protected by the existing
account guard.

## Solution Design

The account dashboard already gates signed-out users via
`account/layout.tsx` (renders `login` when there is no customer). Adding the page under
`@dashboard/claims/` inherits that guard automatically — no new auth code. Every
authenticated employee may view it; **no** `is_admin` check (per confirmed product
decision).

A `ClaimsBlocks` renderer switches on `blockType` and delegates to one component per
known block. Rich text arrives as constrained lexical/structured content; render it with
a safe serializer — **raw HTML disabled** — consistent with the storefront's existing
`react-markdown` safety posture. Unknown `blockType` renders nothing.

## New Files (verbatim skeletons)

### `apps/storefront/src/modules/account/components/claims-blocks/index.tsx`

```typescript
import type { ClaimsBlock } from '@/types/cms';
import { ClaimsRichText } from './rich-text';
import { ClaimsImage } from './image';
import { ClaimsCallout } from './callout';
import { ClaimsCta } from './cta';
import { ClaimsFaq } from './faq';

export function ClaimsBlocks({ blocks }: { blocks: ReadonlyArray<ClaimsBlock> }) {
  return (
    <div className="flex flex-col gap-y-6" data-testid="claims-blocks">
      {blocks.map((block, i) => {
        switch (block.blockType) {
          case 'richText':
            return <ClaimsRichText key={i} block={block} />;
          case 'image':
            return <ClaimsImage key={i} block={block} />;
          case 'callout':
            return <ClaimsCallout key={i} block={block} />;
          case 'cta':
            return <ClaimsCta key={i} block={block} />;
          case 'faq':
            return <ClaimsFaq key={i} block={block} />;
          default:
            return null; // fail closed on unknown blocks
        }
      })}
    </div>
  );
}
```

### `apps/storefront/src/modules/account/components/claims-blocks/rich-text.tsx`

```typescript
import type { ClaimsRichTextBlock } from '@/types/cms';

export function ClaimsRichText({ block }: { block: ClaimsRichTextBlock }) {
  // IMPLEMENT: render constrained lexical content with a safe serializer.
  // Raw HTML/script MUST NOT be rendered. Only headings, paragraphs, emphasis,
  // lists, and validated links. Reuse the storefront's safe-render approach.
  return null;
}
```

> Sibling components `image.tsx`, `callout.tsx`, `cta.tsx`, `faq.tsx` follow the same
> shape (typed `block` prop, no raw HTML). `cta.tsx` renders a link only after the URL
> passes the same allowlist policy as the CMS validator; `image.tsx` uses `next/image`
> with required `alt`.

### `apps/storefront/src/modules/account/components/claims-unavailable/index.tsx`

```typescript
import { Text } from '@medusajs/ui';

export function ClaimsUnavailable() {
  return (
    <div data-testid="claims-unavailable">
      <Text>
        {/* IMPLEMENT: customer-safe message. No stack traces, credentials,
            Payload internals, or draft content. */}
      </Text>
    </div>
  );
}
```

### `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/claims/page.tsx`

```typescript
import { getClaimsPage } from '@/lib/data/cms';
import { ClaimsBlocks } from '@/modules/account/components/claims-blocks';
import { ClaimsUnavailable } from '@/modules/account/components/claims-unavailable';
import { Heading } from '@medusajs/ui';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Claims',
  description: 'Guidance for submitting a claim.',
};

export default async function Claims() {
  const page = await getClaimsPage();

  return (
    <div className="w-full flex flex-col gap-y-4" data-testid="claims-page-wrapper">
      <div className="mb-4">
        <Heading>{page?.title ?? 'Claims'}</Heading>
      </div>
      {page ? <ClaimsBlocks blocks={page.layout} /> : <ClaimsUnavailable />}
    </div>
  );
}
```

### `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/claims/loading.tsx`

```typescript
import Spinner from '@/modules/common/icons/spinner';

export default function Loading() {
  return (
    <div className="flex items-center justify-center w-full h-full text-ui-fg-base">
      <Spinner size={36} />
    </div>
  );
}
```

## Impacted Files

### `apps/storefront/next.config.js`
- Add the Azure Blob Storage media host to `images.remotePatterns` so `next/image` can
  load published Claims images.
  > IMPLEMENT: add `{ protocol: 'https', hostname: '<account>.blob.core.windows.net' }`
  > (or the configured base-URL host). Keep it aligned with the CMS
  > `AZURE_STORAGE_ACCOUNT_BASEURL`.

## Test Cases

### TC-1: Renders published blocks
- **Given:** `getClaimsPage` mocked to return a page with each known block
- **When:** the page renders
- **Then:** each block's component output appears in order

### TC-2: Unknown block ignored
- **Given:** a layout containing `{ blockType: 'script' }`
- **When:** `ClaimsBlocks` renders
- **Then:** nothing is rendered for it (fail closed)

### TC-3: Unavailable state
- **Given:** `getClaimsPage` returns `null`
- **When:** the page renders
- **Then:** the `claims-unavailable` message shows; no internals/credentials leak

### TC-4: CTA URL policy
- **Given:** a CTA block with `javascript:alert(1)`
- **When:** `ClaimsCta` renders
- **Then:** no active link is produced

### TC-5: Image requires alt + trusted host
- **Given:** an image block
- **When:** rendered
- **Then:** `alt` is present and the host is the configured Azure Blob host

## Implementation Steps

1. Add the block renderer + per-block components with typed props and no raw HTML.
2. Add the unavailable component and the `@dashboard/claims/page.tsx` + `loading.tsx`.
3. Add the Azure Blob host to `next.config.js` `images.remotePatterns`.
4. Add tests TC-1..TC-5 under `src/__tests__/` mirroring the component paths.

## Guardrails

- No `is_admin` gate — every authenticated employee sees the page.
- Fail closed on unknown blocks. No raw HTML/script/iframe rendering.
- Server Component by default; add `"use client"` only if a block genuinely needs it.
- Unavailable state must not expose Payload internals, drafts, or credentials.
