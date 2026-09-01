import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/cart", () => ({
  retrieveCart: jest.fn(),
}))
// pending-customer-approvals renders ApprovalCard, which pulls in
// approval-card-actions and `@/lib/data/approvals` at module load time.
jest.mock("@/lib/data/approvals", () => ({
  updateApproval: jest.fn(),
}))
jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}))

import PendingCustomerApprovals from "@/modules/account/components/pending-customer-approvals"

describe("PendingCustomerApprovals", () => {
  it("renders the extracted empty-state copy unchanged", async () => {
    const element = await PendingCustomerApprovals({ cartsWithApprovals: [] })
    render(element)

    expect(screen.getByText("Nothing to see here")).toBeInTheDocument()
    expect(
      screen.getByText("You don't have any approvals yet.")
    ).toBeInTheDocument()
  })
})
