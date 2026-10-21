jest.mock("@/lib/data/orders", () => ({
  retrieveOrder: jest.fn(),
}))
jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))
jest.mock("@/modules/order/templates/order-details-template", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@/modules/order/templates/order-completed-template", () => ({
  __esModule: true,
  default: () => null,
}))

import OrderDetailPage from "@/app/[countryCode]/(main)/account/@dashboard/orders/details/[id]/page"
import OrderConfirmedPage from "@/app/[countryCode]/(main)/order/confirmed/[id]/page"
import { retrieveOrder } from "@/lib/data/orders"

// The backend answers 404 "Order not found" both for a missing order and for
// one the caller may not read (NIMBUS-177); the pages show the same not-found.
const refused = Object.assign(new Error("Order not found"), { status: 404 })

describe("order pages for a refused order", () => {
  it.each([
    ["order confirmation", OrderConfirmedPage],
    ["order detail", OrderDetailPage],
  ])("%s renders not-found", async (_name, Page) => {
    jest.mocked(retrieveOrder).mockRejectedValueOnce(refused)

    await expect(
      Page({ params: Promise.resolve({ id: "order_other" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND")
  })
})
