jest.mock("@/lib/config", () => ({
  sdk: {
    client: {
      fetch: jest.fn(),
    },
  },
}))

jest.mock("@/lib/data/cookies", () => ({
  getAuthHeaders: jest.fn(() => Promise.resolve({ authorization: "Bearer token" })),
}))

jest.mock("@medusajs/js-sdk", () => ({
  FetchError: class FetchError extends Error {
    status: number | undefined
    statusText: string | undefined

    constructor(message: string, statusText?: string, status?: number) {
      super(message)
      this.statusText = statusText
      this.status = status
    }
  },
}))

import { FetchError } from "@medusajs/js-sdk"
import { sdk } from "@/lib/config"
import { retrieveBCReturn } from "@/lib/data/business-central"

const bcReturn = {
  id: "return-1",
  number: "31502910",
  documentDate: "2026-09-27",
  status: "Open",
  lines: [],
  expectedCredit: {
    currencyCode: "DKK",
    amountIncludingTax: 1598.75,
    amountExcludingTax: 1279,
  },
}

describe("retrieveBCReturn", () => {
  // TC-1: happy path — calls the detail route with auth headers and unwraps `return`.
  it("requests /store/bc-returns/:number and returns the return", async () => {
    ;(sdk.client.fetch as jest.Mock).mockResolvedValueOnce({ return: bcReturn })

    await expect(retrieveBCReturn("31502910")).resolves.toEqual(bcReturn)
    expect(sdk.client.fetch).toHaveBeenCalledWith("/store/bc-returns/31502910", {
      method: "GET",
      headers: { authorization: "Bearer token" },
      credentials: "include",
      cache: "no-store",
    })
  })

  // TC-2: edge case — the return number is URL-encoded into a single path segment.
  it("URL-encodes the return number", async () => {
    ;(sdk.client.fetch as jest.Mock).mockResolvedValueOnce({ return: bcReturn })

    await retrieveBCReturn("RO/1 2")

    expect(sdk.client.fetch).toHaveBeenCalledWith(
      "/store/bc-returns/RO%2F1%202",
      expect.any(Object)
    )
  })

  // TC-3: edge case — a 404 (foreign/unknown/processed) becomes null.
  it("returns null when the backend responds 404", async () => {
    ;(sdk.client.fetch as jest.Mock).mockRejectedValueOnce(
      new FetchError("Return not found.", "Not Found", 404)
    )

    await expect(retrieveBCReturn("31502999")).resolves.toBeNull()
  })

  // TC-4: error condition — any other failure is rethrown for the page's error state.
  it("rethrows non-404 errors", async () => {
    const error = new FetchError("Internal Server Error", "Internal Server Error", 500)
    ;(sdk.client.fetch as jest.Mock).mockRejectedValueOnce(error)

    await expect(retrieveBCReturn("31502910")).rejects.toBe(error)
  })
})
