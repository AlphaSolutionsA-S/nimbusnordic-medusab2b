import { fireEvent, render, screen } from "@testing-library/react"

jest.mock("@/lib/data/companies", () => ({
  deleteEmployee: jest.fn(),
  updateEmployee: jest.fn(),
}))

import Employee from "@/modules/account/components/employees-card/employee"

const employee = {
  id: "employee-1",
  company_id: "company-1",
  spending_limit: 0,
  is_admin: true,
  customer: {
    id: "customer-1",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    phone: "12345",
  },
} as any

const company = {
  id: "company-1",
  currency_code: "usd",
} as any

describe("Employee", () => {
  it("renders the extracted '(You)' suffix, 'Admin' badge, and spend message unchanged", () => {
    render(
      <Employee
        employee={employee}
        company={company}
        orders={[]}
        customer={{ id: "customer-1" } as any}
      />
    )

    expect(screen.getByText("(You)", { exact: false })).toBeInTheDocument()
    expect(screen.getByText("Admin", { selector: "span" })).toBeInTheDocument()
    expect(screen.getByText(/No limit/)).toBeInTheDocument()
    expect(screen.getByText(/spent/)).toBeInTheDocument()
  })

  it("renders the extracted edit-mode field labels unchanged", () => {
    render(
      <Employee
        employee={employee}
        company={company}
        orders={[]}
        customer={{ id: "other-customer", employee: { is_admin: true } } as any}
      />
    )

    fireEvent.click(screen.getByText("Edit"))

    expect(screen.getByText("Spending Limit")).toBeInTheDocument()
    expect(screen.getByText("Permissions")).toBeInTheDocument()
    expect(screen.getByText("Cancel")).toBeInTheDocument()
    expect(screen.getByText("Save")).toBeInTheDocument()
  })

  it("renders the extracted remove-employee prompt copy unchanged", () => {
    render(
      <Employee
        employee={employee}
        company={company}
        orders={[]}
        customer={{ id: "other-customer", employee: { is_admin: true } } as any}
      />
    )

    fireEvent.click(screen.getByText("Remove"))

    expect(screen.getByText("Remove Employee")).toBeInTheDocument()
    expect(
      screen.getByText(/no longer be able to purchase on behalf/)
    ).toBeInTheDocument()
    expect(
      screen.getByText("Also delete the linked customer account and login")
    ).toBeInTheDocument()
  })
})
