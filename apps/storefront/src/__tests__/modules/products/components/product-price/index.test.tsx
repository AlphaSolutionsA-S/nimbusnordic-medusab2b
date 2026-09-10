import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

import ProductPrice from "@/modules/products/components/product-price"

const product = {
  id: "prod-1",
  variants: [
    {
      calculated_price: {
        calculated_amount: 1000,
        original_amount: 1000,
        currency_code: "usd",
        calculated_price: { price_list_type: "default" },
      },
    },
  ],
} as unknown as HttpTypes.StoreProduct

describe("ProductPrice", () => {
  it("renders the extracted 'From' and 'Excl. VAT' labels unchanged", () => {
    render(<ProductPrice product={product} />)

    expect(screen.getByText(/^From /)).toBeInTheDocument()
    expect(screen.getByText("Excl. VAT")).toBeInTheDocument()
  })
})
