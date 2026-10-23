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
  submitPromotionForm,
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

function promotionForm(fields: Array<[string, string]>): FormData {
  const formData = new FormData()
  fields.forEach(([name, value]) => formData.append(name, value))
  return formData
}

describe("submitPromotionForm", () => {
  const update = jest.mocked(sdk.store.cart.update)
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    mockGetCartId.mockResolvedValue("cart_1")
    update.mockReset()
    update.mockResolvedValue({ cart: { id: "cart_1" } } as Awaited<
      ReturnType<typeof sdk.store.cart.update>
    >)
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it.each([
    {
      name: "adds a second code without dropping the existing code",
      fields: [
        ["applied_code", "SAVE10"],
        ["code", "NEW20"],
      ],
      codes: ["SAVE10", "NEW20"],
    },
    {
      name: "adds the first code",
      fields: [["code", "NEW20"]],
      codes: ["NEW20"],
    },
    {
      name: "does not duplicate an already applied code",
      fields: [
        ["applied_code", "SAVE10"],
        ["code", "SAVE10"],
      ],
      codes: ["SAVE10"],
    },
    {
      name: "removes one code while keeping the other",
      fields: [
        ["applied_code", "SAVE10"],
        ["applied_code", "SAVE20"],
        ["remove_code", "SAVE10"],
      ],
      codes: ["SAVE20"],
    },
    {
      name: "sends an empty list when removing the only manual code",
      fields: [
        ["applied_code", "SAVE10"],
        ["remove_code", "SAVE10"],
      ],
      codes: [],
    },
  ])("$name", async ({ fields, codes }) => {
    await expect(
      submitPromotionForm(
        null,
        promotionForm(fields as Array<[string, string]>)
      )
    ).resolves.toEqual({ success: true })
    expect(update).toHaveBeenCalledWith(
      "cart_1",
      { promo_codes: codes },
      {},
      {}
    )
  })

  it.each([
    { field: "code", context: "cart.submit-promotion" },
    { field: "remove_code", context: "cart.remove-promotion" },
  ])(
    "returns a failure without the raw message for $field",
    async ({ field, context }) => {
      update.mockRejectedValueOnce({
        response: {
          data: { message: "The promotion code NOPE is invalid" },
          status: 400,
          headers: {},
        },
        config: {
          url: "/store/carts/cart_1",
          baseURL: "http://localhost:9000",
        },
      })

      await expect(
        submitPromotionForm(
          null,
          promotionForm([
            ["applied_code", "SAVE10"],
            [field, "NOPE"],
          ])
        )
      ).resolves.toEqual({ success: false })
      expect(consoleError).toHaveBeenCalledWith("[customer-error]", {
        context,
        message: expect.stringContaining("is invalid"),
      })
    }
  )

  it("returns and logs a failure when the cart is missing", async () => {
    mockGetCartId.mockResolvedValue(undefined)

    await expect(
      submitPromotionForm(null, promotionForm([["code", "NEW20"]]))
    ).resolves.toEqual({ success: false })
    expect(update).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith("[customer-error]", {
      context: "cart.submit-promotion",
      message: "CART_NOT_FOUND",
    })
  })

  it.each(["empty", "missing", "file"])("ignores a %s code", async (kind) => {
    const form = promotionForm([["applied_code", "SAVE10"]])
    if (kind === "empty") form.append("code", "")
    if (kind === "file") form.append("code", new File(["NEW20"], "code.txt"))

    await expect(submitPromotionForm(null, form)).resolves.toBeNull()
    expect(update).not.toHaveBeenCalled()
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
    jest
      .mocked(sdk.store.cart.createLineItem)
      .mockResolvedValueOnce(
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
    jest
      .mocked(sdk.store.cart.createLineItem)
      .mockResolvedValueOnce(
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
    jest
      .mocked(sdk.store.cart.createLineItem)
      .mockResolvedValueOnce(
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
