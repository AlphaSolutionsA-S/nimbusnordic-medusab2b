jest.mock("@/lib/config", () => ({
  sdk: { client: { fetch: jest.fn() } },
}))

jest.mock("@/lib/data/cookies", () => ({
  getAuthHeaders: jest.fn(async () => ({ authorization: "Bearer token" })),
  getCacheOptions: jest.fn(async () => ({ tags: ["fulfillment-cache"] })),
}))

import { sdk } from "@/lib/config"
import {
  listCartFreeShippingPrices,
  listCartShippingMethods,
} from "@/lib/data/fulfillment"

const mockFetch = jest.mocked(sdk.client.fetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe("cart shipping fetches", () => {
  it("lists the cart's shipping options with no-store", async () => {
    mockFetch.mockResolvedValueOnce({ shipping_options: [] })

    await listCartShippingMethods("cart_1")

    expect(mockFetch).toHaveBeenCalledWith(
      "/store/shipping-options",
      expect.objectContaining({
        cache: "no-store",
        query: { cart_id: "cart_1" },
      })
    )
    expect(mockFetch.mock.calls[0][1]).not.toHaveProperty("next")
  })

  it("lists the cart's free-shipping prices with no-store", async () => {
    mockFetch.mockResolvedValueOnce({ prices: [] })

    await listCartFreeShippingPrices("cart_1")

    expect(mockFetch).toHaveBeenCalledWith(
      "/store/free-shipping/prices",
      expect.objectContaining({ cache: "no-store" })
    )
    expect(mockFetch.mock.calls[0][1]).not.toHaveProperty("next")
  })
})
