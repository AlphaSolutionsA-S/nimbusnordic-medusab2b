import { render, screen } from "@testing-library/react"

jest.mock("@/modules/common/components/interactive-link", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

import CartUnavailableNotice from "@/modules/cart/components/cart-unavailable-notice"

describe("CartUnavailableNotice", () => {
  it("renders the translated unavailable copy", () => {
    render(<CartUnavailableNotice />)

    expect(
      screen.getByText("This cart is no longer available")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "This cart can no longer be used with your account. Add a product to start a new cart."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Explore products")).toBeInTheDocument()
  })
})
