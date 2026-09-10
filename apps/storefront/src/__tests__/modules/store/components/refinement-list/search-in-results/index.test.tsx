import { render, screen } from "@testing-library/react"

import SearchInResults from "@/modules/store/components/refinement-list/search-in-results"

describe("SearchInResults", () => {
  it("renders the extracted generic placeholder when no list name is given", () => {
    render(<SearchInResults />)

    expect(
      screen.getByPlaceholderText("Search in products")
    ).toBeInTheDocument()
    expect(
      screen.getByTitle("Install a search provider to enable product search")
    ).toBeInTheDocument()
  })

  it("renders the extracted list-scoped placeholder unchanged", () => {
    render(<SearchInResults listName="Shoes" />)

    expect(
      screen.getByPlaceholderText("Search in Shoes")
    ).toBeInTheDocument()
  })
})
