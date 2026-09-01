import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

import BillingDetails from "@/modules/order/components/billing-details"

const order = {
  billing_address: { company: "Acme", first_name: "Jane", last_name: "Doe" },
} as unknown as HttpTypes.StoreOrder

describe("BillingDetails", () => {
  it("renders the extracted heading unchanged", async () => {
    const element = await BillingDetails({ order })
    render(element)

    expect(screen.getByText("Billing Address")).toBeInTheDocument()
  })
})
