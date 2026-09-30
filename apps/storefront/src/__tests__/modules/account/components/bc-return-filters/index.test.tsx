import { fireEvent, render, screen } from "@testing-library/react"
import { useSearchParams } from "next/navigation"

const mockPush = jest.fn()

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/account/returns"),
  useRouter: jest.fn(() => ({ push: mockPush })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

import BcReturnFilters from "@/modules/account/components/bc-return-filters"

describe("BcReturnFilters", () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

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

  // TC-2 (NIMBUS-172): the status dropdown offers All, Open and Processed.
  it("offers the All, Open and Processed return states", () => {
    render(<BcReturnFilters />)

    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement
    const optionValues = Array.from(statusSelect.options).map((o) => o.value)
    expect(optionValues).toEqual(["", "open", "processed"])
    expect(screen.getByRole("option", { name: "Open" })).toHaveAttribute("value", "open")
    expect(screen.getByRole("option", { name: "Processed" })).toHaveAttribute(
      "value",
      "processed"
    )
  })

  // TC-3 (NIMBUS-172): choosing a state pushes ?state= and resets the page.
  it("pushes the chosen state and resets the page", () => {
    ;(useSearchParams as jest.Mock).mockReturnValueOnce(new URLSearchParams("page=3"))
    render(<BcReturnFilters />)

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "processed" } })

    expect(mockPush).toHaveBeenCalledWith("/account/returns?state=processed", {
      scroll: false,
    })
  })

  // TC-4 (NIMBUS-172): the current state is preselected.
  it("preselects the current state", () => {
    render(<BcReturnFilters currentState="open" />)

    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("open")
  })
})
