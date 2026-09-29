import { render, screen } from "@testing-library/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import userEvent from "@testing-library/user-event"
import type { B2BCart } from "@/types"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/us/checkout"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

jest.mock("@/lib/data/cart", () => ({
  setShippingMethod: jest.fn(),
}))

import { setShippingMethod } from "@/lib/data/cart"
import Shipping from "@/modules/checkout/components/shipping"

describe("Shipping", () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue("/us/checkout")
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn() })
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams())
  })

  it("renders the extracted heading unchanged", () => {
    const cart = { shipping_methods: [] } as unknown as B2BCart
    render(<Shipping cart={cart} availableShippingMethods={[]} />)

    expect(screen.getByText("Delivery Method")).toBeInTheDocument()
  })

  it("shows a translated error instead of the raw backend message (TC-5)", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams("step=delivery"))
    ;(setShippingMethod as jest.Mock).mockRejectedValueOnce(
      new Error("Shipping option so_1 is invalid.")
    )
    const cart = { id: "cart_1", shipping_methods: [], currency_code: "usd" } as unknown as B2BCart
    render(
      <Shipping
        cart={cart}
        availableShippingMethods={[{ id: "so_1", name: "Standard", amount: 10 } as any]}
      />
    )

    await userEvent.click(screen.getByTestId("delivery-option-radio"))

    expect(await screen.findByTestId("delivery-option-error-message")).toHaveTextContent(
      "Something went wrong. Please try again."
    )
    expect(screen.queryByText(/so_1 is invalid/)).not.toBeInTheDocument()
  })
})
