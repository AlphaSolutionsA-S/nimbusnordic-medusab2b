import { render, screen } from "@testing-library/react"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/account/returns"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

import BcReturnFilters from "@/modules/account/components/bc-return-filters"

describe("BcReturnFilters", () => {
  it("renders the extracted filter labels and buttons unchanged", () => {
    render(<BcReturnFilters />)

    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("All statuses")).toBeInTheDocument()
    expect(screen.getByText("From")).toBeInTheDocument()
    expect(screen.getByText("To")).toBeInTheDocument()
    expect(screen.getByText("Search")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Return number…")).toBeInTheDocument()
    expect(screen.getByText("Clear")).toBeInTheDocument()
  })

  // TC-1: integration — the status dropdown lists "All statuses" plus Open and Released only.
  it("lists the filterable Business Central return statuses", () => {
    render(<BcReturnFilters />)

    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement
    const optionValues = Array.from(statusSelect.options).map((o) => o.value)
    expect(optionValues).toEqual(["", "Open", "Released"])
  })
})
