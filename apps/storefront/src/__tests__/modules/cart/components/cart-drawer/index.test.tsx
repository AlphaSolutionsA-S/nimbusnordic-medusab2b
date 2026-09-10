import { fireEvent, render, screen } from "@testing-library/react"
import { usePathname, useParams } from "next/navigation"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/us"),
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

jest.mock("@/lib/context/cart-context", () => ({
  useCart: jest.fn(() => ({ cart: null })),
}))

jest.mock("@/modules/cart/templates/items", () => ({
  __esModule: true,
  default: () => <div data-testid="items-template-stub" />,
}))

jest.mock("@/modules/shipping/components/free-shipping-price-nudge", () => ({
  __esModule: true,
  default: () => <div data-testid="free-shipping-nudge-stub" />,
}))

import { useCart } from "@/lib/context/cart-context"
import CartDrawer from "@/modules/cart/components/cart-drawer"

describe("CartDrawer", () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue("/us")
    ;(useParams as jest.Mock).mockReturnValue({ countryCode: "us" })
  })

  it("renders the extracted 'Cart' fallback label when there is no cart", () => {
    ;(useCart as jest.Mock).mockReturnValue({ cart: null })

    render(<CartDrawer customer={null} freeShippingPrices={[]} />)

    expect(screen.getByText("Cart")).toBeInTheDocument()
  })

  it("renders the extracted items-in-cart title and action labels unchanged", () => {
    ;(useCart as jest.Mock).mockReturnValue({
      cart: {
        items: [{ id: "1", quantity: 2 }],
        promotions: [],
        item_subtotal: 100,
        currency_code: "usd",
      },
    })

    render(<CartDrawer customer={null} freeShippingPrices={[]} />)
    fireEvent.click(screen.getByRole("button", { name: /Cart|\$/ }))

    expect(
      screen.getByText("You have 2 items in your cart")
    ).toBeInTheDocument()
    expect(screen.getByText("Subtotal")).toBeInTheDocument()
    expect(screen.getByText("View Cart")).toBeInTheDocument()
    expect(screen.getByText("Log in to checkout")).toBeInTheDocument()
  })
})
