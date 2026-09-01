import { render, screen } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"

jest.mock("next/navigation", () => ({
  useParams: jest.fn(() => ({ countryCode: "us" })),
}))

// Own extraction areas — stubbed here since async Server Components can't be
// rendered directly by RTL when nested.
jest.mock("@/modules/order/components/item", () => ({
  __esModule: true,
  default: () => <div data-testid="item-stub" />,
}))
jest.mock("@/modules/order/components/order-details", () => ({
  __esModule: true,
  default: () => <div data-testid="order-details-stub" />,
}))
jest.mock("@/modules/order/components/order-summary", () => ({
  __esModule: true,
  default: () => <div data-testid="order-summary-stub" />,
}))
jest.mock("@/modules/order/components/shipping-details", () => ({
  __esModule: true,
  default: () => <div data-testid="shipping-details-stub" />,
}))
jest.mock("@/modules/order/components/billing-details", () => ({
  __esModule: true,
  default: () => <div data-testid="billing-details-stub" />,
}))

import OrderDetailsTemplate from "@/modules/order/templates/order-details-template"

const order = { id: "order-1", items: [] } as unknown as HttpTypes.StoreOrder

describe("OrderDetailsTemplate", () => {
  it("renders the extracted 'Back' label unchanged", async () => {
    const element = await OrderDetailsTemplate({ order })
    render(element)

    expect(screen.getByText(/Back/)).toBeInTheDocument()
  })
})
