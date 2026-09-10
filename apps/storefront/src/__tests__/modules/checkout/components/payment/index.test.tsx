import { render, screen } from "@testing-library/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/us/checkout"),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

jest.mock("@/lib/data/cart", () => ({
  initiatePaymentSession: jest.fn(),
}))

import Payment from "@/modules/checkout/components/payment"

describe("Payment", () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue("/us/checkout")
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn() })
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams())
  })

  it("renders the extracted heading unchanged", () => {
    const cart = { payment_collection: { payment_sessions: [] } }

    render(<Payment cart={cart} availablePaymentMethods={[]} />)

    expect(screen.getByText("Payment Method")).toBeInTheDocument()
  })

  it("renders the extracted 'Next step' button label when the step is open", () => {
    ;(useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams("step=payment")
    )
    const cart = { payment_collection: { payment_sessions: [] } }

    render(<Payment cart={cart} availablePaymentMethods={[]} />)

    expect(
      screen.getByRole("button", { name: "Next step" })
    ).toBeInTheDocument()
  })
})
