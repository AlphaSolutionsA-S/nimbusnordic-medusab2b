import { render, screen } from "@testing-library/react"
import { useParams } from "next/navigation"
import type { HttpTypes } from "@medusajs/types"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import ItemPreview from "@/modules/cart/components/item-preview"

const item = {
  id: "item-1",
  quantity: 2,
  product: { handle: "test-product", title: "Test Product" },
  variant: { title: "Default" },
  metadata: { note: "Handle with care" },
} as unknown as HttpTypes.StoreCartLineItem

describe("ItemPreview", () => {
  it("renders the extracted 'Note:' label unchanged", () => {
    render(<ItemPreview item={item} currencyCode="usd" />)

    expect(screen.getByText("Note:")).toBeInTheDocument()
    expect(screen.getByText("Handle with care")).toBeInTheDocument()
  })
})
