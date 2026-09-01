import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/approvals", () => ({
  listApprovals: jest.fn(),
  updateApproval: jest.fn(),
}))
// pending-list renders ApprovalCard, which pulls in `@/lib/data/cart` at
// module load time.
jest.mock("@/lib/data/cart", () => ({
  retrieveCart: jest.fn(),
}))
jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}))

import { listApprovals } from "@/lib/data/approvals"
import PendingApprovalRequestsAdminList from "@/modules/account/components/approval-requests-admin-list/pending-list"

const mockedListApprovals = jest.mocked(listApprovals)

describe("PendingApprovalRequestsAdminList", () => {
  it("renders the extracted 'No requests' empty state unchanged", async () => {
    mockedListApprovals.mockResolvedValue({
      carts_with_approvals: [],
      count: 0,
    } as any)

    const element = await PendingApprovalRequestsAdminList({
      searchParams: {},
    })
    render(element)

    expect(screen.getByText("No requests")).toBeInTheDocument()
  })
})
