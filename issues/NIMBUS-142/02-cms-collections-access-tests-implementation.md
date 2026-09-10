# Task 02 — Payload collections, access control, media validation + CMS tests

**App:** cms · **Depends on:** 01

## Project Environment

- **App root:** `apps/cms`
- **Test command:** `cd apps/cms && pnpm test` (Vitest)
- **Test location:** `apps/cms/src/**/*.test.ts`

## Objective

Define the complete Payload content model for the single Claims page:

- A `portal-pages` collection constrained to **one** `claims` document, with
  drafts/publishing and an allowlisted block-based `layout`.
- A `media` collection persisted to Azure Blob Storage with strict image validation.
- A `users` collection whose API-key-enabled service user authorises the storefront's
  server-only read integration.
- Least-privilege access control on every collection.

No product, price, order, customer, claim, or other commerce collection is created.

## Solution Design

**Singleton enforcement:** `portal-pages` permits create only when no `claims` document
exists (enforced in a `beforeValidate`/access rule keyed on `slug`), and `slug` is fixed
to `claims`. This story ships exactly one page; the collection shape stays reusable for
future pages but no second page is enabled here.

**Publishing:** `versions: { drafts: true }`. The storefront reads only `_status:
published`. Drafts are reachable solely through authenticated Payload preview.

**Blocks (allowlist):** `richText`, `image`, `callout`, `cta`, `faq`. Every block is a
named Payload `Block`. Unknown/legacy block types cannot be authored, and the storefront
renderer (task 05) fails closed on any unrecognised block.

**Media safety:** raster MIME allowlist, max file size, required `alt`, SVG and active
content rejected. Azure Blob adapter (from task 01) is enabled for this collection only.

**Access model:**
- `users`: only authenticated content admins; API-key user is read-only for content.
- `portal-pages`: read = published for the API-key service user + full read for admins;
  create/update/delete = authenticated content admins only. No public unauthenticated
  write path anywhere.
- `media`: read for admins + API-key user; write = content admins only.

## New Files (verbatim skeletons)

### `apps/cms/src/collections/Users.ts`

```typescript
import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    useAPIKey: true, // storefront server-only integration user
  },
  admin: { useAsTitle: 'email' },
  access: {
    // IMPLEMENT: authenticated content admins only; no public access
  },
  fields: [
    // IMPLEMENT: role field ('admin' | 'service') to distinguish the
    // storefront read-only API-key user from human content admins
  ],
};
```

### `apps/cms/src/collections/Media.ts`

```typescript
import type { CollectionConfig } from 'payload';

const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // IMPLEMENT: confirm limit with product

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    // IMPLEMENT: read = admins + service user; write = admins only
  },
  upload: {
    mimeTypes: [...ALLOWED_IMAGE_MIME], // rejects SVG + active content
    // IMPLEMENT: image size limits / focal point as needed
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true, // required alternative text
    },
    // IMPLEMENT: optional caption
  ],
  // IMPLEMENT (validation hook): enforce MAX_FILE_SIZE and re-check MIME server-side;
  // reject SVG / non-allowlisted types with a clear error.
};
```

### `apps/cms/src/blocks/index.ts`

```typescript
import type { Block } from 'payload';

export const RichTextBlock: Block = {
  slug: 'richText',
  fields: [
    // IMPLEMENT: lexical richText field restricted to headings, paragraphs,
    // emphasis, lists, and safe links only (no raw HTML, no upload nodes here)
  ],
};

export const ImageBlock: Block = {
  slug: 'image',
  fields: [
    // IMPLEMENT: media relationship (required), alt inherited from Media, optional caption
  ],
};

export const CalloutBlock: Block = {
  slug: 'callout',
  fields: [
    // IMPLEMENT: title (text), content (constrained richText), fixed variant (select)
  ],
};

export const CtaBlock: Block = {
  slug: 'cta',
  fields: [
    // IMPLEMENT: label (text, required), url (text, required) with URL validation
    // that allowlists http(s) + internal paths and rejects javascript:/data: schemes
  ],
};

export const FaqBlock: Block = {
  slug: 'faq',
  fields: [
    // IMPLEMENT: rows array of { question: text, answer: constrained richText }
  ],
};

export const PORTAL_PAGE_BLOCKS = [
  RichTextBlock,
  ImageBlock,
  CalloutBlock,
  CtaBlock,
  FaqBlock,
];
```

### `apps/cms/src/collections/PortalPages.ts`

```typescript
import type { CollectionConfig } from 'payload';
import { PORTAL_PAGE_BLOCKS } from '../blocks';

export const PortalPages: CollectionConfig = {
  slug: 'portal-pages',
  admin: { useAsTitle: 'title' },
  versions: { drafts: true }, // draft + published
  access: {
    // IMPLEMENT:
    //   read: published docs for the service API-key user; all docs for admins
    //   create/update/delete: authenticated content admins only
  },
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      defaultValue: 'claims',
      // IMPLEMENT: lock to 'claims' for this story (validate === 'claims')
    },
    { name: 'title', type: 'text', required: true },
    {
      name: 'layout',
      type: 'blocks',
      blocks: PORTAL_PAGE_BLOCKS, // allowlist only
    },
  ],
  hooks: {
    // IMPLEMENT (beforeValidate): singleton guard — reject create when a 'claims'
    // document already exists.
  },
};
```

### `apps/cms/src/blocks/validate-url.ts`

```typescript
// IMPLEMENT: exported pure function isSafePortalUrl(value: string): true | string
// allowlist http/https + leading-slash internal paths; reject javascript:, data:,
// vbscript:, and other active schemes. Used by CtaBlock url validation and unit-tested.
```

## Impacted Files

### `apps/cms/payload.config.ts`
- Register collections: `[PortalPages, Media, Users]`.
- Set `admin.user = Users.slug`.
- Enable `azureStorage` for the `media` collection only:
  `collections: { media: true }`.

## Test Cases (Vitest — Option B, focused on new surface)

### TC-1: URL allowlist rejects active schemes
- **Given:** `isSafePortalUrl`
- **When:** called with `javascript:alert(1)`, `data:text/html,...`, `vbscript:...`
- **Then:** returns an error string; returns `true` for `https://…` and `/account/claims`

### TC-2: Media rejects SVG and oversize
- **Given:** the Media upload validation
- **When:** an `image/svg+xml` file or a file over the size limit is uploaded
- **Then:** validation fails with a clear message; PNG/JPEG/WebP within limit pass

### TC-3: Media requires alt text
- **Given:** a media create without `alt`
- **When:** validated
- **Then:** it is rejected

### TC-4: portal-pages singleton guard
- **Given:** an existing published `claims` page
- **When:** a second `portal-pages` create is attempted
- **Then:** it is rejected by the `beforeValidate` guard

### TC-5: Access — unauthenticated cannot write
- **Given:** no auth / the read-only service API-key user
- **When:** attempting create/update/delete on `portal-pages` or `media`
- **Then:** access is denied

### TC-6: Access — service user reads published only
- **Given:** the API-key service user
- **When:** querying `portal-pages`
- **Then:** only `_status: published` docs are returned; drafts are not

## Implementation Steps

1. Add `Users`, `Media`, `PortalPages` collections and the `blocks/` allowlist + URL
   validator as above.
2. Wire collections and enable Azure storage for `media` in `payload.config.ts`.
3. Implement access functions (published-for-service, admin-only-write) and the
   singleton `beforeValidate` guard.
4. Run `payload generate:types` to produce `payload-types.ts` (git-ignored; regenerated).
5. Add Vitest config + the focused tests (TC-1..TC-6). Prefer testing pure functions
   (`isSafePortalUrl`, validation helpers) directly, and access/singleton behaviour via
   Payload's Local API against a test database.
6. Create the initial `claims` page as a draft in Payload Admin during verification; do
   not commit content fixtures containing real business copy.

## Guardrails

- No product/price/order/customer/claim/commerce collection anywhere.
- No raw HTML, script, iframe, video, or PDF block. Rich text is node-restricted.
- No public unauthenticated write endpoint. Service user is read-only, published-only.
- Do not commit real credentials, API keys, or business content.
