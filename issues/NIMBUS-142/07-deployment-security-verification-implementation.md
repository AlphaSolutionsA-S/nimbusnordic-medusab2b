# Task 07 — Deployment, secrets & security verification

**App:** cms + storefront (infra/config) · **Depends on:** 02, 05

## Objective

Make the Payload CMS deployable as a **separate Linux Azure App Service (Node.js 22)**
wired to Azure Database for PostgreSQL and Azure Blob Storage, connect the storefront to
it through server-only credentials, and run the full security/verification checklist from
the scope. No secret is committed; all sensitive values are deployment environment
variables.

## Solution Design

The CMS app (`apps/cms`) runs standalone (`payload` Admin + API). The storefront reaches
it only server-side via `PAYLOAD_API_URL` + `PAYLOAD_API_KEY` (task 04). Deployment
inputs — App Service URL, Postgres connection string, Blob credentials, initial content
admins, approved Claims copy/images — are supplied at deploy time, not in the repo.

This task produces the deployment/runtime configuration and a documented verification
run. It adds a short operational note to the issue folder (not repo docs) describing the
required environment variables and the manual draft→publish verification.

## Configuration deliverables

### CMS App Service environment variables (set in Azure, never committed)

| Variable | Purpose |
|---|---|
| `PAYLOAD_SECRET` | Payload signing secret |
| `DATABASE_URI` | Azure Database for PostgreSQL connection string (`sslmode=require`) |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob account for media |
| `AZURE_STORAGE_CONTAINER_NAME` | Media container (e.g. `claims-media`) |
| `AZURE_STORAGE_ACCOUNT_BASEURL` | Public base URL for media delivery |
| `AZURE_STORAGE_ALLOW_CONTAINER_CREATE` | `false` in production |
| `NODE_VERSION` / runtime | Node.js 22 (Linux) |

### Storefront environment variables (server-only)

| Variable | Purpose |
|---|---|
| `PAYLOAD_API_URL` | CMS App Service base URL |
| `PAYLOAD_API_KEY` | API key of the read-only Payload service user (task 02) |

> IMPLEMENT: confirm the storefront/CMS hosting mechanism used by the team (Medusa Cloud
> `mcloud` for the existing apps vs. a dedicated Azure App Service for the CMS). The CMS
> is explicitly a **separate** Linux App Service; set its env vars there. Set the two
> storefront vars in the storefront's existing deployment environment.

## Impacted Files

- **Issue folder only:** add `issues/NIMBUS-142/DEPLOYMENT.md` capturing the env-var
  matrix above and the verification checklist below. (Operational note for the team —
  not committed application docs.)
- No application source changes in this task beyond confirming `.env.example` /
  `.env.template` placeholders from tasks 01 and 04 are complete and secret-free.

## Verification checklist (run in a deployed environment)

1. **Persistence:** CMS connects to Azure PostgreSQL with the supplied string; the
   `portal-pages`/`media`/`users` schema is created; media is stored in Azure Blob (no
   production media on local disk).
2. **Publishing:** a content admin can draft, preview, and publish the Claims page; the
   storefront shows published content only; drafts never appear on `/account/claims`.
3. **Media safety:** upload rejects SVG and oversize files, requires alt text, and serves
   from the configured Blob host; `next/image` loads it via the allowlisted remote host.
4. **Server-only credentials:** the storefront reads published content server-side; the
   `PAYLOAD_API_KEY` never reaches the browser (verify no `NEXT_PUBLIC_` exposure and no
   key in client bundles/network from the browser).
5. **Access control:** every authenticated employee can view the page; signed-out direct
   navigation to `/account/claims` follows the existing account login flow; no
   unauthenticated CMS write path exists.
6. **Fail-closed rendering:** unknown blocks do not render; CMS outage/unpublished shows
   the customer-safe unavailable state with no internals.
7. **Commerce boundary:** no Payload collection/API/UI added by this story handles
   product, price, order, customer, or claim data.
8. **Quality gates:** `pnpm lint` and `pnpm build` pass for `apps/cms` and
   `apps/storefront`; `pnpm test` passes the CMS (Vitest) and storefront (Jest) suites.

## Test Cases

### TC-1: No secret in source control
- **Given:** the full branch diff
- **When:** scanning tracked files
- **Then:** only `.env.example`/`.env.template` placeholders exist; no real connection
  string, storage key, `PAYLOAD_SECRET`, or API key is committed

### TC-2: Storefront bundle excludes the API key
- **Given:** a production storefront build
- **When:** inspecting client bundles
- **Then:** `PAYLOAD_API_KEY` does not appear (guaranteed by `server-only` + no
  `NEXT_PUBLIC_` prefix)

### TC-3: End-to-end publish is visible
- **Given:** a published Claims change in the deployed CMS
- **When:** an authenticated employee loads `/account/claims`
- **Then:** the updated content renders without a storefront redeploy

## Implementation Steps

1. Provision/confirm the separate Linux Node.js 22 App Service for `apps/cms`; set its
   env vars in Azure (never in the repo).
2. Create the read-only Payload service user and issue its API key; set
   `PAYLOAD_API_URL`/`PAYLOAD_API_KEY` in the storefront deployment environment.
3. Provision initial Payload content-admin accounts; seed and publish the approved
   Claims page/images.
4. Run the verification checklist and record results in
   `issues/NIMBUS-142/DEPLOYMENT.md`.
5. Confirm lint/build/test gates pass for both apps.

## Guardrails

- Never commit secrets. All sensitive values live in deployment env vars.
- The CMS is a separate service; do not fold it into the storefront or Medusa runtime.
- Do not open any public unauthenticated CMS write path.
- Keep the commerce boundary: Payload manages only the Claims page + its media.
