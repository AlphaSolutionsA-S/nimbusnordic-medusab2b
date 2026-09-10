import { render, screen } from "@testing-library/react"
import { usePathname, useSearchParams } from "next/navigation"
import type { HttpTypes } from "@medusajs/types"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/us/categories/shoes"),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import CategoryList from "@/modules/store/components/refinement-list/category-list"

const categories = [
  {
    id: "cat-1",
    name: "Shoes",
    handle: "shoes",
    parent_category_id: null,
    category_children: [],
    products: [],
  },
] as unknown as HttpTypes.StoreProductCategory[]

describe("CategoryList", () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue("/us/categories/shoes")
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams())
  })

  it("renders the extracted heading and 'Clear' link unchanged", () => {
    render(<CategoryList categories={categories} />)

    expect(screen.getByText("Categories")).toBeInTheDocument()
    expect(screen.getByText("Clear")).toBeInTheDocument()
  })
})
