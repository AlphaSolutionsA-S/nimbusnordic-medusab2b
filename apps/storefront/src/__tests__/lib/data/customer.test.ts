jest.mock("@/lib/config", () => ({
  sdk: {
    auth: {
      login: jest.fn(),
      logout: jest.fn(),
      register: jest.fn(),
    },
    client: {
      fetch: jest.fn(),
    },
    store: {
      cart: {
        transferCart: jest.fn(),
      },
      customer: { create: jest.fn() },
    },
  },
}))

jest.mock("@/lib/data/cart", () => ({
  lookupCart: jest.fn(),
  updateCart: jest.fn(),
}))

jest.mock("@/lib/data/companies", () => ({
  createCompany: jest.fn(),
  createEmployee: jest.fn(),
}))

jest.mock("@/lib/data/cookies", () => ({
  getAuthHeaders: jest.fn(),
  getCacheOptions: jest.fn(),
  getCacheTag: jest.fn(),
  getCartId: jest.fn(),
  removeAuthToken: jest.fn(),
  removeCartId: jest.fn(),
  setAuthToken: jest.fn(),
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

import {
  login,
  signout,
  signup,
  syncCompanyFromBusinessCentral,
} from "@/lib/data/customer"
import { sdk } from "@/lib/config"
import { lookupCart, updateCart } from "@/lib/data/cart"
import { createCompany, createEmployee } from "@/lib/data/companies"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeCartId,
  setAuthToken,
} from "@/lib/data/cookies"
import { revalidateTag, updateTag } from "next/cache"

const mockFetch = jest.mocked(sdk.client.fetch)
const mockLogin = jest.mocked(sdk.auth.login)
const mockTransferCart = jest.mocked(sdk.store.cart.transferCart)
const mockGetAuthHeaders = jest.mocked(getAuthHeaders)
const mockGetCacheOptions = jest.mocked(getCacheOptions)
const mockGetCacheTag = jest.mocked(getCacheTag)
const mockGetCartId = jest.mocked(getCartId)
const mockSetAuthToken = jest.mocked(setAuthToken)
const mockLookupCart = jest.mocked(lookupCart)
const mockUpdateTag = jest.mocked(updateTag)

beforeEach(() => {
  jest.clearAllMocks()
  mockGetAuthHeaders.mockResolvedValue({
    authorization: "test-authorization",
  })
  mockGetCacheOptions.mockResolvedValue({})
  mockGetCacheTag.mockImplementation(async (key) => key)
  mockGetCartId.mockResolvedValue(undefined)
  mockLookupCart.mockResolvedValue({ status: "none" })
  mockSetAuthToken.mockResolvedValue(undefined)
  mockFetch.mockResolvedValue({ status: "updated" })
})

type FoundCart = Extract<
  Awaited<ReturnType<typeof lookupCart>>,
  { status: "found" }
>

function foundCart(id: string, customerId: string): FoundCart {
  return {
    status: "found",
    cart: { id, customer_id: customerId } as FoundCart["cart"],
  }
}

function signedInAs(customerId: string) {
  mockFetch.mockImplementation(async (path) => {
    if (path === "/store/customers/me") {
      return { customer: { id: customerId } }
    }
    return { status: "updated" }
  })
}

function loginForm() {
  const formData = new FormData()
  formData.set("email", "customer@example.com")
  formData.set("password", "password")
  return formData
}

describe("login cart lifecycle", () => {
  it("clears an inaccessible cookie cart and never transfers or updates it", async () => {
    mockLogin.mockResolvedValue("token")
    mockGetCartId.mockResolvedValue("cart_other_account")
    mockLookupCart.mockResolvedValue({ status: "unavailable" })

    await login(undefined, loginForm())

    expect(removeCartId).toHaveBeenCalledTimes(1)
    expect(mockTransferCart).not.toHaveBeenCalled()
    expect(updateCart).not.toHaveBeenCalled()
  })

  it("keeps a cookie cart the signed-in customer owns without transferring or updating it", async () => {
    mockLogin.mockResolvedValue("token")
    mockGetCartId.mockResolvedValue("cart_own")
    signedInAs("cus_admin")
    mockLookupCart.mockResolvedValue(foundCart("cart_own", "cus_admin"))

    await login(undefined, loginForm())

    expect(removeCartId).not.toHaveBeenCalled()
    expect(mockTransferCart).not.toHaveBeenCalled()
    expect(updateCart).not.toHaveBeenCalled()
  })

  it("clears a colleague's cart the administrator can read but does not own, without transferring or updating it", async () => {
    mockLogin.mockResolvedValue("token")
    mockGetCartId.mockResolvedValue("cart_colleague")
    signedInAs("cus_admin")
    // Readable because it has an admin approval; every mutation is owner-only.
    mockLookupCart.mockResolvedValue(foundCart("cart_colleague", "cus_colleague"))

    await login(undefined, loginForm())

    expect(removeCartId).toHaveBeenCalledTimes(1)
    expect(mockTransferCart).not.toHaveBeenCalled()
    expect(updateCart).not.toHaveBeenCalled()
  })

  it("keeps the cookie when the signed-in customer cannot be read", async () => {
    mockLogin.mockResolvedValue("token")
    mockGetCartId.mockResolvedValue("cart_own")
    mockLookupCart.mockResolvedValue(foundCart("cart_own", "cus_admin"))
    mockFetch.mockImplementation(async (path) => {
      if (path === "/store/customers/me") {
        throw new Error("request failed")
      }
      return { status: "updated" }
    })

    await login(undefined, loginForm())

    expect(removeCartId).not.toHaveBeenCalled()
  })

  it("keeps the cookie when the cart lookup fails for another reason", async () => {
    mockLogin.mockResolvedValue("token")
    mockGetCartId.mockResolvedValue("cart_own")
    mockLookupCart.mockResolvedValue({ status: "error" })

    await login(undefined, loginForm())

    expect(removeCartId).not.toHaveBeenCalled()
  })
})

describe("syncCompanyFromBusinessCentral", () => {

  it("posts once and revalidates the customer cache", async () => {
    await syncCompanyFromBusinessCentral()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      "/store/customers/me/company/sync-business-central",
      {
        method: "POST",
        headers: {
          authorization: "test-authorization",
        },
      }
    )
    expect(mockUpdateTag.mock.calls).toEqual([["customers"]])
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("contains a failed synchronization request", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation()
    mockFetch.mockRejectedValueOnce(new Error("request failed"))

    await expect(syncCompanyFromBusinessCentral()).resolves.toBeUndefined()
    expect(mockUpdateTag).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      "Business Central company sync request failed after login"
    )

    warn.mockRestore()
  })

  it("does not call the endpoint without an authorization header", async () => {
    mockGetAuthHeaders.mockResolvedValue({})

    await syncCompanyFromBusinessCentral()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("awaits token persistence before the post-login sync", async () => {
    const events: string[] = []
    const formData = new FormData()
    formData.set("email", "customer@example.com")
    formData.set("password", "password")

    mockLogin.mockResolvedValue("token")
    mockSetAuthToken.mockImplementationOnce(async () => {
      events.push("token-stored")
    })
    mockFetch.mockImplementation(async (path) => {
      if (path === "/store/customers/me/company/sync-business-central") {
        events.push("company-synced")
        return { status: "updated" }
      }

      events.push("other-request")
      return {}
    })
    mockLookupCart.mockImplementationOnce(async () => {
      events.push("cart-looked-up")
      return { status: "none" }
    })

    await login(undefined, formData)

    expect(events).toEqual(["token-stored", "company-synced", "cart-looked-up"])
    expect(
      mockFetch.mock.calls.filter(
        ([path]) =>
          path === "/store/customers/me/company/sync-business-central"
      )
    ).toHaveLength(1)
  })

  it("registers the company after persisting authentication without a second employee request", async () => {
    const events: string[] = []
    const employee = { id: "employee-new", is_admin: true }
    const formData = new FormData()
    formData.set("email", "signup@example.test")
    formData.set("password", "test-password")
    formData.set("company_name", "New company")
    formData.set("currency_code", "dkk")
    jest.mocked(sdk.auth.register).mockResolvedValue("registration-token")
    jest.mocked(sdk.store.customer.create).mockResolvedValue({
      customer: { id: "customer-new" },
    } as Awaited<ReturnType<typeof sdk.store.customer.create>>)
    mockLogin.mockResolvedValue("customer-token")
    mockSetAuthToken.mockImplementationOnce(async () => {
      await Promise.resolve()
      events.push("token-stored")
    })
    jest.mocked(createCompany).mockImplementationOnce(async () => {
      events.push("company-created")
      return { id: "company-new", employees: [employee] } as Awaited<ReturnType<typeof createCompany>>
    })

    mockGetCartId.mockResolvedValue("cart_from_before_signup")

    const result = await signup(undefined, formData)

    expect(events).toEqual(["token-stored", "company-created"])
    expect(createEmployee).not.toHaveBeenCalled()
    expect(result).toMatchObject({ employee })
    expect(mockTransferCart).not.toHaveBeenCalled()
  })
})

describe("session cache invalidation", () => {
  it("login expires customers (company sync and login), products and carts at once", async () => {
    mockLogin.mockResolvedValue("token")

    await login(undefined, loginForm())

    expect(mockUpdateTag.mock.calls).toEqual([
      ["customers"],
      ["customers"],
      ["products"],
      ["carts"],
    ])
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("signout expires auth, customers, products and carts at once", async () => {
    jest.mocked(sdk.auth.logout).mockResolvedValue(undefined)

    await signout("dk", "cus_1")

    expect(mockUpdateTag.mock.calls).toEqual([
      ["auth"],
      ["customers"],
      ["products"],
      ["carts"],
    ])
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
