jest.mock("@/lib/config", () => ({
  sdk: {
    client: { fetch: jest.fn() },
    store: {
      cart: {
        create: jest.fn(),
        update: jest.fn(),
        createLineItem: jest.fn(),
      },
    },
  },
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

import { sdk } from "@/lib/config"
import {
  addToCart,
  addToCartBulk,
  applyPromotions,
  emptyCart,
  lookupCart,
} from "@/lib/data/cart"
import { getAuthHeaders, getCartId, setCartId } from "@/lib/data/cookies"
import { getRegion } from "@/lib/data/regions"
import {
  CART_UNAVAILABLE_ERROR,
  SIGN_IN_REQUIRED_ERROR,
} from "@/lib/util/customer-error"

const mockFetch = jest.mocked(sdk.client.fetch)
const mockCreate = jest.mocked(sdk.store.cart.create)
const mockGetAuthHeaders = jest.mocked(getAuthHeaders)
const mockGetCartId = jest.mocked(getCartId)
const mockGetRegion = jest.mocked(getRegion)

// Shape of the SDK's FetchError (`@medusajs/js-sdk` client.js): message plus
// numeric `status`.
function fetchError(status: number, message: string) {
  return Object.assign(new Error(message), { status, statusText: message })
}

const signedIn = { authorization: "Bearer token" }

beforeEach(() => {
  jest.clearAllMocks()
  mockGetAuthHeaders.mockResolvedValue({})
  mockGetCartId.mockResolvedValue(undefined)
})

describe("cart data errors", () => {
  it("throws the stable cart-not-found code when no cart exists (TC-8)", async () => {
    await expect(emptyCart()).rejects.toThrow("CART_NOT_FOUND")
    await expect(applyPromotions(["X"])).rejects.toThrow("CART_NOT_FOUND")
  })
})

describe("lookupCart", () => {
  it("reports none when there is no cart cookie, without calling the backend", async () => {
    mockGetAuthHeaders.mockResolvedValue(signedIn)

    await expect(lookupCart()).resolves.toEqual({ status: "none" })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("reports none for a signed-out visitor with a cart cookie, without calling the backend", async () => {
    mockGetCartId.mockResolvedValue("cart_old")

    await expect(lookupCart()).resolves.toEqual({ status: "none" })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("reports unavailable, not an exception, when the backend refuses the cookie cart", async () => {
    mockGetAuthHeaders.mockResolvedValue(signedIn)
    mockGetCartId.mockResolvedValue("cart_other_account")
    mockFetch.mockRejectedValueOnce(fetchError(404, "Cart not found"))

    await expect(lookupCart()).resolves.toEqual({ status: "unavailable" })
  })

  it("reports an error, not unavailable, for other failures", async () => {
    mockGetAuthHeaders.mockResolvedValue(signedIn)
    mockGetCartId.mockResolvedValue("cart_1")
    mockFetch.mockRejectedValueOnce(fetchError(500, "Internal error"))

    await expect(lookupCart()).resolves.toEqual({ status: "error" })
  })

  it("fetches the cart with no-store and the caller's token", async () => {
    mockGetAuthHeaders.mockResolvedValue(signedIn)
    mockGetCartId.mockResolvedValue("cart_1")
    mockFetch.mockResolvedValueOnce({ cart: { id: "cart_1" } })

    await expect(lookupCart()).resolves.toEqual({
      status: "found",
      cart: { id: "cart_1" },
    })
    expect(mockFetch).toHaveBeenCalledWith(
      "/store/carts/cart_1",
      expect.objectContaining({ cache: "no-store", headers: signedIn })
    )
  })
})

describe("add to cart", () => {
  it("returns the sign-in code and creates no cart without a token", async () => {
    await expect(
      addToCartBulk({
        lineItems: [{ variant_id: "variant_1", quantity: 1 }],
        countryCode: "dk",
      })
    ).resolves.toEqual({ error: SIGN_IN_REQUIRED_ERROR })
    await expect(
      addToCart({ variantId: "variant_1", quantity: 1, countryCode: "dk" })
    ).resolves.toEqual({ error: SIGN_IN_REQUIRED_ERROR })

    expect(mockCreate).not.toHaveBeenCalled()
    expect(setCartId).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("starts a new cart when the cookie cart is no longer available", async () => {
    mockGetAuthHeaders.mockResolvedValue(signedIn)
    mockGetCartId.mockResolvedValue("cart_other_account")
    mockGetRegion.mockResolvedValue({ id: "reg_1" } as Awaited<
      ReturnType<typeof getRegion>
    >)
    mockFetch
      .mockRejectedValueOnce(fetchError(404, "Cart not found"))
      .mockResolvedValueOnce({ cart: { id: "cart_new", region_id: "reg_1" } })
    mockCreate.mockResolvedValueOnce({
      cart: { id: "cart_new" },
    } as Awaited<ReturnType<typeof sdk.store.cart.create>>)
    jest.mocked(sdk.store.cart.createLineItem).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof sdk.store.cart.createLineItem>>
    )

    await addToCart({ variantId: "variant_1", quantity: 1, countryCode: "dk" })

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(setCartId).toHaveBeenCalledWith("cart_new")
    expect(sdk.store.cart.createLineItem).toHaveBeenCalledWith(
      "cart_new",
      { variant_id: "variant_1", quantity: 1 },
      {},
      signedIn
    )
  })

  it("maps a refused cart mutation to the cart-unavailable code", async () => {
    mockGetAuthHeaders.mockResolvedValue(signedIn)
    mockGetCartId.mockResolvedValue("cart_1")
    mockGetRegion.mockResolvedValue({ id: "reg_1" } as Awaited<
      ReturnType<typeof getRegion>
    >)
    mockFetch.mockResolvedValueOnce({ cart: { id: "cart_1", region_id: "reg_1" } })
    jest
      .mocked(sdk.store.cart.createLineItem)
      .mockRejectedValueOnce(fetchError(404, "Cart not found"))

    await expect(
      addToCart({ variantId: "variant_1", quantity: 1, countryCode: "dk" })
    ).rejects.toThrow(CART_UNAVAILABLE_ERROR)
  })
})
