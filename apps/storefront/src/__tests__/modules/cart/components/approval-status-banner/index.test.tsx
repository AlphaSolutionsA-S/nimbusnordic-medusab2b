import { render, screen } from "@testing-library/react"
import { useParams } from "next/navigation"
import type { B2BCart } from "@/types"
import { ApprovalStatusType } from "@/types/approval"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import ApprovalStatusBanner from "@/modules/cart/components/approval-status-banner"

describe("ApprovalStatusBanner", () => {
  it("renders the extracted pending message unchanged", () => {
    const cart = {
      approval_status: { status: ApprovalStatusType.PENDING },
    } as unknown as B2BCart

    render(<ApprovalStatusBanner cart={cart} />)

    expect(
      screen.getByText("This cart is locked for approval.")
    ).toBeInTheDocument()
  })

  it("renders the extracted rejected message with a real link to the checkout page", () => {
    const cart = {
      approval_status: { status: ApprovalStatusType.REJECTED },
    } as unknown as B2BCart

    render(<ApprovalStatusBanner cart={cart} />)

    const link = screen.getByRole("link", { name: "checkout page" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/us/checkout")
    expect(screen.getByText(/This cart has been rejected/)).toBeInTheDocument()
  })

  it("renders the extracted approved message unchanged", () => {
    const cart = {
      approval_status: { status: ApprovalStatusType.APPROVED },
    } as unknown as B2BCart

    render(<ApprovalStatusBanner cart={cart} />)

    expect(
      screen.getByText(
        "This cart has been approved and can now be completed."
      )
    ).toBeInTheDocument()
  })
})
