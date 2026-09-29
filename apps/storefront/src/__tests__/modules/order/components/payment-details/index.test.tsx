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
    expect(screen.getByTestId("payment-method")).toHaveTextContent("Credit card")
  })

  it("translates the payment method title at render time (TC-1)", async () => {
    const invoiceOrder = {
      currency_code: "usd",
      payment_collections: [
        {
          payments: [
            {
              provider_id: "pp_system_default",
              amount: 100,
              created_at: "2026-01-01T00:00:00.000Z",
              data: {},
            },
          ],
        },
      ],
    } as unknown as HttpTypes.StoreOrder

    render(await PaymentDetails({ order: invoiceOrder }))

    expect(screen.getByTestId("payment-method")).toHaveTextContent("Pay by invoice")
  })
})
