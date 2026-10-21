jest.mock("@/lib/config", () => ({
  sdk: { client: { fetch: jest.fn() } },
}))

jest.mock("@/lib/data/cookies", () => ({
  getAuthHeaders: jest.fn(async () => ({ authorization: "Bearer token" })),
  getCacheOptions: jest.fn(async () => ({ tags: ["orders-cache"] })),
}))

import { sdk } from "@/lib/config"
import { listOrders, retrieveOrder } from "@/lib/data/orders"

const mockFetch = jest.mocked(sdk.client.fetch)

beforeEach(() => {
  mockFetch.mockReset()
})

// Order reads are per caller (NIMBUS-177): a cached response could be served
// to the next account on the same server.
describe("order fetches", () => {
  it("reads one order (confirmation and detail) with no-store and the caller's token", async () => {
    mockFetch.mockResolvedValueOnce({ order: { id: "order_1" } })

    await retrieveOrder("order_1")

    expect(mockFetch).toHaveBeenCalledWith(
      "/store/orders/order_1",
      expect.objectContaining({
        cache: "no-store",
        headers: { authorization: "Bearer token" },
      })
    )
    expect(mockFetch.mock.calls[0][1]).not.toHaveProperty("next")
  })

  it("reads the order history with no-store", async () => {
    mockFetch.mockResolvedValueOnce({ orders: [] })

    await listOrders()

    expect(mockFetch).toHaveBeenCalledWith(
      "/store/orders",
      expect.objectContaining({ cache: "no-store" })
    )
    expect(mockFetch.mock.calls[0][1]).not.toHaveProperty("next")
  })
})
