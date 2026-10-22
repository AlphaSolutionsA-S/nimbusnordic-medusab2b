jest.mock("@/lib/config", () => ({
  sdk: {
    client: { fetch: jest.fn() },
    store: {
      cart: {
        addShippingMethod: jest.fn(),
        complete: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        createLineItem: jest.fn(),
        deleteLineItem: jest.fn(),
        updateLineItem: jest.fn(),
      },
      payment: { initiatePaymentSession: jest.fn() },
    },
  },
}))

jest.mock("@/lib/data/cookies", () => ({
  getAuthHeaders: jest.fn(async () => ({})),
  getCacheOptions: jest.fn(async () => ({})),
  getCacheTag: jest.fn(async (tag: string) => tag),
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
  updateTag: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}))

import { sdk } from "@/lib/config"
import {
  addToCart,
  addToCartBulk,
  applyPromotions,
  createCartApproval,
  deleteLineItem,
  emptyCart,
  initiatePaymentSession,
  lookupCart,
  placeOrder,
  setShippingMethod,
  updateLineItem,
  updateRegion,
} from "@/lib/data/cart"
import {
  getAuthHeaders,
  getCartId,
  removeCartId,
  setCartId,
} from "@/lib/data/cookies"
import { retrieveCustomer } from "@/lib/data/customer"
import { getRegion } from "@/lib/data/regions"
import {
  CART_NOT_FOUND_ERROR,
  CART_UNAVAILABLE_ERROR,
  SIGN_IN_REQUIRED_ERROR,
} from "@/lib/util/customer-error"
import { revalidateTag, updateTag } from "next/cache"

const mockFetch = jest.mocked(sdk.client.fetch)
const mockCreate = jest.mocked(sdk.store.cart.create)
const mockGetAuthHeaders = jest.mocked(getAuthHeaders)
const mockGetCartId = jest.mocked(getCartId)
const mockGetRegion = jest.mocked(getRegion)
const mockRetrieveCustomer = jest.mocked(retrieveCustomer)

// Shape of the SDK's FetchError (`@medusajs/js-sdk` client.js): message plus
// numeric `status`.
function fetchError(status: number, message: string) {
  return Object.assign(new Error(message), { status, statusText: message })
}

const signedIn = { authorization: "Bearer token" }
const admin = { id: "cus_admin" } as Awaited<
  ReturnType<typeof retrieveCustomer>
>

beforeEach(() => {
  jest.clearAllMocks()
  // clearAllMocks keeps queued *Once values; a test that fails early must
  // not hand its leftovers to the next test.
  mockFetch.mockReset()
  mockCreate.mockReset()
  jest.mocked(sdk.store.cart.createLineItem).mockReset()
  mockGetAuthHeaders.mockResolvedValue({})
  mockGetCartId.mockResolvedValue(undefined)
  mockRetrieveCustomer.mockResolvedValue(null)
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

  it("requests the cart's customer_id column, which the ownership check compares", async () => {
    mockGetAuthHeaders.mockResolvedValue(signedIn)
    mockGetCartId.mockResolvedValue("cart_1")
    mockFetch.mockResolvedValueOnce({ cart: { id: "cart_1" } })

    await lookupCart()

    const options = mockFetch.mock.calls[0][1] as { query: { fields: string } }
    const fields = options.query.fields.split(",").map((field) => field.trim())
    expect(fields).toContain("+customer_id")
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

  it("starts a new cart when the cookie cart is readable but owned by a colleague", async () => {
    mockGetAuthHeaders.mockResolvedValue(signedIn)
    mockGetCartId.mockResolvedValue("cart_colleague")
    mockRetrieveCustomer.mockResolvedValue(admin)
    mockGetRegion.mockResolvedValue({ id: "reg_1" } as Awaited<
      ReturnType<typeof getRegion>
    >)
    // An administrator can read a colleague's cart under admin approval.
    mockFetch
      .mockResolvedValueOnce({
        cart: {
          id: "cart_colleague",
          customer_id: "cus_colleague",
          region_id: "reg_1",
        },
      })
      .mockResolvedValueOnce({
        cart: { id: "cart_new", customer_id: "cus_admin", region_id: "reg_1" },
      })
    mockCreate.mockResolvedValueOnce({
      cart: { id: "cart_new" },
    } as Awaited<ReturnType<typeof sdk.store.cart.create>>)
    jest.mocked(sdk.store.cart.createLineItem).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof sdk.store.cart.createLineItem>>
    )

    await addToCart({ variantId: "variant_1", quantity: 1, countryCode: "dk" })

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(setCartId).toHaveBeenCalledWith("cart_new")
    expect(sdk.store.cart.createLineItem).toHaveBeenCalledTimes(1)
    expect(sdk.store.cart.createLineItem).toHaveBeenCalledWith(
      "cart_new",
      { variant_id: "variant_1", quantity: 1 },
      {},
      signedIn
    )
    expect(sdk.store.cart.update).not.toHaveBeenCalled()
  })

  it("reuses a cookie cart the signed-in customer owns", async () => {
    mockGetAuthHeaders.mockResolvedValue(signedIn)
    mockGetCartId.mockResolvedValue("cart_own")
    mockRetrieveCustomer.mockResolvedValue(admin)
    mockGetRegion.mockResolvedValue({ id: "reg_1" } as Awaited<
      ReturnType<typeof getRegion>
    >)
    mockFetch.mockResolvedValueOnce({
      cart: { id: "cart_own", customer_id: "cus_admin", region_id: "reg_1" },
    })
    jest.mocked(sdk.store.cart.createLineItem).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof sdk.store.cart.createLineItem>>
    )

    await addToCart({ variantId: "variant_1", quantity: 1, countryCode: "dk" })

    expect(mockCreate).not.toHaveBeenCalled()
    expect(setCartId).not.toHaveBeenCalled()
    expect(sdk.store.cart.createLineItem).toHaveBeenCalledWith(
      "cart_own",
      { variant_id: "variant_1", quantity: 1 },
      {},
      signedIn
    )
  })

  it("refuses with the cart-not-found code and keeps the cookie when the signed-in customer cannot be read", async () => {
    mockGetAuthHeaders.mockResolvedValue(signedIn)
    mockGetCartId.mockResolvedValue("cart_own")
    mockRetrieveCustomer.mockResolvedValue(null)
    mockGetRegion.mockResolvedValue({ id: "reg_1" } as Awaited<
      ReturnType<typeof getRegion>
    >)
    mockFetch.mockResolvedValueOnce({
      cart: { id: "cart_own", customer_id: "cus_admin", region_id: "reg_1" },
    })

    await expect(
      addToCart({ variantId: "variant_1", quantity: 1, countryCode: "dk" })
    ).rejects.toThrow(CART_NOT_FOUND_ERROR)

    expect(mockCreate).not.toHaveBeenCalled()
    expect(sdk.store.cart.createLineItem).not.toHaveBeenCalled()
    expect(setCartId).not.toHaveBeenCalled()
    expect(removeCartId).not.toHaveBeenCalled()
  })

  it("maps a refused cart mutation to the cart-unavailable code", async () => {
    mockGetAuthHeaders.mockResolvedValue(signedIn)
    mockGetCartId.mockResolvedValue("cart_1")
    mockRetrieveCustomer.mockResolvedValue(admin)
    mockGetRegion.mockResolvedValue({ id: "reg_1" } as Awaited<
      ReturnType<typeof getRegion>
    >)
    mockFetch.mockResolvedValueOnce({
      cart: { id: "cart_1", customer_id: "cus_admin", region_id: "reg_1" },
    })
    jest
      .mocked(sdk.store.cart.createLineItem)
      .mockRejectedValueOnce(fetchError(404, "Cart not found"))

    await expect(
      addToCart({ variantId: "variant_1", quantity: 1, countryCode: "dk" })
    ).rejects.toThrow(CART_UNAVAILABLE_ERROR)
  })
})

// Next.js 16: `updateTag(tag)` expires a tag at once, while `revalidateTag`
// with a profile such as "max" serves the stale cart once more (NIMBUS-209).
// `getCacheTag` is mocked to return the tag name.
describe("cart cache invalidation", () => {
  function expectExpiredNow(tags: string[]) {
    expect(jest.mocked(updateTag).mock.calls).toEqual(tags.map((tag) => [tag]))
    expect(revalidateTag).not.toHaveBeenCalled()
  }

  function ownCart() {
    mockGetAuthHeaders.mockResolvedValue(signedIn)
    mockGetCartId.mockResolvedValue("cart_1")
    mockRetrieveCustomer.mockResolvedValue(admin)
    mockGetRegion.mockResolvedValue({ id: "reg_1" } as Awaited<
      ReturnType<typeof getRegion>
    >)
  }

  it("add to an existing cart expires fulfillment and carts", async () => {
    ownCart()
    mockFetch.mockResolvedValueOnce({
      cart: { id: "cart_1", customer_id: "cus_admin", region_id: "reg_1" },
    })
    jest.mocked(sdk.store.cart.createLineItem).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof sdk.store.cart.createLineItem>>
    )

    await addToCart({ variantId: "variant_1", quantity: 1, countryCode: "dk" })

    expectExpiredNow(["fulfillment", "carts"])
  })

  it("add to a new cart also expires carts when the cart is created", async () => {
    ownCart()
    mockGetCartId.mockResolvedValue(undefined)
    mockFetch.mockResolvedValueOnce({
      cart: { id: "cart_new", customer_id: "cus_admin", region_id: "reg_1" },
    })
    mockCreate.mockResolvedValueOnce({
      cart: { id: "cart_new" },
    } as Awaited<ReturnType<typeof sdk.store.cart.create>>)
    jest.mocked(sdk.store.cart.createLineItem).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof sdk.store.cart.createLineItem>>
    )

    await addToCart({ variantId: "variant_1", quantity: 1, countryCode: "dk" })

    expectExpiredNow(["carts", "fulfillment", "carts"])
  })

  it("updating a line expires fulfillment and carts", async () => {
    ownCart()
    jest.mocked(sdk.store.cart.updateLineItem).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof sdk.store.cart.updateLineItem>>
    )

    await updateLineItem({ lineId: "li_1", data: { quantity: 2 } })

    expectExpiredNow(["fulfillment", "carts"])
  })

  it("deleting a line expires fulfillment and carts", async () => {
    ownCart()
    jest.mocked(sdk.store.cart.deleteLineItem).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof sdk.store.cart.deleteLineItem>>
    )

    await deleteLineItem("li_1")

    expectExpiredNow(["fulfillment", "carts"])
  })

  it("emptying the cart expires each deleted line's tags, then carts", async () => {
    ownCart()
    mockFetch.mockResolvedValueOnce({
      cart: { id: "cart_1", items: [{ id: "li_1" }] },
    })
    jest.mocked(sdk.store.cart.deleteLineItem).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof sdk.store.cart.deleteLineItem>>
    )

    await emptyCart()

    expectExpiredNow(["fulfillment", "carts", "carts"])
  })

  it("setting the shipping method expires carts", async () => {
    ownCart()
    jest.mocked(sdk.store.cart.addShippingMethod).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof sdk.store.cart.addShippingMethod>>
    )

    await setShippingMethod({ cartId: "cart_1", shippingMethodId: "so_1" })

    expectExpiredNow(["carts"])
  })

  it("starting a payment session expires carts", async () => {
    ownCart()
    jest.mocked(sdk.store.payment.initiatePaymentSession).mockResolvedValueOnce(
      {} as Awaited<ReturnType<typeof sdk.store.payment.initiatePaymentSession>>
    )

    await initiatePaymentSession(
      { id: "cart_1" } as Parameters<typeof initiatePaymentSession>[0],
      { provider_id: "pp_system_default" }
    )

    expectExpiredNow(["carts"])
  })

  it("applying promotions expires the cart update's tags, then carts and fulfillment", async () => {
    ownCart()
    jest.mocked(sdk.store.cart.update).mockResolvedValueOnce({
      cart: { id: "cart_1" },
    } as Awaited<ReturnType<typeof sdk.store.cart.update>>)

    await applyPromotions(["SUMMER"])

    expectExpiredNow(["fulfillment", "carts", "carts", "fulfillment"])
  })

  it("placing an order expires carts, orders and approvals", async () => {
    ownCart()
    jest.mocked(sdk.store.cart.complete).mockResolvedValueOnce({
      type: "order",
      order: { id: "order_1", shipping_address: { country_code: "DK" } },
    } as Awaited<ReturnType<typeof sdk.store.cart.complete>>)

    await placeOrder("cart_1")

    expectExpiredNow(["carts", "orders", "approvals"])
  })

  it("expires nothing when the cart could not be completed", async () => {
    ownCart()
    jest.mocked(sdk.store.cart.complete).mockResolvedValueOnce({
      type: "cart",
      cart: { id: "cart_1" },
    } as Awaited<ReturnType<typeof sdk.store.cart.complete>>)

    await placeOrder("cart_1")

    expectExpiredNow([])
  })

  it("changing region with a cart expires the cart update's tags, then carts, regions and products", async () => {
    ownCart()
    jest.mocked(sdk.store.cart.update).mockResolvedValueOnce({
      cart: { id: "cart_1" },
    } as Awaited<ReturnType<typeof sdk.store.cart.update>>)

    await updateRegion("se", "/store")

    expectExpiredNow(["fulfillment", "carts", "carts", "regions", "products"])
  })

  it("changing region without a cart expires regions and products", async () => {
    ownCart()
    mockGetCartId.mockResolvedValue(undefined)

    await updateRegion("se", "/store")

    expectExpiredNow(["regions", "products"])
  })

  it("requesting approval expires carts and approvals", async () => {
    ownCart()
    mockFetch.mockResolvedValueOnce({ approval: { id: "appr_1" } })

    await createCartApproval("cart_1", "cus_admin")

    expectExpiredNow(["carts", "approvals"])
  })
})
