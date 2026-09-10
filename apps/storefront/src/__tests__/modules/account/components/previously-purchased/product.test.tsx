import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import PreviouslyPurchasedProduct from "@/modules/account/components/previously-purchased/product"

const variant = {
  variant_id: "variant-1",
  product_title: "Test Product",
  product_handle: "test-product",
  title: "Default",
  thumbnail: null,
} as unknown as HttpTypes.StoreOrderLineItem

describe("PreviouslyPurchasedProduct", () => {
  it("renders the extracted 'Buy again' label unchanged", async () => {
    const element = await PreviouslyPurchasedProduct({ variant })
    render(element)

    expect(screen.getByText(/Buy again/)).toBeInTheDocument()
  })
})
