import { render, screen } from "@testing-library/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { B2BCart } from "@/types"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/us/checkout"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

jest.mock("@/lib/data/cart", () => ({
  setShippingAddress: jest.fn(),
}))

import ShippingAddress from "@/modules/checkout/components/shipping-address"

describe("ShippingAddress", () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue("/us/checkout")
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn() })
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams())
  })

  it("renders the extracted heading unchanged", () => {
    const cart = {} as unknown as B2BCart
    render(<ShippingAddress cart={cart} customer={null} />)

    expect(screen.getByText("Shipping Address")).toBeInTheDocument()
  })
})
