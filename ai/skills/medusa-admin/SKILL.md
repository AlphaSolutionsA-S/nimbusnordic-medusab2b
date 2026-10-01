---
name: medusa-admin
description: "Medusa v2 (Node/TypeScript, React) Admin dashboard customizations: widgets, UI routes, forms, tables, data loading and navigation with the Admin SDK, Medusa UI and TanStack Query. Load before planning, researching or implementing any Medusa Admin UI."
---

# Medusa Admin dashboard customizations

Admin SDK + Medusa UI extensions, verified against `@medusajs/admin-sdk` / `@medusajs/dashboard` 2.17
and `@medusajs/ui` 4.1 (the dashboard ships `@tanstack/react-query` 5.x and `react-router-dom` 6.x).
"UI Routes" are custom admin pages, not backend API routes (those: `medusa-backend`). For the
storefront, use `medusa-storefront`.

## Reference map

The quick reference below is not enough to implement from. Before writing code, load the references
for what you are building (at least one or two):

| Building | Load |
|----------|------|
| Widgets, any data fetching, mutations, metadata | `references/data-loading.md` |
| Forms, modals, edit buttons, Select | `references/forms.md` |
| Tables/lists/cards of entities, empty/loading states | `references/display-patterns.md` |
| Selecting from large datasets (DataTable in FocusModal) | `references/table-selection.md` |
| Links, `useNavigate`, `useParams`, query params | `references/navigation.md` |
| Text styling, color classes | `references/typography.md` |

Consult this skill first for planning and patterns (it shows correct vs incorrect patterns such as
separate display/modal queries, which the docs don't emphasize). Use the Medusa docs MCP server
second, for exact component props, the widget zone list, JS SDK method details and config options.
The `medusa` MCP is only available to Medusa Cloud users; where the project has none, "the `medusa` MCP" in
this skill means the documentation at `https://docs.medusajs.com` and the installed source.

## Setup

SDK client; use exactly this config, other values cause errors:

```tsx
// src/admin/lib/client.ts
import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
  debug: import.meta.env.DEV,
  auth: { type: "session" },
})
```

pnpm projects: install the peer deps at the dashboard's exact version before writing any code (pnpm
does not expose the dashboard's own dependencies to your admin code).

```bash
pnpm list @tanstack/react-query --depth=10 | grep @medusajs/dashboard
pnpm add @tanstack/react-query@[exact-version]
# if using navigation (Link, useNavigate, …)
pnpm list react-router-dom --depth=10 | grep @medusajs/dashboard
pnpm add react-router-dom@[exact-version]
```

Non-pnpm projects must not install these; the dashboard already provides them. TanStack Query is
pre-configured: never wrap components in `QueryClientProvider`.

## Rule categories by priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | SDK Usage | CRITICAL | `sdk-` (shared with `medusa-storefront`) |
| 2 | Data Loading | CRITICAL | `data-` |
| 3 | Design System | CRITICAL | `design-` |
| 4 | Typography | HIGH | `typo-` |
| 5 | Forms & Modals | MEDIUM | `form-` |
| 6 | Selection Patterns | MEDIUM | `select-` |

## Quick Reference

### 1. SDK Usage (CRITICAL)
The `sdk-*` rules of `medusa-storefront` apply unchanged, under the same IDs:
- `sdk-always-use`, `sdk-required-headers`: the Medusa JS SDK for every request, never plain `fetch()`; admin routes need the `Authorization` and session cookie headers the SDK adds.
- `sdk-existing-methods`, `sdk-client-fetch`: built-in endpoints use SDK methods (`sdk.admin.product.list()`, not `sdk.client.fetch("/admin/products")`); custom routes use `sdk.client.fetch()`.
- `sdk-no-json-stringify`, `sdk-plain-objects`: pass `body` as a plain object; the SDK serializes it.

### 2. Data Loading (CRITICAL)
- `data-display-on-mount`: display queries load on mount; no `enabled` condition based on UI state. A data guard such as `enabled: ids.length > 0` is fine.
- `data-separate-queries`: separate display queries from modal/form queries.
- `data-invalidate-display`: after mutations, invalidate display queries, not just modal queries.
- `data-loading-states`: show loading states (`Spinner` from `@medusajs/icons`), not empty states, while fetching.
- `data-pnpm-install-first`: pnpm projects install `@tanstack/react-query` before coding (see Setup).
- `data-price-format` (CRITICAL; defined in `medusa-backend`): Medusa prices are as-is ($49.99 = `49.99`, not cents). Display directly; never divide by 100.

### 3. Design System (CRITICAL)
- `design-semantic-colors`: semantic color classes (`bg-ui-bg-base`, `text-ui-fg-subtle`), never hardcoded colors.
- `design-spacing`: `px-6 py-4` section padding, `gap-2` for lists, `gap-3` for items.
- `design-button-size`: `size="small"` for buttons in widgets and tables.
- `design-medusa-components`: Medusa UI components (Container, Button, Text), not raw HTML.

### 4. Typography (HIGH)
- `typo-text-component`: `Text` from `@medusajs/ui`, never plain span/p.
- `typo-labels`: `<Text size="small" leading="compact" weight="plus">` for labels/headings.
- `typo-descriptions`: `<Text size="small" leading="compact" className="text-ui-fg-subtle">` for descriptions.
- `typo-no-heading-widgets`: no `Heading` for small sections in widgets (use Text).

### 5. Forms & Modals (MEDIUM)
- `form-focusmodal-create`: FocusModal for creating entities (not Drawer).
- `form-drawer-edit`: Drawer for editing existing entities (not FocusModal).
- `form-disable-pending`: disable actions during mutations (`disabled={mutation.isPending}`).
- `form-show-loading`: loading state on submit (`isLoading={mutation.isPending}`).

### 6. Selection Patterns (MEDIUM)
- `select-small-datasets`: Select component for 2-10 options (statuses, types). DataTable for 10 or fewer items is overkill.
- `select-large-datasets`: DataTable in FocusModal for large datasets (products, categories). Select for more than 10 items is poor UX.
- `select-search-config`: pass search config to `useDataTable`, or you get "search not enabled".

## Data loading pattern

```tsx
const RelatedProductsWidget = ({ data: product }) => {
  const [modalOpen, setModalOpen] = useState(false)

  // ✓ display query: no `enabled`, loads on mount; key includes every queryFn input
  const { data: displayProducts } = useQuery({
    queryFn: () => fetchSelectedProducts(selectedIds),
    queryKey: ["related-products-display", product.id, selectedIds],
  })
  // ✓ modal query: `enabled: modalOpen` is fine for modal-only data
  const { data: modalProducts } = useQuery({
    queryFn: () => sdk.admin.product.list({ limit: 10, offset: 0 }),
    queryKey: ["products-selection"],
    enabled: modalOpen,
  })
  const updateProduct = useMutation({
    mutationFn: updateFunction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["related-products-display", product.id] }) // prefix match
      queryClient.invalidateQueries({ queryKey: ["product", product.id] })
      // modal selection query needs no invalidation
    },
  })
  // display renders displayProducts; FocusModal renders modalProducts
}

// ✗ one query for both: on page refresh the modal is closed, the query never runs,
//   and the user sees an empty state until they open the modal
const { data } = useQuery({ queryFn: () => sdk.admin.product.list(), enabled: modalOpen })
const displayItems = data?.filter((item) => ids.includes(item.id))
```

## Calling the backend

Per the SDK Usage rules above:

```tsx
import { sdk } from "../lib/client" // wherever the project keeps its SDK instance

queryFn: () => sdk.admin.product.retrieve(productId)                   // ✓ built-in
queryFn: () => sdk.client.fetch(`/admin/products/${id}/reviews`)        // ✓ custom route
queryFn: () => fetch(`http://localhost:9000/admin/products/${id}/reviews`) // ✗ missing Authorization

const createReview = useMutation({
  mutationFn: (data) => sdk.client.fetch("/admin/reviews", { method: "POST", body: data }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["reviews", product.id] })
    toast.success("Review created")
  },
})
```

## Widget vs UI Route

```tsx
// Widget — extends an existing page: src/admin/widgets/custom-widget.tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Container } from "@medusajs/ui"

const MyWidget = ({ data }: DetailWidgetProps<HttpTypes.AdminProduct>) => <Container>…</Container>
export const config = defineWidgetConfig({ zone: "product.details.after" })
export default MyWidget

// UI Route — new page: src/admin/routes/custom-page/page.tsx
import { defineRouteConfig } from "@medusajs/admin-sdk"

const CustomPage = () => <div>Page content</div>
export const config = defineRouteConfig({ label: "Custom Page" })
export default CustomPage
```

## Common issues

| Symptom | Fix |
|---------|-----|
| "Cannot find module" (pnpm) | Install peer deps before coding, at the dashboard's exact versions |
| "No QueryClient set" | pnpm: `@tanstack/react-query` isn't installed; install it at the dashboard's exact version. Non-pnpm: it was installed by mistake; remove it from package.json |
| "DataTable.Search not enabled" | Pass `search` config to `useDataTable` |
| Widget not refreshing | Invalidate display queries, not just modal queries; include all dependencies in query keys |
| Display empty on refresh | Display query has a UI-state `enabled`; remove it |

## After implementing: give the user next steps

End with how to see and test the feature:

1. Start the backend if not running (the project's dev script, which runs `medusa develop`).
2. Open http://localhost:9000/app and log in with admin credentials.
3. Find the UI:
   - Widget: go to the page for its zone (e.g. Products → a product for `product.details.after`; likewise Orders, Customers).
   - UI Route: the `label` in the admin sidebar, or `http://localhost:9000/app/[your-route-path]`.
4. Test what was built: forms (create/edit, validation and error messages), tables (pagination, search, sorting, row selection), data display (loads, refreshes after mutations), modals (FocusModal/Drawer submit updates data), navigation (links route correctly).

Present it in this shape:

```markdown
## Implementation Complete
The [feature name] has been successfully implemented. Here's how to see it:
### Start the Development Server
[command based on package manager]
### Access the Admin Dashboard
Open http://localhost:9000/app in your browser and log in.
### View Your Custom UI
**For Widgets:** 1. Navigate to [admin page, e.g. "Products"] 2. Select [entity] 3. Scroll to [zone location] 4. You'll see your "[widget name]" widget
**For UI Routes:** 1. Look for "[page label]" in the admin navigation 2. Or go to http://localhost:9000/app/[route-path]
### What to Test
1. [Specific test case 1]
2. [Specific test case 2]
3. [Specific test case 3]
```

## Project specifics

If `project.md` exists next to this file, read it as well. It holds this project's paths, canonical examples, exceptions and extra rules, and it wins where the two differ.
