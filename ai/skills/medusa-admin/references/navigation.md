# Navigation and Routing

pnpm projects: install `react-router-dom` at the dashboard's exact version before implementing (commands in `SKILL.md` Setup). Non-pnpm projects: don't install it.

## Rules

- Internal paths start with `/` and resolve against the admin router's basename (`/app` by default), so omit the `/app` prefix: `/products/${id}`, `/custom/my-page`. A UI route's path is its folder under `src/admin/routes/`; a `[id]` folder becomes `:id`.
- `Link` for navigation links (better accessibility); `useNavigate` for programmatic navigation after actions or logic.
- Handle loading states when fetching data based on route params.
- Clean up listeners/subscriptions on unmount in routes; maintain focus management when navigating.

## Link

Card-style link (the standard clickable list item; also used in display-patterns.md):

```tsx
import { Link } from "react-router-dom"
import { Text } from "@medusajs/ui"
import { TriangleRightMini } from "@medusajs/icons"

<Link
  to="/custom/my-page"
  className="outline-none focus-within:shadow-borders-interactive-with-focus rounded-md [&:hover>div]:bg-ui-bg-component-hover"
>
  <div className="shadow-elevation-card-rest bg-ui-bg-component rounded-md px-4 py-3 transition-colors">
    <div className="flex items-center gap-3">
      <Text size="small" leading="compact" weight="plus">Go to Custom Page</Text>
      <div className="size-7 flex items-center justify-center">
        <TriangleRightMini className="text-ui-fg-muted rtl:rotate-180" />
      </div>
    </div>
  </div>
</Link>
```

For a list item with thumbnail, add `<Thumbnail src={product.thumbnail} />` (local component, see display-patterns.md) before a `flex flex-1 flex-col` title/subtitle block and use `py-2`.

Button-styled link (e.g. a widget header "View All" next to an Edit button):

```tsx
<Button asChild size="small" variant="transparent">   {/* or variant="secondary" */}
  <Link to={`/custom/products/${product.id}/related`}>View All</Link>
</Button>
```

## Built-in admin routes

```tsx
const ADMIN_ROUTES = {
  products: "/products",
  productDetails: (id: string) => `/products/${id}`,
  orders: "/orders",
  orderDetails: (id: string) => `/orders/${id}`,
  customers: "/customers",
  customerDetails: (id: string) => `/customers/${id}`,
  categories: "/categories",
  inventory: "/inventory",
  pricing: "/pricing",
  settings: "/settings", // custom settings pages: /settings/custom-field-name
}
```

## Programmatic navigation

```tsx
import { useNavigate, useLocation } from "react-router-dom"
const navigate = useNavigate()

const createProduct = useMutation({
  mutationFn: (data) => sdk.admin.product.create(data),
  onSuccess: (result) => {
    queryClient.invalidateQueries({ queryKey: ["products"] })
    toast.success("Product created successfully")
    navigate(`/products/${result.product.id}`)   // after delete: navigate("/products")
  },
})

navigate("/custom/review", { state: { productId: product.id, productTitle: product.title } })
const { productId, productTitle } = useLocation().state || {}   // in the destination page

navigate(-1)   // back
```

Back-to-list header: `<IconButton onClick={() => navigate("/custom/products")}><ArrowLeft /></IconButton>` next to the `Heading` (`ArrowLeft` from `@medusajs/icons`).

## Route and query parameters

```tsx
import { useParams, useSearchParams } from "react-router-dom"

// Page at /custom/products/:id  (multiple: /custom/orders/:orderId/items/:itemId → const { orderId, itemId } = useParams())
const { id } = useParams()
const { data: product, isLoading } = useQuery({
  queryFn: () => sdk.admin.product.retrieve(id, { fields: "+metadata,+variants.*" }),
  queryKey: ["product", id],
  enabled: !!id,
})

// Query string ?status=published&page=2
const [searchParams, setSearchParams] = useSearchParams()
const status = searchParams.get("status")
const page = searchParams.get("page")
useQuery({
  queryFn: () => sdk.admin.product.list({ status, offset: (parseInt(page) || 0) * 15 }),
  queryKey: ["products", status, page],
})
setSearchParams({ status: "published", page: "0" })
```

## Breadcrumbs and tabs

```tsx
import { Text, Tabs } from "@medusajs/ui"

// Breadcrumb: links as subtle text, muted "/" separators, current page weight="plus"
<Link to="/products">
  <Text size="small" className="text-ui-fg-subtle hover:text-ui-fg-base">Products</Text>
</Link>
<Text size="small" className="text-ui-fg-muted">/</Text>
<Text size="small" weight="plus">Details</Text>

// Tabs driven by ?tab=
const activeTab = useSearchParams()[0].get("tab") || "details"
<Tabs value={activeTab}>
  <Tabs.List>
    <Tabs.Trigger value="details" asChild><Link to="?tab=details">Details</Link></Tabs.Trigger>
    {/* … one Trigger per tab */}
  </Tabs.List>
  <Tabs.Content value="details">{/* … */}</Tabs.Content>
</Tabs>
