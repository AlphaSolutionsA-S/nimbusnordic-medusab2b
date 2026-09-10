import { render, screen } from "@testing-library/react"
import type { B2BCart } from "@/types"
import { ApprovalStatusType } from "@/types/approval"

jest.mock("@/lib/data/cart", () => ({
  createCartApproval: jest.fn(),
  placeOrder: jest.fn(),
}))

import PaymentButton from "@/modules/checkout/components/payment-button"

describe("PaymentButton", () => {
  it("renders the extracted default label when no payment provider matches", () => {
    const cart = {
      shipping_address: {},
      billing_address: {},
      email: "a@b.com",
      shipping_methods: [{}],
      company: {},
      payment_collection: { payment_sessions: [{ provider_id: "unknown" }] },
    } as unknown as B2BCart

    render(<PaymentButton cart={cart} data-testid="submit-order-button" />)

    expect(
      screen.getByRole("button", { name: "Select a payment method" })
    ).toBeInTheDocument()
  })

  it("renders the extracted approval-required message and action label unchanged", () => {
    const cart = {
      shipping_address: {},
      billing_address: {},
      email: "a@b.com",
      shipping_methods: [{}],
      company: {
        approval_settings: { requires_admin_approval: true },
      },
      approval_status: { status: ApprovalStatusType.PENDING },
      payment_collection: { payment_sessions: [] },
    } as unknown as B2BCart

    render(<PaymentButton cart={cart} data-testid="submit-order-button" />)

    expect(
      screen.getByText("This order requires approval by a company admin.")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Approval Requested" })
    ).toBeInTheDocument()
  })
})
