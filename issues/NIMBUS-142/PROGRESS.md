# NIMBUS-142 Progress

## 2026-08-05 - Scoping complete

**Outcome:** Created the initial scope for Jira story `NIMBUS-142` (`Create claim
information page`). Jira contained only the story title, so the scope is grounded in the
existing Customer Portal account-dashboard implementation and the title's explicit
"information page" wording. The story is limited to a signed-in `/account/claims` page,
a desktop/mobile account-navigation entry, approved process guidance, and an approved
support destination. Claim submission, order-item selection, uploads, and all backend
claim workflows are explicitly excluded.

Official Medusa documentation was checked: its `beginClaimOrderWorkflow` underpins the
Admin claim-creation route, with no ready-made customer Store API. A future submission
capability therefore requires separate product scope and custom backend authorisation,
workflow, and API design.

**Issue hygiene:** `NIMBUS-142` was assigned to Klaus Petersen. It remains in **Scoping**,
which is appropriate while business-owned copy and support-channel decisions are pending.

**Next owner:** Product owner, then implementation-planner

**Handover prompt:**

Confirm the following product inputs for `NIMBUS-142`: (1) the approved claim-process
copy, (2) the support destination (email, telephone, or external portal), and (3) whether
the page is visible to every authenticated employee or company administrators only. After
those inputs are confirmed, act as the implementation-planner for `NIMBUS-142` in
`D:\projects\Nimbus\nimbusnordic-medusab2b`. Read
`issues\NIMBUS-142\SCOPE.md` and create an implementation plan limited to the storefront:
an authenticated `@dashboard/claims/page.tsx` route and a `Claims` link in both variants
of `apps\storefront\src\modules\account\components\account-nav\index.tsx`. Reuse the
existing account login guard and account-page conventions. Do not add a backend route,
workflow, data model, migration, claim submission form, order-item selector, upload, or
any mutation. Include focused page/navigation tests and the storefront lint/build checks.

## 2026-08-05 - Scope revised for Admin-managed content

**Outcome:** The scope now includes a native Medusa content-management capability. An
authenticated Medusa Admin user edits one structured Claims Information record through a
custom Admin UI route; protected Admin APIs persist it, and a customer-authenticated Store
API serves it to the storefront page. This supersedes the initial static-copy assumption.

The selected approach is a custom Medusa module and Admin UI, not Payload or another
external CMS. The repository already uses Medusa custom modules, protected Admin routes,
and Admin UI routes, so the native solution avoids another service, content store,
authentication boundary, and deployment surface for one page. The editor is intentionally
structured and plain-text only: title, introductory copy, guidance, support-action label,
and support-action URL. Raw HTML, rich-text rendering, page-builder editing, media,
versioning, and publishing workflow are out of scope.

**Confirmed product decision:** Every authenticated Customer Portal employee can view the
page. Medusa Admin users alone can edit it.

**Next owner:** Product owner, then implementation-planner

**Handover prompt:**

Confirm the approved initial claim-process copy and support destination for `NIMBUS-142`.
Then act as the implementation-planner for `NIMBUS-142` in
`D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-142\SCOPE.md` and plan a
native Medusa content-management implementation: a singleton custom content module plus
migration, protected Admin read/update routes, a customer-authenticated Store read route,
and a custom Admin UI route using the existing Medusa Admin patterns. The Storefront route
`@dashboard/claims/page.tsx` must use the SDK-backed Store API helper and display
structured plain text; add Claims navigation links in both account-nav variants. Use a
workflow for the Admin update mutation, validate inputs at the API boundary, and ensure
untrusted text is never rendered as HTML. Do not add Payload, another CMS, a claim form,
order-item selection, uploads, claim workflow, or any customer mutation. Include focused
backend, Admin UI, and storefront tests plus backend/storefront lint and build validation.

## 2026-08-05 - Rich text and images added to scope

**Outcome:** The Claims Information editor now requires a constrained rich-text authoring
experience with headings, paragraphs, emphasis, lists, links, and inline images. Content
is stored as Markdown rather than raw HTML. The storefront uses an allowlisted Markdown
renderer with raw HTML disabled, building on the existing `react-markdown` pattern in the
storefront.

Images are uploaded by authenticated Medusa Admin users through Medusa's File Module and
embedded using the returned public URL with required alt text. The current backend has no
explicit durable file provider; production implementation must configure an S3-compatible
File Module provider before enabling image publishing. Upload validation must limit files
to approved raster-image MIME types and a defined size limit, reject SVG/active content,
and refuse arbitrary external image URLs.

**Next owner:** Product owner, then implementation-planner

**Handover prompt:**

Confirm the approved initial claim content, support destination, and the production
S3-compatible object-storage provider/configuration for `NIMBUS-142`. Then act as the
implementation-planner for `NIMBUS-142` in
`D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-142\SCOPE.md` and plan a
native Medusa implementation with a singleton content module, migration, protected Admin
read/update APIs, a customer-authenticated Store read API, and a custom Admin UI route.
Use a constrained rich Markdown editor supporting headings, paragraphs, bold, italic,
lists, links, and inline images; use Medusa's authenticated upload flow and File Module
for image uploads, not arbitrary external URLs. Require alt text, validate image MIME type
and size server-side, reject SVG and active content, and use public access only for images
intended for the authenticated portal. Store Markdown rather than HTML and render it in
the storefront without raw HTML support. Add Claims navigation links for every
authenticated employee and include focused backend, Admin UI, and storefront tests plus
lint/build validation. Do not add Payload, another CMS, a page builder, raw HTML,
iframe/script embeds, arbitrary external images, a claim form, or any customer mutation.

## 2026-08-10 - Scope revised to Payload CMS

**Outcome:** `NIMBUS-142` now uses Payload as a dedicated CMS service for the Claims page
only. The previous native Medusa editor proposal is superseded. Payload owns the Claims
page's allowlisted blocks, rich content, media, drafts, preview, publishing, and
content-admin experience; the storefront server-renders published content at
`/account/claims`.

Payload is explicitly not used for products or any other commerce domain. Medusa remains
the system of record for product, price, inventory, cart, checkout, quote, order, customer,
company, approval, Business Central, and claim data. Additional portal pages and templates
are future work and require their own scope.

Payload requires its own initial content-administrator accounts, database, object storage,
hosting, backups, monitoring, and secret management. Shared Medusa/Payload authentication
or SSO is deferred. The storefront controls employee access through its existing account
guard and retrieves only published Payload content with a server-only integration.

**Next owner:** Product owner, then implementation-planner

**Handover prompt:**

Confirm Payload hosting, PostgreSQL, S3-compatible media storage, initial Payload content
administrators, and approved Claims-page copy/images for `NIMBUS-142`. Then act as the
implementation-planner for `NIMBUS-142` in
`D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-142\SCOPE.md` and plan the
first Payload integration only: deploy/configure Payload with persistent storage and secure
secrets; define a `portal-pages` collection containing only the singleton Claims page plus
a media collection; enable drafts/publish and allowlisted Rich Text, Image, Callout, CTA,
and FAQ blocks. Add a server-only storefront client that retrieves published Claims content
and render it through fixed block components at `/account/claims`, with navigation in both
account-nav variants. Preserve the existing Customer Portal login guard and allow every
authenticated employee to view the published page. Do not add Payload product, catalog,
price, order, customer, claim, or other commerce collections; do not add arbitrary page
building, raw HTML/scripts/iframes, SSO, or another editable portal page. Include Payload
access/publishing/media tests, storefront integration tests, lint/build checks, and a
deployed draft/publish verification.

## 2026-08-10 - Azure persistence decisions confirmed

**Outcome:** Payload will use Azure Database for PostgreSQL through a connection string
provided outside the repository. Claims-page media will use Payload's Azure Blob Storage
adapter. The implementation must configure both through deployment environment variables;
no database connection string, storage credential, or other secret belongs in source
control.

**Remaining infrastructure question:** choose the hosting target for the Payload
application itself. Initial Payload content administrators and approved Claims-page content
and images also remain to be confirmed.

**Next owner:** implementation-planner

**Handover prompt:**

Plan `NIMBUS-142` using the confirmed infrastructure decisions in
`issues\NIMBUS-142\SCOPE.md`: configure Payload's PostgreSQL database connection from the
provided Azure connection string and configure the Payload Azure Blob Storage adapter for
the `media` collection. Keep all secrets in deployment environment variables and do not
commit them. The Payload hosting target remains to be selected. Maintain the existing
Payload-only Claims-page boundary: do not add product or other commerce collections.

## 2026-08-10 - Scope complete

**Outcome:** The Payload hosting decision is complete. Implementation creates a separate
Linux Azure App Service running Node.js 22 for Payload. It uses Azure Database for
PostgreSQL through a deployment-provided connection string and Payload's Azure Blob Storage
adapter for media. Payload Admin and API run in this one service; the public Claims-page
view remains a server-rendered storefront route at `/account/claims`.

The scope is now implementation-ready. The App Service URL/deployment settings, initial
Payload content administrators, and approved Claims-page copy/images are implementation
inputs, not unresolved product or architecture decisions.

**Next owner:** implementation-planner

**Handover prompt:**

You are the implementation-planner for `NIMBUS-142` in
`D:\projects\Nimbus\nimbusnordic-medusab2b`. Read `issues\NIMBUS-142\SCOPE.md` and create
the implementation plan for a Payload-managed Claims page only. Plan a separate Linux
Azure App Service running Node.js 22 for the combined Payload Admin and API application,
configured with Azure Database for PostgreSQL and Payload's Azure Blob Storage adapter.
Treat the App Service URL/deployment configuration, initial Payload content administrators,
and approved page copy/images as deployment/content inputs to obtain during implementation.
Add the server-rendered storefront `/account/claims` route and navigation links, retrieving
published Payload content through a server-only integration. Preserve the Customer Portal
login guard and allow every authenticated employee to view the page. Do not add Payload
product, catalog, price, order, customer, claim, or other commerce collections; do not add
SSO, another editable portal page, or arbitrary page-builder behavior. Include deployment,
security, Payload, storefront integration, and draft/publish verification tasks.

## 2026-08-10 - Implementation plan ready

- **Date:** 2026-08-10
- **Updated by:** implementation-planner agent
- **Outcome:** Implementation plan is ready; implementation is the next stage. Base branch
  confirmed as `develop`; new Payload CMS app placement confirmed as `apps/cms`. Test
  infrastructure gate resolved with **Option B** (wire storefront Jest + RTL and cover the
  new Claims surface only; no repo-wide backfill). Wrote `PLAN.md`, `manifest.md`, and
  seven task files (01 CMS scaffold, 02 collections/access/tests, 03 storefront Jest infra,
  04 server-only CMS client, 05 Claims renderer/route, 06 account-nav links, 07
  deployment/security verification).
- **Handover to:** implementor agent
- **Handover prompt:** Act as the implementor for `NIMBUS-142` in
  `D:\projects\Nimbus\nimbusnordic-medusab2b`. Create branch `feature/NIMBUS-142` from
  `develop`. Implement the tasks in `issues\NIMBUS-142\` per `manifest.md` and `PLAN.md`,
  in dependency order (CMS track 01→02 and storefront track 03→04→05→06 may run in
  parallel; 07 last). Follow each task file's skeletons and guardrails: a new Payload 3
  app at `apps/cms` (separate Linux Node.js 22 App Service, Azure PostgreSQL, Azure Blob
  media), a singleton published Claims page with allowlisted blocks, a server-only
  storefront CMS client, a fail-closed `/account/claims` route with Claims nav links for
  every authenticated employee, and Option B tests (Vitest for CMS, Jest+RTL for
  storefront). Never commit secrets. Do not add any commerce collection, SSO, another
  editable page, a claim form, or any customer mutation. Run lint/build/test for
  `apps/cms` and `apps/storefront` before marking tasks done.

## 2026-08-11 - Payload route wiring restored

**Outcome:** Replaced the placeholder Payload admin/API route stubs with the real
`@payloadcms/next` handlers, added the admin `importMap`, and added the route-group layout
plus GraphQL routes. The CMS build now passes locally, so the remaining step is to redeploy
the App Service with these files.

**Next owner:** deployment/release

**Handover prompt:**

Redeploy the CMS App Service for `NIMBUS-142` so the updated Payload route group reaches
production. Then revisit `/admin`; it should load the real Payload admin instead of the
placeholder loading screen.

## 2026-08-11 - Initial Payload schema migration ready

**Outcome:** Generated and committed the initial PostgreSQL schema migration, configured
the Payload Postgres adapter to run committed migrations during production initialization,
and replaced the remaining hand-written Admin layout with the Payload 3.8 scaffold wiring.
Validation against an isolated empty PostgreSQL database confirmed that the migration runs
once, creates the `users` and migration-ledger tables, remains idempotent on restart, and
serves `/admin/create-first-user`. The CMS build and all 11 focused tests pass.

**Next owner:** deployment/release

**Handover prompt:**

Redeploy the CMS App Service for `NIMBUS-142`. Confirm the startup log reports migration
`20260811_104814_initial_schema`, then open `/admin/create-first-user` to create the initial
administrator. Change the PostgreSQL connection string to `sslmode=verify-full`, and rotate
the secrets exposed in the shared configuration screenshot before production use.

## 2026-08-11 - Migration startup ordering corrected

**Outcome:** Confirmed the deployed database migration eventually completed and the live
`/admin` route now redirects to a working `/admin/create-first-user` form. The earlier
`relation "users" does not exist` errors occurred while App Service warm-up requests raced
Payload 3.8's asynchronous `prodMigrations` startup path. Updated the deployment artifact to
include the Payload config and migration sources, and changed App Service startup to run
`payload migrate` synchronously before starting Next.js.

**Next owner:** deployment/release

**Handover prompt:**

Redeploy the CMS App Service for `NIMBUS-142`. Confirm the startup logs complete the Payload
migration command before `next start`, then verify `/admin/create-first-user` returns HTTP
200 without transient missing-table errors during warm-up.

## 2026-08-11 - Payload Live Preview implemented

**Outcome:** Enabled Payload Live Preview for the Claims page with mobile and desktop
breakpoints. The storefront uses Payload's origin-validated React live-preview hook at the
same relationship depth as its initial server request. Normal account traffic remains
published-only, while `?livePreview=true` accepts in-memory document updates from the
configured Payload origin. The Claims route was also moved from the incorrect `(main/)`
directory into the authenticated `(main)` account route group.

**Next owner:** deployment/release

**Handover prompt:**

Set `STOREFRONT_URL` and `STOREFRONT_DEFAULT_COUNTRY` on the Payload App Service. Set
`PAYLOAD_PUBLIC_URL` to the browser-visible Payload Admin origin on the storefront while
retaining its existing server-to-server `PAYLOAD_API_URL`, then redeploy both applications.
Log into the storefront as a customer in the same browser before opening Payload Live
Preview because the Claims route intentionally retains the Customer Portal account guard.