import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

jest.mock("@/lib/data/customer", () => ({
  signup: jest.fn(),
}))

import Register from "@/modules/account/components/register"

const regions = [] as HttpTypes.StoreRegion[]

describe("Register", () => {
  it("TC-3: renders all 7 extracted field labels unchanged", () => {
    render(<Register setCurrentView={() => {}} regions={regions} />)

    expect(screen.getByText("First name")).toBeInTheDocument()
    expect(screen.getByText("Last name")).toBeInTheDocument()
    expect(screen.getByText("Company name")).toBeInTheDocument()
    expect(screen.getByText("Company address")).toBeInTheDocument()
    expect(screen.getByText("Company city")).toBeInTheDocument()
    expect(screen.getByText("Company state")).toBeInTheDocument()
    expect(screen.getByText("Company zip")).toBeInTheDocument()
  })

  it("renders remaining extracted strings unchanged", () => {
    render(<Register setCurrentView={() => {}} regions={regions} />)

    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByText("Password")).toBeInTheDocument()
    expect(
      screen.getByText("I agree to the terms and conditions.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Register" })
    ).toBeInTheDocument()
    expect(screen.getByText(/Already a member\?/)).toBeInTheDocument()
    expect(screen.getByText("Log in")).toBeInTheDocument()
  })
})
