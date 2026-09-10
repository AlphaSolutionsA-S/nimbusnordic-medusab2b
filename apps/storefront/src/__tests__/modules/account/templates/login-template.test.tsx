import { render, screen } from "@testing-library/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { HttpTypes } from "@medusajs/types"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/us/account"),
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

jest.mock("@/modules/account/components/login", () => ({
  __esModule: true,
  default: () => <div data-testid="login-stub" />,
}))
jest.mock("@/modules/account/components/register", () => ({
  __esModule: true,
  default: () => <div data-testid="register-stub" />,
}))

import LoginTemplate from "@/modules/account/templates/login-template"

const regions = [] as HttpTypes.StoreRegion[]

describe("LoginTemplate", () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue("/us/account")
    ;(useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
    })
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams())
  })

  it("renders the extracted banner alt text unchanged", () => {
    render(<LoginTemplate regions={regions} />)

    expect(
      screen.getByAltText("Login banner background")
    ).toBeInTheDocument()
  })
})
