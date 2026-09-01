import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/account/bcorders"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

import BcOrderFilters from "@/modules/account/components/bc-order-filters"

describe("BcOrderFilters", () => {
  it("renders the extracted filter labels and buttons unchanged", () => {
    render(<BcOrderFilters />)

    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("All statuses")).toBeInTheDocument()
    expect(screen.getByText("From")).toBeInTheDocument()
    expect(screen.getByText("To")).toBeInTheDocument()
    expect(screen.getByText("Search")).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText("Order number…")
    ).toBeInTheDocument()
    expect(screen.getByText("Clear")).toBeInTheDocument()
  })
})
