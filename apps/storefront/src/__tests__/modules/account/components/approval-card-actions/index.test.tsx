import { render, screen } from "@testing-library/react"
import { ApprovalStatusType, ApprovalType } from "@/types/approval"

jest.mock("@/lib/data/approvals", () => ({
  updateApproval: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}))

import ApprovalCardActions from "@/modules/account/components/approval-card-actions"

describe("ApprovalCardActions", () => {
  it("renders the extracted 'Reject'/'Approve' labels unchanged", () => {
    const cartWithApprovals = {
      id: "cart-1",
      approval_status: { status: ApprovalStatusType.PENDING },
      approvals: [
        { id: "approval-1", type: ApprovalType.ADMIN, status: ApprovalStatusType.PENDING },
      ],
    } as any

    render(<ApprovalCardActions cartWithApprovals={cartWithApprovals} />)

    expect(screen.getByText("Reject")).toBeInTheDocument()
    expect(screen.getByText("Approve")).toBeInTheDocument()
  })

  it("renders the extracted 'Awaiting External Approval' label unchanged", () => {
    const cartWithApprovals = {
      id: "cart-1",
      approval_status: { status: ApprovalStatusType.PENDING },
      approvals: [
        { id: "approval-1", type: ApprovalType.SALES_MANAGER, status: ApprovalStatusType.PENDING },
      ],
    } as any

    render(<ApprovalCardActions cartWithApprovals={cartWithApprovals} />)

    expect(
      screen.getByText("Awaiting External Approval")
    ).toBeInTheDocument()
  })

  it("renders the extracted 'Place Order' label unchanged", () => {
    const cartWithApprovals = {
      id: "cart-1",
      approval_status: { status: ApprovalStatusType.APPROVED },
      approvals: [
        { id: "approval-1", type: ApprovalType.ADMIN, status: ApprovalStatusType.APPROVED },
      ],
    } as any

    render(<ApprovalCardActions cartWithApprovals={cartWithApprovals} />)

    expect(screen.getByText("Place Order")).toBeInTheDocument()
  })
})
