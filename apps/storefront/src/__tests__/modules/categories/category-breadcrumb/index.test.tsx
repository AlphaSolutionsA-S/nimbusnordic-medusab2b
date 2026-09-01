import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import CategoryBreadcrumb from "@/modules/categories/category-breadcrumb"

const categories = [
  { id: "cat-1", name: "Shoes", handle: "shoes", parent_category_id: null },
] as unknown as HttpTypes.StoreProductCategory[]

describe("CategoryBreadcrumb", () => {
  it("renders the extracted base 'Products' label unchanged", async () => {
    const element = await CategoryBreadcrumb({
      categories,
      category: categories[0],
    })
    render(element)

    expect(screen.getByText("Products")).toBeInTheDocument()
    expect(screen.getByText("Shoes")).toBeInTheDocument()
  })
})
