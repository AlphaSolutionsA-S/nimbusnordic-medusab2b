import { render, screen } from "@testing-library/react"
import { useParams } from "next/navigation"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

jest.mock("@/lib/data/cart", () => ({
  retrieveCart: jest.fn(async () => ({ items: [] })),
}))

jest.mock("@/lib/data/customer", () => ({
  retrieveCustomer: jest.fn(async () => null),
}))

// Sub-trees below are not under test here (own extraction areas) — stubbed to
// keep this test focused on NavigationHeader's own extracted strings.
jest.mock("@/modules/layout/components/mega-menu", () => ({
  MegaMenuWrapper: () => <div data-testid="mega-menu-stub" />,
}))
jest.mock("@/modules/account/components/account-button", () => ({
  __esModule: true,
  default: () => <div data-testid="account-button-stub" />,
}))
jest.mock("@/modules/cart/components/cart-button", () => ({
  __esModule: true,
  default: () => <div data-testid="cart-button-stub" />,
}))
jest.mock("@/modules/skeletons/components/skeleton-account-button", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@/modules/skeletons/components/skeleton-cart-button", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@/modules/skeletons/components/skeleton-mega-menu", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@/modules/quotes/components/request-quote-confirmation", () => ({
  RequestQuoteConfirmation: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))
jest.mock("@/modules/quotes/components/request-quote-prompt", () => ({
  RequestQuotePrompt: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

import { NavigationHeader } from "@/modules/layout/templates/nav"

describe("NavigationHeader", () => {
  beforeEach(() => {
    ;(useParams as jest.Mock).mockReturnValue({ countryCode: "us" })
  })

  it("TC-1: renders extracted strings unchanged for the en locale", async () => {
    const element = await NavigationHeader()
    render(element)

    expect(screen.getByText("Medusa B2B Starter")).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText("Search for products")
    ).toBeInTheDocument()
    expect(
      screen.getByTitle("Install a search provider to enable product search")
    ).toBeInTheDocument()
    expect(screen.getByText("Quote")).toBeInTheDocument()
  })
})
