import { render, screen } from "@testing-library/react"

jest.mock("@/lib/context/cart-context", () => ({
  useCart: jest.fn(() => ({
    isUpdatingCart: false,
    cart: {
      currency_code: "usd",
      total: 100,
      item_subtotal: 100,
      tax_total: 0,
      shipping_total: 0,
    },
  })),
}))

import CartTotals from "@/modules/common/components/cart-totals"

// This component is currently unused (superseded by
// @/modules/cart/components/cart-totals) — see the NOTE in its source. Kept
// under regression test since it still ships in the bundle and reuses the
// `Cart.cartTotals` translation keys.
describe("CartTotals (common, unused duplicate)", () => {
  it("renders the reused Cart.cartTotals labels unchanged", () => {
    render(<CartTotals />)

    expect(
      screen.getByText("Subtotal (excl. shipping and taxes)")
    ).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()
  })
})
