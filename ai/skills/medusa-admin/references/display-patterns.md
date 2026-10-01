# Displaying Entities - Patterns and Components

## DataTable or simple list

| DataTable | Simple list |
|-----------|-------------|
| Potentially many entries (more than 10) | A few entries (10 or fewer) |
| Search, filter or pagination needed | Widget or sidebar context |
| Bulk actions (multi-select, delete) | Preview or summary |
| Main list view | Limited space |

In code, switch on count: `items.length > 10` → DataTable; `> 0` → simple list; else the empty state.

## DataTable

pnpm projects: DataTable examples may use `react-router-dom`; install it first if needed (see `SKILL.md` Setup).

```tsx
import {
  DataTable, DataTableRowSelectionState, DataTablePaginationState,
  createDataTableColumnHelper, useDataTable,
} from "@medusajs/ui"
import { HttpTypes } from "@medusajs/framework/types"
import { useQuery, keepPreviousData } from "@tanstack/react-query"

const columnHelper = createDataTableColumnHelper<HttpTypes.AdminProduct>()
const columns = [
  columnHelper.select(), // row selection
  columnHelper.accessor("title", { header: "Title" }),
  columnHelper.accessor("status", { header: "Status" }),
  columnHelper.accessor("created_at", {
    header: "Created",
    cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
  }),
]

export function ProductTable() {
  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>({})
  const [searchValue, setSearchValue] = useState("")
  const [pagination, setPagination] = useState<DataTablePaginationState>({ pageIndex: 0, pageSize: 15 })
  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryFn: () => sdk.admin.product.list({ limit, offset, q: searchValue || undefined }),
    queryKey: ["products", limit, offset, searchValue],
    placeholderData: keepPreviousData,
  })

  const table = useDataTable({
    data: data?.products || [],
    columns,
    getRowId: (product) => product.id,
    rowCount: data?.count || 0,
    isLoading,
    rowSelection: { state: rowSelection, onRowSelectionChange: setRowSelection },
    search: { state: searchValue, onSearchChange: setSearchValue },
    pagination: { state: pagination, onPaginationChange: setPagination },
  })

  return (
    <DataTable instance={table}>
      <DataTable.Toolbar>
        <div className="flex gap-2"><DataTable.Search placeholder="Search products..." /></div>
      </DataTable.Toolbar>
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable>
  )
}
```

| Error | Fix |
|-------|-----|
| "DataTable.Search was rendered but search is not enabled" | Pass `search: { state, onSearchChange }` to `useDataTable` |
| "Cannot destructure property 'pageIndex' of pagination as it is undefined" | Initialize pagination with both `pageIndex` and `pageSize` |

## Simple lists

Card list item (products/variants, with thumbnail). Render in `<div className="flex flex-col gap-2">`. When `link` is absent, wrap `Inner` in a plain `<div>` instead of `Link`.

`@medusajs/ui` has no `Thumbnail` export (the dashboard's is internal), so define a local one mirroring it:

```tsx
import { Text } from "@medusajs/ui"
import { Photo, TriangleRightMini } from "@medusajs/icons"
import { Link } from "react-router-dom"

const Thumbnail = ({ src, alt }: { src?: string | null; alt?: string }) => (
  <div className="bg-ui-bg-component border-ui-border-base flex h-8 w-6 items-center justify-center overflow-hidden rounded border">
    {src ? <img src={src} alt={alt} className="h-full w-full object-cover object-center" /> : <Photo className="text-ui-fg-subtle" />}
  </div>
)

const ProductVariantItem = ({ variant, link }) => {
  const Inner = (
    <div className="shadow-elevation-card-rest bg-ui-bg-component rounded-md px-4 py-2 transition-colors">
      <div className="flex items-center gap-3">
        <div className="shadow-elevation-card-rest rounded-md">
          <Thumbnail src={variant.product?.thumbnail} />
        </div>
        <div className="flex flex-1 flex-col">
          <Text size="small" leading="compact" weight="plus">{variant.title}</Text>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {variant.options.map((o) => o.value).join(" ⋅ ")}
          </Text>
        </div>
        <div className="size-7 flex items-center justify-center">
          <TriangleRightMini className="text-ui-fg-muted rtl:rotate-180" />
        </div>
      </div>
    </div>
  )
  if (!link) return <div key={variant.id}>{Inner}</div>
  return (
    <Link to={link} key={variant.id}
      className="outline-none focus-within:shadow-borders-interactive-with-focus rounded-md [&:hover>div]:bg-ui-bg-component-hover">
      {Inner}
    </Link>
  )
}
```

Variants:
- No image (categories, regions): drop the Thumbnail, use `py-3`, title/description column `flex flex-1 flex-col gap-y-1`, render the description only if present.
- Compact, no cards: `flex flex-col gap-y-2` of rows `flex items-center justify-between` with a `weight="plus"` title and a subtle secondary value.
- Grid: `grid grid-cols-2 gap-4` of cards `shadow-elevation-card-rest bg-ui-bg-component rounded-md p-4` containing a `flex flex-col gap-y-2` of Thumbnail, title, description.

## Design elements

- Product/variant displays: always show a thumbnail (the local `Thumbnail` above); title `weight="plus"`, secondary info `text-ui-fg-subtle` (both `size="small" leading="compact"`); `shadow-elevation-card-rest` elevation; hover `bg-ui-bg-component-hover`; arrow indicator when clickable.
- Other entities: same card pattern with adapted content; `gap-3` for items, `gap-2` for lists.

| Purpose | Classes |
|---------|---------|
| Card with elevation and hover | `shadow-elevation-card-rest bg-ui-bg-component rounded-md transition-colors hover:bg-ui-bg-component-hover` |
| Vertical list / horizontal item | `flex flex-col gap-2` / `flex items-center gap-3` |
| Focus state for interactive elements | `outline-none focus-within:shadow-borders-interactive-with-focus rounded-md` |
| Directional icon (RTL) | `text-ui-fg-muted rtl:rotate-180` |

## Empty and loading states

```tsx
import { Spinner } from "@medusajs/icons" // an icon: add animate-spin

{isLoading ? (
  <div className="flex items-center justify-center p-8"><Spinner className="animate-spin" /></div>
) : items.length === 0 ? (
  <Text size="small" leading="compact" className="text-ui-fg-subtle">No items to display</Text>
) : (
  <div className="flex flex-col gap-2">{items.map((item) => <ItemDisplay key={item.id} item={item} />)}</div>
)}
```
