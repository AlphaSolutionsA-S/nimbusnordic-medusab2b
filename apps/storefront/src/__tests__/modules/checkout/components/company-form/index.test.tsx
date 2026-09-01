import { render, screen } from "@testing-library/react"
import type { B2BCart } from "@/types"

import CompanyForm from "@/modules/checkout/components/company-form"

const cart = {
  company: { name: "Acme Corp" },
} as unknown as B2BCart

describe("CompanyForm", () => {
  it("renders the extracted labels unchanged", () => {
    render(<CompanyForm cart={cart} />)

    expect(
      screen.getByText("Order on behalf of Acme Corp")
    ).toBeInTheDocument()
    expect(screen.getByText("Custom checkout")).toBeInTheDocument()
  })
})
