import { fireEvent, render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"
import { ModuleCompanySpendingLimitResetFrequency } from "@/types"

jest.mock("@/lib/data/companies", () => ({
  updateCompany: jest.fn(),
}))

import CompanyCard from "@/modules/account/components/company-card"

const company = {
  id: "company-1",
  name: "Acme",
  email: "acme@example.com",
  phone: "12345",
  address: "1 Main St",
  city: "Metropolis",
  state: "NY",
  zip: "10001",
  country: "us",
  currency_code: "usd",
  spending_limit_reset_frequency: ModuleCompanySpendingLimitResetFrequency.MONTHLY,
} as any

const regions = [
  { currency_code: "usd", countries: [{ id: "us", name: "United States" }] },
] as unknown as HttpTypes.StoreRegion[]

describe("CompanyCard", () => {
  it("renders the extracted display-mode labels unchanged", () => {
    render(<CompanyCard company={company} regions={regions} />)

    expect(screen.getAllByText("Company Name").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Email").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Phone").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Address").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Currency").length).toBeGreaterThan(0)
    expect(
      screen.getAllByText("Spending Limit Reset Frequency").length
    ).toBeGreaterThan(0)
    expect(screen.getByText("Edit")).toBeInTheDocument()
  })

  it("renders the extracted edit-mode field labels unchanged", () => {
    render(<CompanyCard company={company} regions={regions} />)

    fireEvent.click(screen.getByText("Edit"))

    expect(screen.getAllByText("City").length).toBeGreaterThan(0)
    expect(screen.getAllByText("State").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Zip").length).toBeGreaterThan(0)
    expect(screen.getByText("Country")).toBeInTheDocument()
    expect(screen.getByText("Cancel")).toBeInTheDocument()
    expect(screen.getByText("Save")).toBeInTheDocument()
  })
})
