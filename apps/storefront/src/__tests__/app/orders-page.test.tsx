import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/approvals", () => ({
  listApprovals: jest.fn(() =>
    Promise.resolve({ carts_with_approvals: [], count: 0 })
  ),
}))
jest.mock("@/lib/data/companies", () => ({
  retrieveCompany: jest.fn(() =>
    Promise.resolve({
      approval_settings: { requires_admin_approval: true },
    })
  ),
}))
jest.mock("@/lib/data/customer", () => ({
  retrieveCustomer: jest.fn(() =>
    Promise.resolve({ id: "customer-1", employee: { company_id: "company-1" } })
  ),
}))
jest.mock("@/lib/data/orders", () => ({
  listOrders: jest.fn(() => Promise.resolve([])),
}))
jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))
// pending-customer-approvals is itself an async Server Component; React's
// client test renderer can't render an unresolved async component as a
// nested element. It has its own dedicated regression test, so stub it here
// — irrelevant to what this test covers (the page's own headings).
jest.mock("@/modules/account/components/pending-customer-approvals", () => ({
  __esModule: true,
  default: () => null,
}))

import Orders from "@/app/[countryCode]/(main)/account/@dashboard/orders/page"

describe("Orders page", () => {
  it("renders the extracted headings unchanged", async () => {
    const element = await Orders()
    render(element)

    expect(screen.getByText("Orders")).toBeInTheDocument()
    expect(screen.getByText("Pending Approvals")).toBeInTheDocument()
    expect(screen.getByText("Completed Orders")).toBeInTheDocument()
  })
})
