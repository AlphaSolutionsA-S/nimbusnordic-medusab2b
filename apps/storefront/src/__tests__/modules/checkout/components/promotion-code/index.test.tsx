import { fireEvent, render, screen } from "@testing-library/react"
import { usePathname } from "next/navigation"
import type { B2BCart } from "@/types"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/us/cart"),
}))

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
})
