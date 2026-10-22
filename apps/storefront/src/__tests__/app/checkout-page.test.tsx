import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/cart", () => ({
  lookupCart: jest.fn(),
}))
jest.mock("@/lib/data/customer", () => ({
  retrieveCustomer: jest.fn(async () => ({ id: "cus_1" })),
}))
jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))
jest.mock("@/modules/checkout/components/payment-wrapper", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock("@/modules/checkout/templates/checkout-form", () => ({
  __esModule: true,
  default: ({ cart }: { cart: { id: string } }) => (
    <div data-testid="checkout-form-stub" data-cart-id={cart.id} />
  ),
}))
jest.mock("@/modules/checkout/templates/checkout-summary", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@/modules/common/components/interactive-link", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

import Checkout from "@/app/[countryCode]/(checkout)/checkout/page"
import { lookupCart } from "@/lib/data/cart"
import { B2BCart } from "@/types/global"
import { notFound } from "next/navigation"

describe("checkout page", () => {
  it("shows the unavailable notice when the cart is refused", async () => {
    jest.mocked(lookupCart).mockResolvedValueOnce({ status: "unavailable" })

    render(await Checkout({ searchParams: Promise.resolve({ cartId: "cart_colleague" }) }))

    expect(jest.mocked(lookupCart)).toHaveBeenCalledWith("cart_colleague")
    expect(screen.getByTestId("cart-unavailable-notice")).toBeInTheDocument()
    expect(screen.queryByTestId("checkout-form-stub")).not.toBeInTheDocument()
  })

  it("opens the colleague cart named by cartId, not the cookie cart, without redirecting", async () => {
    jest.mocked(lookupCart).mockResolvedValueOnce({
      status: "found",
      cart: { id: "cart_colleague" } as unknown as B2BCart,
    })

    render(
      await Checkout({
        searchParams: Promise.resolve({ cartId: "cart_colleague", step: "payment" }),
      })
    )

    expect(jest.mocked(lookupCart)).toHaveBeenCalledWith("cart_colleague")
    expect(screen.getByTestId("checkout-form-stub")).toHaveAttribute("data-cart-id", "cart_colleague")
    expect(jest.mocked(notFound)).not.toHaveBeenCalled()
  })

  it("falls back to the cookie cart when the search params have no cartId", async () => {
    jest.mocked(lookupCart).mockResolvedValueOnce({
      status: "found",
      cart: { id: "cart_own" } as unknown as B2BCart,
    })

    render(await Checkout({ searchParams: Promise.resolve({ step: "payment" }) }))

    expect(jest.mocked(lookupCart)).toHaveBeenCalledWith(undefined)
    expect(screen.getByTestId("checkout-form-stub")).toHaveAttribute("data-cart-id", "cart_own")
  })

  it("keeps not-found when there is no cart", async () => {
    jest.mocked(lookupCart).mockResolvedValueOnce({ status: "none" })

    await expect(Checkout({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    )
  })
})
