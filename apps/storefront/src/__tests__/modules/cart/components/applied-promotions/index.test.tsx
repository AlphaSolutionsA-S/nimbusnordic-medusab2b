import { render, screen } from "@testing-library/react"

import AppliedPromotions from "@/modules/cart/components/applied-promotions"

describe("AppliedPromotions", () => {
  it("renders the extracted label unchanged", () => {
    render(<AppliedPromotions promotions={[]} />)

    expect(screen.getByText("Promotions applied:")).toBeInTheDocument()
  })
})
