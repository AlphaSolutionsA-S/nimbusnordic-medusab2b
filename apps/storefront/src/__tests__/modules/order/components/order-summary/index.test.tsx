import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

import OrderSummary from "@/modules/order/components/order-summary"

const order = {
  currency_code: "usd",
  subtotal: 100,
  discount_total: 10,
  shipping_total: 5,
  tax_total: 8,
  total: 103,
} as unknown as HttpTypes.StoreOrder

describe("OrderSummary", () => {
  it("renders all extracted labels unchanged", async () => {
    const element = await OrderSummary({ order })
    render(element)

    expect(screen.getByText("Order Summary")).toBeInTheDocument()
    expect(screen.getByText("Subtotal")).toBeInTheDocument()
    expect(screen.getByText("Discount")).toBeInTheDocument()
    expect(screen.getByText("Shipping")).toBeInTheDocument()
    expect(screen.getByText("Taxes")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()
  })
})
