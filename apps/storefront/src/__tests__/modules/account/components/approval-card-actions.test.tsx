const mockPush = jest.fn()

jest.mock("next/navigation", () => ({
  useParams: () => ({ countryCode: "dk" }),
  useRouter: () => ({ push: mockPush }),
}))
jest.mock("@/lib/data/approvals", () => ({
  updateApproval: jest.fn(),
}))
jest.mock("@medusajs/ui", () => ({
  ...jest.requireActual("@medusajs/ui"),
  usePrompt: () => jest.fn(),
}))

import { fireEvent, render, screen } from "@testing-library/react"

import ApprovalCardActions from "@/modules/account/components/approval-card-actions"
import { ApprovalStatusType, ApprovalType } from "@/types/approval"
import { B2BCart } from "@/types/global"

// Only the fields the component reads; the full cart type is far wider.
const approvedColleagueCart = {
  id: "cart_colleague",
  completed_at: null,
  approval_status: { status: ApprovalStatusType.APPROVED },
  approvals: [{ id: "appr_1", type: ApprovalType.ADMIN, status: ApprovalStatusType.APPROVED }],
} as unknown as B2BCart

// Checkout reads the cart from `cartId`; the middleware would copy `cart_id` into the cart cookie.
describe("ApprovalCardActions place order (NIMBUS-202)", () => {
  it("links to checkout with the colleague cart as cartId, never cart_id", () => {
    render(<ApprovalCardActions cartWithApprovals={approvedColleagueCart} />)

    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("href", "/dk/checkout?cartId=cart_colleague&step=payment")
  })

  it("navigates to the same checkout URL when the button is pressed", () => {
    render(<ApprovalCardActions cartWithApprovals={approvedColleagueCart} />)

    fireEvent.click(screen.getByRole("button"))

    expect(mockPush).toHaveBeenCalledWith("/dk/checkout?cartId=cart_colleague&step=payment")
  })
})
