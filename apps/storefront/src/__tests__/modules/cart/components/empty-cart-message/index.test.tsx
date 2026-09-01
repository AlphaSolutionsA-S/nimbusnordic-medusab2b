import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import EmptyCartMessage from "@/modules/cart/components/empty-cart-message"

describe("EmptyCartMessage", () => {
  it("renders all extracted strings unchanged", () => {
    render(<EmptyCartMessage />)

    expect(
      screen.getByRole("heading", { name: "Cart" })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "You don't have anything in your cart. Let's change that, use the link below to start browsing our products."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Explore products" })
    ).toBeInTheDocument()
  })
})
