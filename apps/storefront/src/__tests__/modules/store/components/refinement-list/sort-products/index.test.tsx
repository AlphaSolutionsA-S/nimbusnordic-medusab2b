import { render, screen } from "@testing-library/react"

import SortProducts from "@/modules/store/components/refinement-list/sort-products"

describe("SortProducts", () => {
  it("renders the extracted label, tooltip, and option labels unchanged", () => {
    render(<SortProducts sortBy="created_at" setQueryParams={() => {}} />)

    expect(screen.getByText("Sort by:")).toBeInTheDocument()
    expect(screen.getByTitle("Sort by")).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Latest Arrivals" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Price: Low -> High" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Price: High -> Low" })
    ).toBeInTheDocument()
  })
})
