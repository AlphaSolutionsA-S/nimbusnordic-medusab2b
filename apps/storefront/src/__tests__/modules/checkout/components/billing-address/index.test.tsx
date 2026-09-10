import { render, screen } from "@testing-library/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { B2BCart } from "@/types"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/us/checkout"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

jest.mock("@/lib/data/cart", () => ({
  setBillingAddress: jest.fn(),
  updateCart: jest.fn(),
}))

import BillingAddress from "@/modules/checkout/components/billing-address"

describe("BillingAddress", () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue("/us/checkout")
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn() })
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams())
  })

  it("renders the extracted heading unchanged", () => {
    const cart = {} as unknown as B2BCart
    render(<BillingAddress cart={cart} />)

    expect(screen.getByText("Billing Address")).toBeInTheDocument()
  })
})
