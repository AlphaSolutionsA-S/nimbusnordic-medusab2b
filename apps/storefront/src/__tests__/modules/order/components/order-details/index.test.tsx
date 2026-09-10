import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

import OrderDetails from "@/modules/order/components/order-details"

const order = {
  created_at: "2026-01-01T00:00:00.000Z",
  display_id: 42,
  email: "jane@example.com",
} as unknown as HttpTypes.StoreOrder

describe("OrderDetails", () => {
  it("renders all extracted strings unchanged", async () => {
    const element = await OrderDetails({ order })
    render(element)

    expect(screen.getByText("Details")).toBeInTheDocument()
    expect(screen.getByText("Order Number")).toBeInTheDocument()
    expect(screen.getByText("Order Date")).toBeInTheDocument()
    expect(
      screen.getByText(/We have sent the order confirmation details to/)
    ).toBeInTheDocument()
    expect(screen.getByText("jane@example.com")).toBeInTheDocument()
  })
})
