jest.mock("@/lib/config", () => ({
  sdk: {
    auth: {
      login: jest.fn(),
    },
    client: {
      fetch: jest.fn(),
    },
    store: {
      cart: {
        transferCart: jest.fn(),
      },
      customer: {},
    },
  },
}))

jest.mock("@/lib/data/cart", () => ({
  retrieveCart: jest.fn(),
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
}))

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}))

import {
  login,
  syncCompanyFromBusinessCentral,
} from "@/lib/data/customer"
import { sdk } from "@/lib/config"
import { retrieveCart } from "@/lib/data/cart"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  setAuthToken,
} from "@/lib/data/cookies"
import { revalidateTag } from "next/cache"

const mockFetch = jest.mocked(sdk.client.fetch)
const mockLogin = jest.mocked(sdk.auth.login)
const mockGetAuthHeaders = jest.mocked(getAuthHeaders)
const mockGetCacheOptions = jest.mocked(getCacheOptions)
const mockGetCacheTag = jest.mocked(getCacheTag)
const mockGetCartId = jest.mocked(getCartId)
const mockSetAuthToken = jest.mocked(setAuthToken)
const mockRetrieveCart = jest.mocked(retrieveCart)
const mockRevalidateTag = jest.mocked(revalidateTag)

describe("syncCompanyFromBusinessCentral", () => {
  beforeEach(() => {
    mockGetAuthHeaders.mockResolvedValue({
      authorization: "test-authorization",
    })
    mockGetCacheOptions.mockResolvedValue({})
    mockGetCacheTag.mockImplementation(async (key) => key)
    mockGetCartId.mockResolvedValue(undefined)
    mockRetrieveCart.mockResolvedValue(null)
    mockSetAuthToken.mockResolvedValue(undefined)
    mockFetch.mockResolvedValue({ status: "updated" })
  })

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
    expect(mockRevalidateTag).toHaveBeenCalledWith("customers")
  })

  it("contains a failed synchronization request", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation()
    mockFetch.mockRejectedValueOnce(new Error("request failed"))

    await expect(syncCompanyFromBusinessCentral()).resolves.toBeUndefined()
    expect(mockRevalidateTag).not.toHaveBeenCalled()
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

      events.push("customer-retrieved")
      return { customer: null }
    })

    await login(undefined, formData)

    expect(events).toEqual([
      "token-stored",
      "company-synced",
      "customer-retrieved",
    ])
    expect(
      mockFetch.mock.calls.filter(
        ([path]) =>
          path === "/store/customers/me/company/sync-business-central"
      )
    ).toHaveLength(1)
  })
})
