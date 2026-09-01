import { render, screen } from "@testing-library/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { B2BCart } from "@/types"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/us/checkout"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams("step=contact-details")),
}))

jest.mock("@/lib/data/cart", () => ({
  setContactDetails: jest.fn(),
}))

import ContactDetails from "@/modules/checkout/components/contact-details"

const openCart = { id: "cart-1" } as unknown as B2BCart

describe("ContactDetails", () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue("/us/checkout")
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn() })
    ;(useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams("step=contact-details")
    )
  })

  it("TC-1: renders the extracted heading and submit label unchanged", () => {
    render(<ContactDetails cart={openCart} customer={null} />)

    expect(screen.getByText("Contact Details")).toBeInTheDocument()
    expect(screen.getByText("Next step")).toBeInTheDocument()
  })
})
