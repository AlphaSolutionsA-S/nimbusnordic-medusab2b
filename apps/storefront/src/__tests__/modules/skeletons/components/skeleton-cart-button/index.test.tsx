import { render, screen } from "@testing-library/react"

import SkeletonCartButton from "@/modules/skeletons/components/skeleton-cart-button"

describe("SkeletonCartButton", () => {
  it("renders the catalog cart label (TC-5)", () => {
    render(<SkeletonCartButton />)

    expect(screen.getByText("Cart")).toBeInTheDocument()
  })
})
