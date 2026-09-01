import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

jest.mock("@/lib/data/cart-event-bus", () => ({
  addToCartEventBus: { emitCartAdd: jest.fn(), onCartAdd: jest.fn() },
}))

import ProductVariantsTable from "@/modules/products/components/product-variants-table"

const product = {
  id: "prod-1",
  options: [],
  variants: [
    {
      id: "variant-1",
      sku: "SKU-1",
      options: [],
      calculated_price: {
        calculated_amount: 1000,
        original_amount: 1000,
        currency_code: "usd",
        calculated_price: { price_list_type: "default" },
      },
    },
  ],
} as unknown as HttpTypes.StoreProduct

const region = { id: "region-1" } as unknown as HttpTypes.StoreRegion

describe("ProductVariantsTable", () => {
  it("renders the extracted table headers unchanged", () => {
    render(<ProductVariantsTable product={product} region={region} />)

    expect(screen.getByText("SKU")).toBeInTheDocument()
    expect(screen.getByText("Price")).toBeInTheDocument()
    expect(screen.getByText("Quantity")).toBeInTheDocument()
  })

  it("renders the extracted button label unchanged when no quantity is chosen", () => {
    render(<ProductVariantsTable product={product} region={region} />)

    expect(
      screen.getByText("Choose product variant(s) above")
    ).toBeInTheDocument()
  })
})
