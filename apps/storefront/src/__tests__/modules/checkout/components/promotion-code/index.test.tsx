import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useActionState } from "react"
import { usePathname } from "next/navigation"
import type { B2BCart } from "@/types"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/us/cart"),
}))

// Delegates to the real hook unless a test overrides it (TC-6).
jest.mock("react", () => {
  const actual = jest.requireActual("react")
  return { ...actual, useActionState: jest.fn(actual.useActionState) }
})

jest.mock("@/lib/data/cart", () => ({
  applyPromotions: jest.fn(),
  submitPromotionForm: jest.fn(),
}))

import PromotionCode from "@/modules/checkout/components/promotion-code"

describe("PromotionCode", () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue("/us/cart")
  })

  it("renders the extracted toggle label and reveals the 'Apply' button unchanged", () => {
    const cart = { promotions: [] } as unknown as B2BCart
    render(<PromotionCode cart={cart} />)

    fireEvent.click(
      screen.getByRole("button", { name: /Enter Promotion Code/ })
    )

    expect(
      screen.getByRole("button", { name: "Apply" })
    ).toBeInTheDocument()
  })

  it("renders the extracted singular/plural 'applied' heading unchanged", () => {
    const cart = {
      promotions: [{ id: "promo-1", code: "SAVE10", is_automatic: true }],
    } as unknown as B2BCart
    render(<PromotionCode cart={cart} />)

    expect(screen.getByText("Promotion applied:")).toBeInTheDocument()
  })

  it("renders the extracted plural heading when multiple promotions are applied", () => {
    const cart = {
      promotions: [
        { id: "promo-1", code: "SAVE10", is_automatic: true },
        { id: "promo-2", code: "SAVE20", is_automatic: true },
      ],
    } as unknown as B2BCart
    render(<PromotionCode cart={cart} />)

    expect(screen.getByText("Promotions applied:")).toBeInTheDocument()
  })

  it("shows the translated promotion error instead of the raw message (TC-6)", async () => {
    // The form's action is addPromotionCode, so submitPromotionForm's action
    // state cannot be reached through the UI; stub the state it would return.
    ;(useActionState as jest.Mock).mockReturnValue([
      "The promotion code X is invalid.",
      jest.fn(),
      false,
    ])
    const cart = { promotions: [] } as unknown as B2BCart
    render(<PromotionCode cart={cart} />)

    await userEvent.click(
      screen.getByRole("button", { name: /Enter Promotion Code/ })
    )

    expect(screen.getByTestId("discount-error-message")).toHaveTextContent(
      "This code could not be applied. Check the code and try again."
    )
    expect(screen.queryByText(/is invalid/)).not.toBeInTheDocument()
    ;(useActionState as jest.Mock).mockImplementation(
      jest.requireActual("react").useActionState
    )
  })
})
