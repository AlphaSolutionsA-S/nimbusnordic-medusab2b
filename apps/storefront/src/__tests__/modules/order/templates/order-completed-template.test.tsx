import { render, screen } from "@testing-library/react"
import type { B2BOrder } from "@/types/global"

// Own extraction areas — stubbed here since async Server Components can't be
// rendered directly by RTL when nested (only the top-level component under
// test is resolved via `await OrderCompletedTemplate(...)`).
jest.mock("@/modules/checkout/components/checkout-totals", () => ({
  __esModule: true,
  default: () => <div data-testid="checkout-totals-stub" />,
}))
jest.mock("@/modules/order/components/help", () => ({
  __esModule: true,
  default: () => <div data-testid="help-stub" />,
}))
jest.mock("@/modules/order/components/items", () => ({
  __esModule: true,
  default: () => <div data-testid="items-stub" />,
}))
jest.mock("@/modules/order/components/order-details", () => ({
  __esModule: true,
  default: () => <div data-testid="order-details-stub" />,
}))
jest.mock("@/modules/order/components/payment-details", () => ({
  __esModule: true,
  default: () => <div data-testid="payment-details-stub" />,
}))
jest.mock("@/modules/order/components/shipping-details", () => ({
  __esModule: true,
  default: () => <div data-testid="shipping-details-stub" />,
}))

import OrderCompletedTemplate from "@/modules/order/templates/order-completed-template"

const order = { id: "order-1", items: [] } as unknown as B2BOrder

describe("OrderCompletedTemplate", () => {
  it("renders all extracted strings unchanged", async () => {
    const element = await OrderCompletedTemplate({ order })
    render(element)

    expect(screen.getByText("Thank you!")).toBeInTheDocument()
    expect(
      screen.getByText("Your order was placed successfully.")
    ).toBeInTheDocument()
    expect(screen.getByText("Summary")).toBeInTheDocument()
  })
})
