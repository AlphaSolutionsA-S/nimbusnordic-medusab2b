import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/approvals", () => ({
  listApprovals: jest.fn(() =>
    Promise.resolve({ carts_with_approvals: [], count: 0 })
  ),
  updateApproval: jest.fn(),
}))
jest.mock("@/lib/data/cart", () => ({
  retrieveCart: jest.fn(() => Promise.resolve(null)),
}))
jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}))

import Approvals from "@/app/[countryCode]/(main)/account/@dashboard/approvals/page"

describe("Approvals page", () => {
  it("renders the extracted headings unchanged", async () => {
    const element = await Approvals({
      searchParams: Promise.resolve({}),
    })
    render(element)

    expect(screen.getByText("Approvals")).toBeInTheDocument()
    expect(screen.getByText("Pending")).toBeInTheDocument()
    expect(screen.getByText("Approved")).toBeInTheDocument()
    expect(screen.getByText("Rejected")).toBeInTheDocument()
  })
})
