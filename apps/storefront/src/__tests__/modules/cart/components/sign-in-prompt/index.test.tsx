import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import SignInPrompt from "@/modules/cart/components/sign-in-prompt"

describe("SignInPrompt", () => {
  it("renders all extracted strings unchanged", () => {
    render(<SignInPrompt />)

    expect(screen.getByAltText("Login banner background")).toBeInTheDocument()
    expect(screen.getByText(/Log in for/)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Register" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Log in" })
    ).toBeInTheDocument()
  })
})
