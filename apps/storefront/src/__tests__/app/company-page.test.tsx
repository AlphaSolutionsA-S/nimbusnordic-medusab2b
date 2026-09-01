import { render, screen } from "@testing-library/react"
import { ModuleCompanySpendingLimitResetFrequency } from "@/types"

const company = {
  id: "company-1",
  name: "Acme",
  currency_code: "usd",
  spending_limit_reset_frequency: ModuleCompanySpendingLimitResetFrequency.MONTHLY,
  employees: [],
}

jest.mock("@/lib/data/companies", () => ({
  retrieveCompany: jest.fn(() => Promise.resolve(company)),
  updateCompany: jest.fn(),
  updateApprovalSettings: jest.fn(),
  createEmployee: jest.fn(),
}))
jest.mock("@/lib/data/customer", () => ({
  retrieveCustomer: jest.fn(() =>
    Promise.resolve({ id: "customer-1", employee: { company, is_admin: true } })
  ),
}))
jest.mock("@/lib/data/regions", () => ({
  listRegions: jest.fn(() => Promise.resolve([])),
}))
jest.mock("next/navigation", () => ({
  notFound: jest.fn(),
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))
// employees-card is itself an async Server Component; React's client test
// renderer can't render an unresolved async component as a nested element,
// and it's irrelevant to what this test covers (the page's own headings).
jest.mock("@/modules/account/components/employees-card", () => ({
  __esModule: true,
  default: () => null,
}))

import Company from "@/app/[countryCode]/(main)/account/@dashboard/company/page"

describe("Company page", () => {
  it("renders the extracted section headings unchanged", async () => {
    const element = await Company()
    render(element)

    expect(screen.getByText("Company Details")).toBeInTheDocument()
    expect(screen.getByText("Approval Settings")).toBeInTheDocument()
    expect(screen.getByText("Employees")).toBeInTheDocument()
    expect(screen.getByText("Invite Employees")).toBeInTheDocument()
  })
})
