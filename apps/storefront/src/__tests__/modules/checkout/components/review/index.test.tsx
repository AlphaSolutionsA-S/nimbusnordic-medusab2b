import { render, screen } from "@testing-library/react"
import { useParams } from "next/navigation"
import type { B2BCart, B2BCustomer } from "@/types"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

jest.mock("@/lib/data/cart", () => ({
  createCartApproval: jest.fn(),
  placeOrder: jest.fn(),
}))

import Review from "@/modules/checkout/components/review"

describe("Review", () => {
  it("renders the extracted agreement text with real links unchanged", () => {
    const cart = {
      payment_collection: { payment_sessions: [{ provider_id: "unknown" }] },
    } as unknown as B2BCart

    render(<Review cart={cart} customer={null} />)

    expect(screen.getByRole("link", { name: /Terms of Sale/ })).toHaveAttribute(
      "href",
      "/us/terms-of-sale"
    )
    expect(
      screen.getByRole("link", { name: /Privacy Policy/ })
    ).toHaveAttribute("href", "/us/privacy-policy")
  })

  it("renders the reused spending-limit message and extracted 'Place Order' label when the limit is exceeded", () => {
    const cart = {
      payment_collection: { payment_sessions: [] },
    } as unknown as B2BCart
    const customer = {
      employee: { spending_limit: 100, company: {} },
      orders: [],
    } as unknown as B2BCustomer

    render(<Review cart={{ ...cart, total: 1000 } as B2BCart} customer={customer} />)

    expect(
      screen.getByText(/This order exceeds your spending limit\./)
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Place Order" })
    ).toBeInTheDocument()
  })
})
