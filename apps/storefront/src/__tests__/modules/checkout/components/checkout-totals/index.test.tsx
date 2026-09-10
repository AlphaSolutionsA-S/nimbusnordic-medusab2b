import { render, screen } from "@testing-library/react"
import type { B2BCart } from "@/types"

import CheckoutTotals from "@/modules/checkout/components/checkout-totals"

const cart = {
  currency_code: "usd",
  total: 100,
  item_subtotal: 100,
  tax_total: 0,
  shipping_total: 0,
} as unknown as B2BCart

describe("CheckoutTotals", () => {
  it("renders the reused Cart.cartTotals labels unchanged", () => {
    render(<CheckoutTotals cartOrOrder={cart} />)

    expect(
      screen.getByText("Subtotal (excl. shipping and taxes)")
    ).toBeInTheDocument()
    expect(screen.getByText("Shipping")).toBeInTheDocument()
    expect(screen.getByText("Taxes")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()
  })
})
