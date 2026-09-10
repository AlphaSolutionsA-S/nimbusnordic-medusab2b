import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

// Own extraction areas — stubbed to isolate CategoryTemplate's own strings.
jest.mock("@/modules/categories/category-breadcrumb", () => ({
  __esModule: true,
  default: () => <div data-testid="category-breadcrumb-stub" />,
}))
jest.mock("@/modules/store/components/refinement-list", () => ({
  __esModule: true,
  default: () => <div data-testid="refinement-list-stub" />,
}))

jest.mock("@/lib/data/cart-event-bus", () => ({
  addToCartEventBus: { emitCartAdd: jest.fn(), onCartAdd: jest.fn() },
}))

import CategoryTemplate from "@/modules/categories/templates"

const currentCategory = {
  id: "cat-1",
  name: "Shoes",
  products: [],
} as unknown as HttpTypes.StoreProductCategory

describe("CategoryTemplate", () => {
  it("renders the extracted empty-state message and CTA unchanged", async () => {
    const element = await CategoryTemplate({
      categories: [currentCategory],
      currentCategory,
      countryCode: "us",
    })
    render(element)

    expect(
      screen.getByText("No products found for this category.")
    ).toBeInTheDocument()
    expect(screen.getByText(/Back to all products/)).toBeInTheDocument()
  })
})
