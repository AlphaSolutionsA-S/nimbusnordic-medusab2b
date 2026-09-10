import { render, screen } from "@testing-library/react"
import type { B2BCart } from "@/types"

import CartToCsvButton from "@/modules/cart/components/cart-to-csv-button"

describe("CartToCsvButton", () => {
  it("renders the extracted label unchanged", () => {
    const cart = { items: [] } as unknown as B2BCart

    render(<CartToCsvButton cart={cart} />)

    expect(
      screen.getByRole("button", { name: "Export Cart (.csv)" })
    ).toBeInTheDocument()
  })
})
