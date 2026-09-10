import { fireEvent, render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

// react-markdown ships ESM-only and this app's Jest transform isn't
// configured for it; stub it with a plain passthrough since markdown
// rendering itself isn't under test here.
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import ProductTabs from "@/modules/products/components/product-tabs"

const product = {
  description: "A great product",
  weight: 500,
  height: 10,
  width: 20,
  length: 30,
} as unknown as HttpTypes.StoreProduct

describe("ProductTabs", () => {
  it("renders the extracted tab labels unchanged", () => {
    render(<ProductTabs product={product} />)

    expect(screen.getByText("Description")).toBeInTheDocument()
    expect(screen.getByText("Specifications")).toBeInTheDocument()
  })

  it("renders the extracted specification labels/values unchanged", () => {
    render(<ProductTabs product={product} />)

    fireEvent.click(screen.getByText("Specifications"))

    expect(screen.getByText("Weight")).toBeInTheDocument()
    expect(screen.getByText("500 grams")).toBeInTheDocument()
    expect(screen.getByText("Dimensions (HxWxL)")).toBeInTheDocument()
    expect(screen.getByText("10mm x 20mm x 30mm")).toBeInTheDocument()
  })
})
