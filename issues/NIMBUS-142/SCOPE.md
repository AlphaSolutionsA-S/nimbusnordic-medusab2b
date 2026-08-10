# NIMBUS-142: Create claim information page

- **Date:** 2026-08-10
- **Status:** Scope complete
- **Type:** Story
- **Tracker:** JIRA - https://alphasolutionsdk.atlassian.net/browse/NIMBUS-142
- **Parent epic:** NIMBUS-127 - Create claim
- **Priority:** Medium
- **Component:** Customer Portal
- **Project folder:** issues/NIMBUS-142/
- **Size:** XL
- **Area:** Customer Portal, Payload CMS, Azure PostgreSQL, Azure Blob Storage, and storefront integration
- **Base branch:** `develop` (confirm before implementation)

## Background

Authenticated Customer Portal employees have no claim guidance in their account area. The
portal needs an editable `/account/claims` information page with rich content and images.
The expected roadmap includes additional editable portal pages and templates, making a
purpose-built CMS a better fit than expanding Medusa Admin into a page-builder product.

This story is the first Payload CMS use in the solution. Its CMS scope is intentionally
limited to the Claims page. It does not move product, category, price, order, customer,
claim, or other commerce data out of Medusa.

Medusa's built-in claim creation workflow is used by the Admin claim-creation API; it does
not provide a ready-made customer claim-submission API. This story therefore remains an
information page only.

## Scope decision

Introduce Payload as a dedicated CMS service for a single published Claims page. Payload
owns the page's rich content, media, editor experience, and publish state. Medusa remains
the commerce system of record and continues to own all commerce and customer operations.

The storefront owns access control: its existing account guard ensures only authenticated
Customer Portal employees can reach `/account/claims`. The server-rendered page retrieves
the published Claims page from Payload using a server-only integration; browsers must not
receive a Payload write credential or use the Payload Admin API directly.

Payload Admin initially manages content users in Payload. The same people may be provisioned
as Medusa and Payload administrators, but shared authentication or SSO is not part of this
story and must be scoped separately.

## Payload content model

- Create one `portal-pages` collection with a unique `claims` slug/identifier for this
  story. Do not create product, category, collection, pricing, order, customer, or claim
  collections in Payload.
- Enable Payload drafts and publishing for the Claims page. The storefront reads only the
  published version.
- Define an allowlisted block-based page layout, initially supporting:
  - Rich text: headings, paragraphs, emphasis, lists, and safe links.
  - Image: Payload-managed media, required alternative text, optional caption.
  - Callout: title, rich-text content, and a fixed visual variant.
  - CTA: label plus a validated URL.
  - FAQ: question-and-answer rows.
- Create a Payload `media` collection for Claims-page images. Store media in durable
  Azure Blob Storage using Payload's Azure Blob Storage adapter, not the local filesystem.
- Payload remains the source of truth only for the Claims page content and media introduced
  by this story.

## Requirements

### Functional

- Add an account-dashboard route at `/account/claims` for authenticated Customer Portal
  employees.
- Add a `Claims` entry to the existing account navigation in desktop and mobile variants.
- Render the published Payload Claims page using fixed storefront block components.
- Render a clear page title, rich page content, managed images, and support action supplied
  by the published Payload content.
- Make the page visible to every authenticated Customer Portal employee; company-admin
  status must not be required.
- Preserve the existing account login guard for signed-out direct navigation.
- Provide a Payload Admin editor for the Claims page with block add, edit, reorder, remove,
  draft, preview, and publish behavior.
- Let Payload content administrators upload and manage Claims-page images, provide required
  alt text, and insert those images into permitted page blocks.
- Make published content changes available on the storefront without a storefront code
  deployment.

### Non-functional and security

- Deploy Payload as a separately configured, persistent service using Azure Database for
  PostgreSQL through the provided connection string, Payload's Azure Blob Storage adapter
  for media, `PAYLOAD_SECRET`, and a server-only API credential for the storefront
  integration. The service runs separately from the storefront on Linux Azure App Service
  using Node.js 22. Do not commit any connection string or credential.
- Use least-privilege Payload roles: content administrators can manage the Claims page and
  its media; no public unauthenticated CMS editing endpoint exists.
- Do not expose a Payload write token to browsers. The storefront fetches published content
  server-side and returns rendered React output only.
- Render only known block types through fixed React components. Do not enable arbitrary
  HTML, scripts, iframes, custom JavaScript, or user-defined page layouts.
- Validate links and allowed block data at the Payload schema boundary. Image uploads must
  enforce an image MIME allowlist, file-size limit, required alternative text, and safe
  delivery configuration; reject SVG and other active content.
- Keep the Claims route server-rendered unless an implementation detail requires a focused
  client component.
- Add focused Payload, storefront integration, and page/navigation tests.

## Explicit non-goals

- Creating, submitting, editing, listing, or tracking customer claims.
- Selecting order items, collecting claim reasons, uploading claim evidence, refunds,
  replacements, returns, exchanges, shipping, payment, or inventory processing.
- Moving product, product-category, collection, price, inventory, cart, checkout, quote,
  order, customer, company, approval, Business Central, or any other commerce data to
  Payload.
- Adding a Payload storefront/catalog integration for products or commerce content.
- Building a general-purpose CMS, arbitrary page builder, reusable page-template library,
  multi-language implementation, SSO, or Medusa-to-Payload user synchronization.
- Raw HTML, scripts, iframes, embedded documents, arbitrary external images, video, or PDF
  blocks.

## Current-state findings

- The account dashboard is selected by
  `apps/storefront/src/app/[countryCode]/(main)/account/layout.tsx`; signed-out visitors
  receive the existing login parallel route rather than dashboard content.
- Account pages live under
  `apps/storefront/src/app/[countryCode]/(main)/account/@dashboard/`; the navigation is
  owned by `apps/storefront/src/modules/account/components/account-nav/index.tsx`.
- The workspace contains no Payload configuration, dependencies, content collections,
  media setup, or existing CMS integration. Payload must therefore be deployed and
  configured as a new service, not bolted into an existing implementation.
- The storefront already uses safe Markdown rendering for product text, but this story
  requires a block renderer because Payload owns rich structured page content and media.
- Existing Medusa Admin extensions and custom modules are unrelated to the selected content
  ownership model. This story supersedes the previously considered native Medusa editor.

## Proposed implementation

1. Create and deploy a separate Linux Azure App Service running Node.js 22 for the Payload
  application, using the provided Azure Database for PostgreSQL connection string,
  Payload's Azure Blob Storage adapter for media, environment configuration, and Payload
  Admin authentication.
2. Define the `portal-pages` and `media` collections, role/access rules, drafts/publishing,
   the singleton Claims-page constraint, and the initial allowlisted page blocks.
3. Seed or create the initial Claims page as a draft and publish only business-approved
   content. The CMS must not create any product or commerce collection.
4. Add a server-only storefront Payload client and configuration. It retrieves only the
   published `claims` page, handles unavailable/unpublished content safely, and never
   exposes CMS credentials to the browser.
5. Add `/account/claims`, a fixed block renderer, and Claims navigation links. Each Payload
   block maps to a reviewed storefront component; unknown blocks fail closed.
6. Add Payload previews that target the Claims-page presentation without allowing drafts to
   become publicly available through the normal storefront route.
7. Add focused tests for Payload access/publishing/media validation, server-side storefront
   retrieval, employee visibility, signed-out access, safe block rendering, and failure
   states.

## UX states

### Authenticated employee

- The employee can open `Claims` from account navigation or visit `/account/claims`.
- The employee sees the currently published Claims-page blocks, including approved rich text
  and images.

### Signed out

- Direct navigation follows the existing account login flow. The account dashboard and
  Claims-page content are not rendered.

### Content administrator

- A Payload content administrator can edit blocks, upload approved images, save drafts,
  preview content, and publish the Claims page.
- A content administrator cannot use this story's editor to change Medusa product or
  commerce information.

### CMS outage or unpublished page

- The Claims route shows a customer-safe unavailable state without Payload internals,
  credentials, stack traces, or unpublished draft content.

## Acceptance criteria

```gherkin
Feature: Payload-managed Claim information page

  Scenario: View the published Claims page
    Given I am signed in as a Customer Portal employee
    And a Claims page is published in Payload
    When I select "Claims" from account navigation
    Then I am taken to `/account/claims`
    And I see the published Claims-page blocks

  Scenario: All employees can view the page
    Given I am signed in as a non-administrator Customer Portal employee
    When I navigate directly to `/account/claims`
    Then I see the published Claims page

  Scenario: A content administrator publishes a change
    Given I am signed in to Payload Admin as a content administrator
    When I edit the Claims page, save a draft, and publish it
    Then the published storefront page shows the updated content
    And the normal storefront route never exposes the draft before publishing

  Scenario: A content administrator adds an image
    Given I am editing the Claims page in Payload Admin
    When I upload a valid image with alternative text and add it to an Image block
    Then the published Claims page renders that image and its alternative text

  Scenario: Unsupported content is blocked
    Given I am editing the Claims page in Payload Admin
    Then I cannot add raw HTML, scripts, iframes, arbitrary external images, video, or PDF
    And unknown CMS blocks are not rendered by the storefront

  Scenario: Commerce remains in Medusa
    Given I am editing the Claims page in Payload Admin
    Then I cannot create or edit product, price, order, customer, or claim data

  Scenario: Signed-out direct access
    Given I am not signed in to the Customer Portal
    When I navigate directly to `/account/claims`
    Then I receive the existing account login experience
```

## Verification

- Verify Payload connects to Azure Database for PostgreSQL using the supplied connection
  string and stores production media through Payload's Azure Blob Storage adapter; no
  production media is stored on local disk.
- Verify the Claims-page content administrator can draft, preview, publish, and manage
  allowed media, while unauthenticated users cannot modify content.
- Verify the storefront uses a server-only CMS credential and reads published content only.
- Verify all authenticated portal employees can view the page and signed-out users follow
  the existing login flow.
- Verify no Payload collection, API, or UI path added by this story handles product or
  other commerce data.
- Verify block data validation, link policy, image MIME/size rules, alt text, and safe
  rendering; verify malicious/unknown blocks do not execute or render.
- Verify CMS failures are customer-safe and do not reveal credentials, Payload internals, or
  draft content.
- Run focused Payload, storefront integration, and UI tests, then lint/build each affected
  application and manually test draft/publish behavior in a deployed environment.

## Dependencies and risks

- **Platform dependency:** Payload introduces a service, Azure Database for PostgreSQL,
  Azure Blob Storage, secret management, backups, monitoring, and deployment responsibility
  that do not exist in this repository today.
- **Authentication dependency:** Payload requires its own initial content-admin accounts.
  SSO or user synchronization with Medusa is deferred and must be separately designed.
- **Content dependency:** the business owner must provide or approve initial Claims-page
  copy, page structure, support destination, and images before publishing.
- **Integration risk:** incorrect preview or API access configuration could expose drafts.
  Drafts must only be accessible through authenticated Payload preview mechanisms and never
  through normal Customer Portal rendering.
- **Future expansion:** the block model is intentionally reusable, but additional portal
  pages and templates require their own ticket and scope review before being enabled.

## Open questions

There are no remaining scope decisions. Before publishing, the implementation team needs
the operational inputs below:

1. The Azure App Service URL and deployment configuration.
2. The people who need initial Payload content-administrator access.
3. The approved Claims-page content, support destination, and initial images.

## Definition of done

- Payload manages only a published Claims page and its media for this story.
- A separate Linux Azure App Service running Node.js 22 hosts Payload, using Azure Database
  for PostgreSQL and Payload's Azure Blob Storage adapter for persistence and media.
- Every authenticated Customer Portal employee can view the published `/account/claims`
  page; signed-out access follows the existing login guard.
- Authorized Payload content administrators can draft, preview, and publish supported
  Claims-page blocks and images.
- Product and all other commerce data remain exclusively in Medusa.
- Payload and storefront credentials remain server-side; the storefront never renders raw
  HTML, scripts, iframes, unpublished drafts, or unknown blocks.
- Focused test suites, linting, and builds for affected applications pass.