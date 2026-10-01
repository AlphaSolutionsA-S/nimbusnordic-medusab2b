# Table Selection Pattern

Reference implementation for selecting from large datasets (products, categories, regions, …): FocusModal + DataTable, with separate display and modal queries.

pnpm projects: needs `@tanstack/react-query` and (optional, for Link) `react-router-dom` installed first at the dashboard's exact versions — see `SKILL.md` Setup. Non-pnpm projects: don't install them.

## Complete widget: related products selection

```tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container, Heading, Button, toast, FocusModal, Text, DataTable,
  DataTableRowSelectionState, DataTablePaginationState, createDataTableColumnHelper, useDataTable,
} from "@medusajs/ui"
import { useMemo, useState } from "react"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { sdk } from "../lib/client"
import { PencilSquare } from "@medusajs/icons"

const ProductRelatedProductsWidget = ({ data: product }: DetailWidgetProps<HttpTypes.AdminProduct>) => {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  // Existing selection, stored as a JSON string in metadata
  const initialIds = useMemo(() => {
    if (product?.metadata?.related_product_ids) {
      try {
        const ids = JSON.parse(product.metadata.related_product_ids as string)
        return Array.isArray(ids) ? ids : []
      } catch {
        return []
      }
    }
    return []
  }, [product?.metadata?.related_product_ids])

  // Seed selection state with existing selections
  const initialState = useMemo(
    () => initialIds.reduce((acc, id) => { acc[id] = true; return acc }, {} as DataTableRowSelectionState),
    [initialIds]
  )
  const [rowSelection, setRowSelection] = useState<DataTableRowSelectionState>(initialState)
  const [searchValue, setSearchValue] = useState("")
  const [pagination, setPagination] = useState<DataTablePaginationState>({ pageIndex: 0, pageSize: 10 })

  // Query 1 — display: loads on mount, fetches the selected products by ID
  const { data: displayProducts } = useQuery({
    queryFn: async () => {
      if (initialIds.length === 0) return { products: [] }
      return sdk.admin.product.list({ id: initialIds, limit: initialIds.length })
    },
    queryKey: ["related-products-display", initialIds],
    enabled: initialIds.length > 0,
  })

  // Query 2 — modal: paginated, only while the modal is open
  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit
  const { data: modalProducts, isLoading } = useQuery({
    queryFn: () => sdk.admin.product.list({ limit, offset, q: searchValue || undefined }),
    queryKey: ["products-selection", limit, offset, searchValue],
    placeholderData: keepPreviousData,
    enabled: open,
  })

  const updateProduct = useMutation({
    mutationFn: (relatedProductIds: string[]) =>
      sdk.admin.product.update(product.id, {
        metadata: { ...product.metadata, related_product_ids: JSON.stringify(relatedProductIds) },
      }),
    onSuccess: () => {
      // Invalidate product + display queries; ["products-selection"] is modal data, no need
      queryClient.invalidateQueries({ queryKey: ["product", product.id] })
      queryClient.invalidateQueries({ queryKey: ["related-products-display"] })
      toast.success("Success", { description: "Related products updated successfully" })
      setOpen(false)
    },
    onError: (error) => {
      console.error("Error saving related products:", error)
      toast.error("Error", { description: "Failed to update related products" })
    },
  })

  const selectedProductIds = useMemo(() => Object.keys(rowSelection), [rowSelection])
  const selectedProducts = displayProducts?.products || []
  const columns = useColumns()
  const availableProducts = useMemo(
    () => (modalProducts?.products ?? []).filter((p) => p.id !== product.id),
    [modalProducts?.products, product.id]
  )

  const table = useDataTable({
    data: availableProducts,
    columns,
    getRowId: (row) => row.id,
    rowCount: modalProducts?.count || 0,
    isLoading,
    rowSelection: { state: rowSelection, onRowSelectionChange: setRowSelection },
    search: { state: searchValue, onSearchChange: setSearchValue },
    pagination: { state: pagination, onPaginationChange: setPagination },
  })

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Related Products</Heading>
        <Button size="small" variant="secondary" onClick={() => setOpen(true)}><PencilSquare /></Button>
      </div>
      <div className="px-6 py-4">
        {selectedProducts.length === 0 ? (
          <Text size="small" leading="compact" className="text-ui-fg-subtle">No related products selected</Text>
        ) : (
          <div className="flex flex-col gap-y-2">
            {selectedProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <Text size="small" leading="compact" weight="plus">{p.title}</Text>
              </div>
            ))}
          </div>
        )}
      </div>

      <FocusModal open={open} onOpenChange={setOpen}>
        <FocusModal.Content>
          <div className="flex h-full flex-col overflow-hidden">
            <FocusModal.Header />
            <FocusModal.Body className="flex items-start justify-center">
              <div className="w-full max-w-3xl">
                <div className="flex flex-col gap-y-6">
                  <DataTable instance={table}>
                    <DataTable.Toolbar>
                      <div className="flex gap-2"><DataTable.Search placeholder="Search products..." /></div>
                    </DataTable.Toolbar>
                    <DataTable.Table />
                    <DataTable.Pagination />
                  </DataTable>
                </div>
              </div>
            </FocusModal.Body>
            <FocusModal.Footer>
              <div className="flex items-center justify-end gap-x-2">
                <FocusModal.Close asChild>
                  <Button size="small" variant="secondary">Cancel</Button>
                </FocusModal.Close>
                <Button size="small" onClick={() => updateProduct.mutate(selectedProductIds)} isLoading={updateProduct.isPending}>
                  Save
                </Button>
              </div>
            </FocusModal.Footer>
          </div>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

const columnHelper = createDataTableColumnHelper<HttpTypes.AdminProduct>()
const useColumns = () =>
  useMemo(() => [
    columnHelper.select(),
    columnHelper.accessor("title", { header: "Title" }),
    columnHelper.accessor("status", { header: "Status" }),
    columnHelper.accessor("created_at", {
      header: "Created",
      cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
    }),
  ], [])

export const config = defineWidgetConfig({ zone: "product.details.after" })
export default ProductRelatedProductsWidget
```

## Key details

- Typography: container headers may use `<Heading>`; titles/labels and descriptions follow [typography.md](typography.md).
- State: `DataTableRowSelectionState` for selected rows, seeded from metadata; `DataTablePaginationState` with both `pageIndex` and `pageSize`.
- Always pass all `useDataTable` config: `data`, `columns`, `getRowId`, `rowCount`, `isLoading`, `rowSelection`, `search`, `pagination`.
- Separate display/modal queries so display loads on mount (no "No data" on refresh) and ID-based references are fetched properly.
- Use `placeholderData: keepPreviousData` (TanStack Query v5) for pagination to prevent flicker.
- Search is server-side — pass the search value in the queryFn.
- Metadata updates replace the whole object — spread existing metadata.
- Query keys include every parameter that affects the data.

## Other datasets

```tsx
sdk.admin.productCategory.list({ limit, offset })                                   // key ["categories", limit, offset]
sdk.admin.region.list({ limit, offset })                                            // key ["regions", limit, offset]
sdk.client.fetch("/admin/custom-endpoint", { query: { limit, offset, search: searchValue } }) // key ["custom-data", limit, offset, searchValue]
```
