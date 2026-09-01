import { render, screen } from "@testing-library/react"
import { useParams } from "next/navigation"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

jest.mock("@/lib/data/categories", () => ({
  listCategories: jest.fn(async () => []),
}))

jest.mock("@/lib/data/collections", () => ({
  listCollections: jest.fn(async () => ({ collections: [] })),
}))

// Own extraction area, covered by its own test — stubbed here since async
// Server Components can't be rendered directly by RTL when nested (only the
// top-level component under test is resolved via `await Footer()`).
jest.mock("@/modules/layout/components/medusa-cta", () => ({
  __esModule: true,
  default: () => <div data-testid="medusa-cta-stub" />,
}))

import Footer from "@/modules/layout/templates/footer"

describe("Footer", () => {
  beforeEach(() => {
    ;(useParams as jest.Mock).mockReturnValue({ countryCode: "us" })
  })

  it("TC-3: renders extracted strings unchanged for the en locale", async () => {
    const element = await Footer()
    render(element)

    expect(screen.getByText("Medusa Store")).toBeInTheDocument()
    expect(screen.getByText("Medusa")).toBeInTheDocument()
    expect(screen.getByText("GitHub")).toBeInTheDocument()
    expect(screen.getByText("Documentation")).toBeInTheDocument()
    expect(screen.getByText("Source code")).toBeInTheDocument()
    expect(
      screen.getByText(
        `© ${new Date().getFullYear()} Medusa Store. All rights reserved.`
      )
    ).toBeInTheDocument()
  })

  it("TC-3: renders category/collection headings only when data is present", async () => {
    const element = await Footer()
    render(element)

    expect(screen.queryByText("Categories")).not.toBeInTheDocument()
    expect(screen.queryByText("Collections")).not.toBeInTheDocument()
  })
})
