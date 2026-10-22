import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/cart", () => ({
  lookupCart: jest.fn(),
}))
jest.mock("@/lib/data/customer", () => ({
  retrieveCustomer: jest.fn(async () => ({ id: "cus_1" })),
}))
jest.mock("@/lib/context/cart-context", () => ({
  CartProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock("@/modules/cart/templates", () => ({
  __esModule: true,
  default: () => <div data-testid="cart-template-stub" />,
}))
jest.mock("@/modules/common/components/interactive-link", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

import Cart from "@/app/[countryCode]/(main)/cart/page"
import { lookupCart } from "@/lib/data/cart"

describe("cart page", () => {
  it("shows the unavailable notice when the cookie cart is refused", async () => {
    jest.mocked(lookupCart).mockResolvedValueOnce({ status: "unavailable" })

    render(await Cart())

    expect(screen.getByTestId("cart-unavailable-notice")).toBeInTheDocument()
    expect(
      screen.getByText("This cart is no longer available")
    ).toBeInTheDocument()
    expect(screen.queryByTestId("cart-template-stub")).not.toBeInTheDocument()
  })

  it("renders the cart when it is available", async () => {
    jest.mocked(lookupCart).mockResolvedValueOnce({
      status: "found",
      cart: { id: "cart_1" } as Extract<
        Awaited<ReturnType<typeof lookupCart>>,
        { status: "found" }
      >["cart"],
    })

    render(await Cart())

    expect(screen.getByTestId("cart-template-stub")).toBeInTheDocument()
    expect(
      screen.queryByTestId("cart-unavailable-notice")
    ).not.toBeInTheDocument()
  })
})
