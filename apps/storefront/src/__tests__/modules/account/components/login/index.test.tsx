import { render, screen } from "@testing-library/react"

jest.mock("@/lib/data/customer", () => ({
  login: jest.fn(),
}))

import Login from "@/modules/account/components/login"

jest.mock("next/navigation", () => ({
  useParams: () => ({ countryCode: "dk" }),
}))

describe("Login", () => {
  it("links signed-out customers to public recovery", () => {
    render(<Login setCurrentView={() => {}} />)
    expect(
      screen.getByRole("link", { name: "Forgot password?" })
    ).toHaveAttribute("href", "/dk/forgot-password")
  })
  it("TC-1: renders extracted strings unchanged", () => {
    render(<Login setCurrentView={() => {}} />)

    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByText("Password")).toBeInTheDocument()
    expect(
      screen.getByTitle("Enter a valid email address.")
    ).toBeInTheDocument()
    expect(screen.getByText("Remember me")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument()
  })

  it("TC-2: renders the rich-text heading with a real <br> element", () => {
    render(<Login setCurrentView={() => {}} />)

    const page = screen.getByTestId("login-page")
    const br = page.querySelector("br")

    expect(br).not.toBeNull()
    expect(page.textContent).toContain("Log in for faster")
    expect(page.textContent).toContain("checkout.")
  })
})
