jest.mock("@/lib/config", () => ({
  sdk: {},
}))

jest.mock("@/lib/data/cookies", () => ({
  getAuthHeaders: jest.fn(async () => ({})),
  getCacheOptions: jest.fn(async () => ({})),
  getCacheTag: jest.fn(async () => "carts"),
  getCartId: jest.fn(async () => undefined),
  removeCartId: jest.fn(),
  setCartId: jest.fn(),
}))

jest.mock("@/lib/data/customer", () => ({
  retrieveCustomer: jest.fn(async () => null),
}))

jest.mock("@/lib/data/regions", () => ({
  getRegion: jest.fn(),
}))

jest.mock("@vercel/analytics/server", () => ({
  track: jest.fn(),
}))

jest.mock("next/cache", () => ({
  revalidateTag: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}))

import { applyPromotions, emptyCart } from "@/lib/data/cart"

describe("cart data errors", () => {
  it("throws the stable cart-not-found code when no cart exists (TC-8)", async () => {
    await expect(emptyCart()).rejects.toThrow("CART_NOT_FOUND")
    await expect(applyPromotions(["X"])).rejects.toThrow("CART_NOT_FOUND")
  })
})
