jest.mock("next-intl", () => ({
  ...jest.requireActual("../../../../../../__mocks__/next-intl"),
  useLocale: () => "da",
}))

jest.mock("@/lib/context/cart-context", () => ({
  useCart: jest.fn(),
}))

import { render, screen } from "@testing-library/react"

import { useCart } from "@/lib/context/cart-context"
import CartTotals from "@/modules/cart/components/cart-totals"

describe("CartTotals locale formatting", () => {
  it("formats the total with the active locale (TC-7)", () => {
    ;(useCart as jest.Mock).mockReturnValue({
      isUpdatingCart: false,
      cart: {
        currency_code: "usd",
        total: 100,
        item_subtotal: 90,
        tax_total: 10,
        shipping_total: 0,
        discount_total: 0,
        gift_card_total: 0,
      },
    })

    render(<CartTotals />)

    expect(screen.getByTestId("cart-total").textContent).toMatch(/^100,00\s?US\$$/)
  })
})
