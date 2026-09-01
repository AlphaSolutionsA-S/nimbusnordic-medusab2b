import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/companies", () => ({
  createEmployee: jest.fn(),
}))

import InviteEmployeeCard from "@/modules/account/components/invite-employee-card"

const company = { id: "company-1" } as any

describe("InviteEmployeeCard", () => {
  it("renders the extracted field labels and submit button unchanged", () => {
    render(<InviteEmployeeCard company={company} />)

    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByText("Initial password")).toBeInTheDocument()
    expect(screen.getByText("Send Invite")).toBeInTheDocument()
  })
})
