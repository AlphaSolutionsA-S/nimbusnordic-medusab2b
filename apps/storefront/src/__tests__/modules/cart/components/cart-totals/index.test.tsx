import { render, screen } from "@testing-library/react"

jest.mock("@/lib/context/cart-context", () => ({
  useCart: jest.fn(),
}))

import { useCart } from "@/lib/context/cart-context"
import CartTotals from "@/modules/cart/components/cart-totals"

describe("CartTotals", () => {
  it("renders all extracted labels unchanged", () => {
    ;(useCart as jest.Mock).mockReturnValue({
      isUpdatingCart: false,
      cart: {
        currency_code: "usd",
        total: 100,
        item_subtotal: 90,
        tax_total: 10,
        shipping_total: 0,
        discount_total: 5,
        gift_card_total: 2,
      },
    })

    render(<CartTotals />)

    expect(
      screen.getByText("Subtotal (excl. shipping and taxes)")
    ).toBeInTheDocument()
    expect(screen.getByText("Discount")).toBeInTheDocument()
    expect(screen.getByText("Shipping")).toBeInTheDocument()
    expect(screen.getByText("Taxes")).toBeInTheDocument()
    expect(screen.getByText("Gift card")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()
  })
})
