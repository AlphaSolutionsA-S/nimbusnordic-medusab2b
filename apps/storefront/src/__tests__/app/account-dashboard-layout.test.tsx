import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/customer", () => ({
  retrieveCustomer: jest.fn(() => Promise.resolve(null)),
}))
jest.mock("@/lib/data/approvals", () => ({
  listApprovals: jest.fn(() =>
    Promise.resolve({ carts_with_approvals: [], count: 0 })
  ),
}))
// account-layout is itself an async Server Component; React's client test
// renderer can't render an unresolved async component as a nested element,
// and it's irrelevant to what this test covers (the layout's own banner alt).
jest.mock("@/modules/account/templates/account-layout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}))

import AccountPageLayout from "@/app/[countryCode]/(main)/account/@dashboard/layout"

describe("AccountPageLayout", () => {
  it("renders the reused banner alt text unchanged", async () => {
    const element = await AccountPageLayout({ children: <div>content</div> })
    render(element)

    expect(
      screen.getByAltText("Login banner background")
    ).toBeInTheDocument()
  })
})
