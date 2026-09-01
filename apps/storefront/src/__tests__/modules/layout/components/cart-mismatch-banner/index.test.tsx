import { fireEvent, render, screen } from "@testing-library/react"
import type { B2BCart, B2BCustomer } from "@/types/global"

jest.mock("@/lib/data/customer", () => ({
  transferCart: jest.fn(async () => undefined),
}))

import CartMismatchBanner from "@/modules/layout/components/cart-mismatch-banner"

const mockCustomer = { id: "cust-1" } as B2BCustomer
const mockCart = { id: "cart-1", customer_id: null } as unknown as B2BCart

describe("CartMismatchBanner", () => {
  it("TC-1: renders the extracted message and button label unchanged", () => {
    render(<CartMismatchBanner customer={mockCustomer} cart={mockCart} />)

    expect(
      screen.getByText("Cart is not connected to your account")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Connect cart" })
    ).toBeInTheDocument()
  })

  it("TC-1: shows the extracted pending label while connecting", () => {
    render(<CartMismatchBanner customer={mockCustomer} cart={mockCart} />)

    fireEvent.click(screen.getByRole("button", { name: "Connect cart" }))

    expect(
      screen.getByRole("button", { name: "Connecting.." })
    ).toBeInTheDocument()
  })
})
