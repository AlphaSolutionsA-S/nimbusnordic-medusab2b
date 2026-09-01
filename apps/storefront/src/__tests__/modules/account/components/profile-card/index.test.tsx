import { fireEvent, render, screen } from "@testing-library/react"
import type { B2BCustomer } from "@/types/global"

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ refresh: jest.fn() })),
}))

jest.mock("@/lib/data/customer", () => ({
  updateCustomer: jest.fn(),
  updatePassword: jest.fn(),
}))

import ProfileCard from "@/modules/account/components/profile-card"

const customer = {
  first_name: "Jane",
  last_name: "Doe",
  email: "jane@example.com",
  phone: "12345",
} as unknown as B2BCustomer

describe("ProfileCard", () => {
  it("renders the extracted display-mode labels unchanged", () => {
    render(<ProfileCard customer={customer} />)

    expect(screen.getAllByText("First Name").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Last Name").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Email").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Phone").length).toBeGreaterThan(0)
    expect(screen.getByText("Edit")).toBeInTheDocument()
    expect(screen.getByText("Change Password")).toBeInTheDocument()
    expect(screen.getAllByText("Password").length).toBeGreaterThan(0)
  })

  it("renders the extracted edit-mode action labels unchanged", () => {
    render(<ProfileCard customer={customer} />)

    fireEvent.click(screen.getByText("Edit"))

    expect(screen.getByText("Cancel")).toBeInTheDocument()
    expect(screen.getByText("Save")).toBeInTheDocument()
  })

  it("renders the extracted password-section labels unchanged", () => {
    render(<ProfileCard customer={customer} />)

    fireEvent.click(screen.getByText("Change Password"))

    expect(screen.getAllByText("Current Password").length).toBeGreaterThan(0)
    expect(screen.getAllByText("New Password").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Confirm Password").length).toBeGreaterThan(0)
  })
})
