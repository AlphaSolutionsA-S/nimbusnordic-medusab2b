import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

import ItemUnitPrice from "@/modules/order/components/item/item-unit-price"

const item = {
  compare_at_unit_price: 1500,
  unit_price: 1000,
} as unknown as HttpTypes.StoreOrderLineItem

describe("ItemUnitPrice (unused elsewhere, kept under regression test)", () => {
  it("renders the extracted 'Original: ' label unchanged", async () => {
    const element = await ItemUnitPrice({ item })
    render(element)

    expect(screen.getByText("Original:")).toBeInTheDocument()
  })
})
