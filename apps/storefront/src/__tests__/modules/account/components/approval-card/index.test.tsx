import { render, screen } from "@testing-library/react"
import { ApprovalStatusType } from "@/types/approval"

jest.mock("@/lib/data/cart", () => ({
  retrieveCart: jest.fn(),
}))
// approval-card statically imports approval-card-actions, which pulls in
// `@/lib/data/approvals` at module load time.
jest.mock("@/lib/data/approvals", () => ({
  updateApproval: jest.fn(),
}))
jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}))

import { retrieveCart } from "@/lib/data/cart"
import ApprovalCard from "@/modules/account/components/approval-card"

const mockedRetrieveCart = jest.mocked(retrieveCart)

const cart = {
  id: "cart-1",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  currency_code: "usd",
  total: 100,
  items: [{ id: "item-1", quantity: 2, thumbnail: "/thumb.png", title: "Item" }],
} as any

describe("ApprovalCard", () => {
  it("renders the extracted 'Approved at' label unchanged", async () => {
    mockedRetrieveCart.mockResolvedValue(cart)

    const element = await ApprovalCard({
      cartWithApprovals: {
        ...cart,
        approval_status: { status: ApprovalStatusType.APPROVED },
      } as any,
    })
    render(element)

    expect(screen.getByText(/Approved at/)).toBeInTheDocument()
  })

  it("renders the extracted 'Rejected at' label unchanged", async () => {
    mockedRetrieveCart.mockResolvedValue(cart)

    const element = await ApprovalCard({
      cartWithApprovals: {
        ...cart,
        approval_status: { status: ApprovalStatusType.REJECTED },
      } as any,
    })
    render(element)

    expect(screen.getByText(/Rejected at/)).toBeInTheDocument()
  })

  it("renders the extracted 'Order completed at' label unchanged", async () => {
    mockedRetrieveCart.mockResolvedValue(cart)

    const element = await ApprovalCard({
      cartWithApprovals: {
        ...cart,
        approval_status: { status: ApprovalStatusType.APPROVED },
        completed_at: "2026-01-03T00:00:00.000Z",
      } as any,
    })
    render(element)

    expect(screen.getByText(/Order completed at/)).toBeInTheDocument()
  })

  it("renders the reused plural item count unchanged", async () => {
    const twoLineCart = {
      ...cart,
      items: [
        { id: "item-1", quantity: 2, thumbnail: "/thumb.png", title: "Item 1" },
        { id: "item-2", quantity: 1, thumbnail: "/thumb.png", title: "Item 2" },
      ],
    }
    mockedRetrieveCart.mockResolvedValue(twoLineCart)

    const element = await ApprovalCard({
      cartWithApprovals: twoLineCart,
    })
    render(element)

    expect(screen.getByText("2 items")).toBeInTheDocument()
  })
})
