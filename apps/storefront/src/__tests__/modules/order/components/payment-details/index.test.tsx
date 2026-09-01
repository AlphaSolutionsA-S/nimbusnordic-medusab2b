import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

import PaymentDetails from "@/modules/order/components/payment-details"

const order = {
  currency_code: "usd",
  payment_collections: [
    {
      payments: [
        {
          provider_id: "pp_stripe_stripe",
          amount: 100,
          created_at: "2026-01-01T00:00:00.000Z",
          data: { card_last4: "4242" },
        },
      ],
    },
  ],
} as unknown as HttpTypes.StoreOrder

describe("PaymentDetails", () => {
  it("renders the extracted labels and masked card number unchanged", async () => {
    const element = await PaymentDetails({ order })
    render(element)

    expect(screen.getByText("Payment")).toBeInTheDocument()
    expect(screen.getByText("Payment method")).toBeInTheDocument()
    expect(screen.getByText("Payment details")).toBeInTheDocument()
    expect(screen.getByText("**** **** **** 4242")).toBeInTheDocument()
  })
})
