import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

import ProductFacts from "@/modules/products/components/product-facts"

describe("ProductFacts", () => {
  it("renders the extracted in-stock message unchanged", async () => {
    const product = {
      variants: [{ manage_inventory: true, inventory_quantity: 20 }],
      mid_code: null,
    } as unknown as HttpTypes.StoreProduct

    const element = await ProductFacts({ product })
    render(element)

    expect(
      screen.getByText("Can be shipped immediately (20 in stock)")
    ).toBeInTheDocument()
  })

  it("renders the extracted limited-stock message unchanged", async () => {
    const product = {
      variants: [{ manage_inventory: true, inventory_quantity: 3 }],
      mid_code: null,
    } as unknown as HttpTypes.StoreProduct

    const element = await ProductFacts({ product })
    render(element)

    expect(
      screen.getByText("Limited quantity available (3 in stock)")
    ).toBeInTheDocument()
  })

  it("renders the extracted MID label unchanged", async () => {
    const product = {
      variants: [],
      mid_code: "MID-123",
    } as unknown as HttpTypes.StoreProduct

    const element = await ProductFacts({ product })
    render(element)

    expect(screen.getByText("MID: MID-123")).toBeInTheDocument()
  })
})
