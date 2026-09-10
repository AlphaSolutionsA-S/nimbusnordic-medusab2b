import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

import CollectionBreadcrumb from "@/modules/collections/collection-breadcrumb"

const collection = {
  id: "col-1",
  title: "Summer",
  handle: "summer",
} as unknown as HttpTypes.StoreCollection

describe("CollectionBreadcrumb", () => {
  it("renders the extracted base 'Products' label unchanged", async () => {
    const element = await CollectionBreadcrumb({ collection })
    render(element)

    expect(screen.getByText("Products")).toBeInTheDocument()
    expect(screen.getByText("Summer")).toBeInTheDocument()
  })
})
