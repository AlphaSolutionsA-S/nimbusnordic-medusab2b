import { render, screen } from "@testing-library/react"
import type { B2BCart } from "@/types"

const cart = { company: { name: "Acme Corp" } } as unknown as B2BCart

import Company from "@/modules/checkout/components/company"

describe("Company", () => {
  it("renders the extracted heading unchanged", () => {
    render(<Company cart={cart} />)

    expect(screen.getByText("Company")).toBeInTheDocument()
  })
})
