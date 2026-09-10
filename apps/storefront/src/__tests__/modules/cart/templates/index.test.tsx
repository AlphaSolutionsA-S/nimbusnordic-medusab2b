import { render, screen } from "@testing-library/react"

jest.mock("@/lib/context/cart-context", () => ({
  useCart: jest.fn(),
}))
jest.mock("@/modules/cart/components/sign-in-prompt", () => ({
  __esModule: true,
  default: () => <div data-testid="sign-in-prompt-stub" />,
}))
jest.mock("@/modules/cart/components/approval-status-banner", () => ({
  __esModule: true,
  default: () => <div data-testid="approval-status-banner-stub" />,
}))
jest.mock("@/modules/cart/templates/items", () => ({
  __esModule: true,
  default: () => <div data-testid="items-template-stub" />,
}))
jest.mock("@/modules/cart/templates/summary", () => ({
  __esModule: true,
  default: () => <div data-testid="summary-stub" />,
}))

import { useCart } from "@/lib/context/cart-context"
import CartTemplate from "@/modules/cart/templates"

describe("CartTemplate", () => {
  it("renders the extracted items-in-cart heading unchanged", () => {
    ;(useCart as jest.Mock).mockReturnValue({
      cart: {
        items: [{ id: "1", quantity: 3 }],
        region: { id: "region-1" },
      },
    })

    render(<CartTemplate customer={null} />)

    expect(
      screen.getByText("You have 3 items in your cart")
    ).toBeInTheDocument()
  })
})
