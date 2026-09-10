import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

import ShippingDetails from "@/modules/order/components/shipping-details"

const order = {
  shipping_address: { company: "Acme", first_name: "Jane", last_name: "Doe" },
} as unknown as HttpTypes.StoreOrder

describe("ShippingDetails", () => {
  it("renders the extracted heading unchanged", async () => {
    const element = await ShippingDetails({ order })
    render(element)

    expect(screen.getByText("Delivery Address")).toBeInTheDocument()
  })
})
