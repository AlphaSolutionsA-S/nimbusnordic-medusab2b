import { render, screen } from "@testing-library/react"
import { useParams } from "next/navigation"
import type { HttpTypes } from "@medusajs/types"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

jest.mock("@/lib/data/cart", () => ({
  updateLineItem: jest.fn(),
}))

jest.mock("@/lib/context/cart-context", () => ({
  useCart: jest.fn(() => ({
    handleDeleteItem: jest.fn(),
    handleUpdateCartQuantity: jest.fn(),
  })),
}))

import ItemFull from "@/modules/cart/components/item-full"

const item = {
  id: "item-1",
  quantity: 1,
  product_handle: "test-product",
  product: { title: "Test Product" },
  variant: { title: "Default" },
} as unknown as HttpTypes.StoreCartLineItem

describe("ItemFull", () => {
  it("renders the extracted 'BRAND' label unchanged", () => {
    render(<ItemFull item={item} currencyCode="usd" />)

    expect(screen.getByText("BRAND")).toBeInTheDocument()
  })
})
