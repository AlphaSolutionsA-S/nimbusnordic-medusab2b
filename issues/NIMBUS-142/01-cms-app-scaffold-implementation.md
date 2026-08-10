# Task 01 — Payload CMS app scaffold (`apps/cms`)

**App:** cms (new) · **Depends on:** None

## Project Environment

- **App root:** `apps/cms`
- **Runtime:** Node.js 22 (Linux Azure App Service target)
- **Build command:** `pnpm build` (root) or `cd apps/cms && pnpm build`
- **Lint command:** `pnpm lint`
- **Test command:** `cd apps/cms && pnpm test` (Vitest — wired in task 02/03)
- **Package manager:** pnpm workspace (`apps/*`)

## Objective

Create a standalone Payload 3 application at `apps/cms/` that boots against Azure
Database for PostgreSQL and uses Payload's Azure Blob Storage adapter for media. This
task delivers **only** the running skeleton (app boots, Admin loads, DB connects). No
collections beyond Payload defaults yet — those land in task 02.

## Solution Design

Payload 3 is Next.js-native. The app is a minimal Next.js App Router project whose only
purpose is to host the Payload Admin (`/admin`) and Payload REST/GraphQL API (`/api`).
Postgres via `@payloadcms/db-postgres`; media storage via `@payloadcms/storage-azure`;
rich text via `@payloadcms/richtext-lexical`.

All secrets come from environment variables at deploy time. **Nothing secret is
committed.** `.env.example` documents the required keys with placeholder values only.

## New Files (verbatim skeletons)

### `apps/cms/package.json`

```json
{
  "name": "@dtc/cms",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint",
    "generate:types": "payload generate:types",
    "test": "vitest run"
  },
  "dependencies": {
    "@payloadcms/db-postgres": "3.x",
    "@payloadcms/next": "3.x",
    "@payloadcms/richtext-lexical": "3.x",
    "@payloadcms/storage-azure": "3.x",
    "@payloadcms/ui": "3.x",
    "next": "15.5.18",
    "payload": "3.x",
    "react": "19.0.5",
    "react-dom": "19.0.5"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "19.0.5",
    "@types/react-dom": "19.0.5",
    "typescript": "^5.5.3",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": ">=22"
  }
}
```

> IMPLEMENT: pin exact Payload package versions to a single mutually-compatible 3.x
> release (all `@payloadcms/*` and `payload` MUST share the same version). Verify the
> chosen Next.js version is within the range Payload 3 supports.

### `apps/cms/payload.config.ts`

```typescript
import { postgresAdapter } from '@payloadcms/db-postgres';
import { azureStorage } from '@payloadcms/storage-azure';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';
import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  admin: {
    // IMPLEMENT: set user collection slug once Users collection exists (task 02)
  },
  editor: lexicalEditor(),
  // IMPLEMENT (task 02): collections: [PortalPages, Media, Users]
  collections: [],
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  plugins: [
    azureStorage({
      // IMPLEMENT (task 02): enable only for the `media` collection
      collections: {},
      allowContainerCreate: process.env.AZURE_STORAGE_ALLOW_CONTAINER_CREATE === 'true',
      baseURL: process.env.AZURE_STORAGE_ACCOUNT_BASEURL || '',
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
      containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || '',
    }),
  ],
});
```

### `apps/cms/next.config.mjs`

```javascript
import { withPayload } from '@payloadcms/next/withPayload';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // IMPLEMENT: keep minimal; Payload only
};

export default withPayload(nextConfig);
```

### `apps/cms/src/app/(payload)/admin/[[...segments]]/page.tsx`

```typescript
// IMPLEMENT: re-export the standard Payload admin page from @payloadcms/next/views
// following the current Payload 3 App Router scaffold (importMap + config).
```

### `apps/cms/src/app/(payload)/api/[...slug]/route.ts`

```typescript
// IMPLEMENT: re-export REST_GET/REST_POST/REST_DELETE/REST_PATCH/REST_OPTIONS
// from @payloadcms/next/routes, wired to the imported config.
```

> Generate the full `(payload)` route group from the official Payload 3 create-template
> layout (admin page/layout, `api`, `graphql`, `graphql-playground`, `custom.scss`,
> `importMap`). Copy verbatim; do not hand-roll.

### `apps/cms/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@payload-config": ["./payload.config.ts"] }
  },
  "include": ["**/*.ts", "**/*.tsx", "next-env.d.ts"],
  "exclude": ["node_modules"]
}
```

### `apps/cms/.env.example`

```bash
# Payload
PAYLOAD_SECRET=change-me-in-deployment

# Azure Database for PostgreSQL (provided outside the repo at deploy time)
DATABASE_URI=postgres://user:password@host:5432/dbname?sslmode=require

# Azure Blob Storage (Payload media)
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER_NAME=claims-media
AZURE_STORAGE_ACCOUNT_BASEURL=
AZURE_STORAGE_ALLOW_CONTAINER_CREATE=false

# Server-only API key issued to the storefront integration user (see task 02)
# (managed via Payload Admin, not committed)
```

### `apps/cms/.gitignore`

```
node_modules
.next
payload-types.ts
.env
.env.local
```

## Impacted Files

- `pnpm-workspace.yaml` — already globs `apps/*`; **no change needed** (verify only).
- `turbo.json` — no change required; existing `build`/`lint`/`dev` tasks apply. Verify
  `.next/**` output is covered (it is).

## Test Cases

### TC-1: App boots and Admin is reachable
- **Given:** valid `DATABASE_URI` and `PAYLOAD_SECRET` in `.env`
- **When:** `pnpm --filter @dtc/cms dev` runs
- **Then:** `/admin` renders the Payload login and the Postgres schema is created

### TC-2: No secrets committed
- **Given:** the new `apps/cms` tree
- **When:** reviewing tracked files
- **Then:** only `.env.example` with placeholders exists; no real connection string or key

### TC-3: Build succeeds
- **Given:** the scaffold
- **When:** `pnpm --filter @dtc/cms build`
- **Then:** the Next.js/Payload build completes without type or config errors

## Implementation Steps

1. Scaffold `apps/cms` using the official Payload 3 blank template layout (App Router,
   `(payload)` route group). Match the pinned Next.js version to the storefront where
   compatible.
2. Add `package.json`, `payload.config.ts`, `next.config.mjs`, `tsconfig.json`,
   `.env.example`, `.gitignore` as above. Pin all `@payloadcms/*` + `payload` to one 3.x.
3. Configure `postgresAdapter` from `DATABASE_URI` and `azureStorage` from the Azure env
   vars (collections wired empty for now).
4. Run `pnpm install` at the repo root so the workspace picks up `@dtc/cms`.
5. Verify TC-1..TC-3 locally against a scratch Postgres. Do not commit any real secret.

## Guardrails

- Server-side only app. No storefront or Medusa code changes in this task.
- Do not add any collection beyond the Payload defaults here (task 02 owns the schema).
- Do not weaken storefront/backend configs.
