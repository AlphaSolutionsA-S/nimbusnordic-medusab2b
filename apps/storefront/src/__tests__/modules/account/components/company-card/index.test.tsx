import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"
import { ModuleCompanySpendingLimitResetFrequency, QueryCompany } from "@/types"

import CompanyCard from "@/modules/account/components/company-card"

const basicCompany: QueryCompany = {
  id: "company-1",
  name: "Acme",
  email: "acme@example.com",
  phone: "12345",
  address: "1 Main St",
  city: "Metropolis",
  state: "NY",
  zip: "10001",
  country: "us",
  logo_url: null,
  currency_code: "usd",
  vat_number: "US123456",
  business_central_customer_number: "00011551",
  created_at: "2026-08-19T00:00:00.000Z",
  updated_at: "2026-08-19T00:00:00.000Z",
  deleted_at: null,
}

const regions = [
  {
    currency_code: "usd",
    countries: [{ iso_2: "us", display_name: "United States" }],
  },
] as unknown as HttpTypes.StoreRegion[]

function valueFor(label: string): string | null | undefined {
  const row = screen.getByText(label).closest("div")
  return row?.querySelector("dd")?.textContent
}

describe("CompanyCard (read-only)", () => {
  it("TC-1: renders basic company data as a label/value list", () => {
    render(<CompanyCard company={basicCompany} regions={regions} />)

    expect(valueFor("Company Name")).toBe("Acme")
    expect(valueFor("Email")).toBe("acme@example.com")
    expect(valueFor("Phone")).toBe("12345")
    expect(valueFor("Address")).toBe("1 Main St")
    expect(valueFor("City")).toBe("Metropolis")
    expect(valueFor("State")).toBe("NY")
    expect(valueFor("Zip")).toBe("10001")
    expect(valueFor("Country")).toBe("United States")
    expect(valueFor("Currency")).toBe("USD ($)")
    expect(valueFor("VAT Number")).toBe("US123456")
    expect(valueFor("BC Customer Number")).toBe("00011551")
  })

  it("TC-1: keeps labels visible with empty values when basic data is missing", () => {
    render(
      <CompanyCard
        company={{
          ...basicCompany,
          phone: null,
          address: null,
          city: null,
          state: null,
          zip: null,
          country: null,
          vat_number: null,
          business_central_customer_number: null,
        }}
        regions={[]}
      />
    )

    for (const label of [
      "Phone",
      "Address",
      "City",
      "State",
      "Zip",
      "Country",
      "VAT Number",
      "BC Customer Number",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
      expect(valueFor(label)).toBe("")
    }
  })

  it("TC-2: renders server-authorized financial values", () => {
    render(
      <CompanyCard
        company={{
          ...basicCompany,
          credit_limit: 12345.67,
          blocked: "Invoice",
          spending_limit_reset_frequency:
            ModuleCompanySpendingLimitResetFrequency.MONTHLY,
        }}
        regions={regions}
      />
    )

    expect(valueFor("Credit Limit")).toBe("$12,345.67")
    expect(valueFor("Blocked")).toBe("Blocked for invoicing")
    expect(valueFor("Spending Limit Reset Frequency")).toBe("Monthly")
  })

  it("TC-3: renders no financial rows when the server omits their keys", () => {
    render(<CompanyCard company={basicCompany} regions={regions} />)

    expect(screen.queryByText("Credit Limit")).not.toBeInTheDocument()
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Spending Limit Reset Frequency")
    ).not.toBeInTheDocument()
  })

  it("TC-4: renders no company edit controls", () => {
    const { container } = render(
      <CompanyCard
        company={{ ...basicCompany, credit_limit: 1, blocked: "not_blocked" }}
        regions={regions}
      />
    )

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(container.querySelector("form, input, select, textarea")).toBeNull()
    for (const label of ["Edit", "Save", "Cancel"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
  })
})
