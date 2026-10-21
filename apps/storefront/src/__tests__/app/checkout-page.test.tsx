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
  default: () => <div data-testid="checkout-form-stub" />,
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

describe("checkout page", () => {
  it("shows the unavailable notice when the cart is refused", async () => {
    jest.mocked(lookupCart).mockResolvedValueOnce({ status: "unavailable" })

    render(await Checkout({ searchParams: { cartId: "cart_colleague" } }))

    expect(jest.mocked(lookupCart)).toHaveBeenCalledWith("cart_colleague")
    expect(screen.getByTestId("cart-unavailable-notice")).toBeInTheDocument()
    expect(screen.queryByTestId("checkout-form-stub")).not.toBeInTheDocument()
  })

  it("keeps not-found when there is no cart", async () => {
    jest.mocked(lookupCart).mockResolvedValueOnce({ status: "none" })

    await expect(Checkout({})).rejects.toThrow("NEXT_NOT_FOUND")
  })
})
