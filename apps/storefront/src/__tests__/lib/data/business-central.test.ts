jest.mock("@/lib/config", () => ({
  sdk: {
    client: {
      fetch: jest.fn(),
    },
  },
}))

jest.mock("@/lib/data/cookies", () => ({
  getAuthHeaders: jest.fn(() => Promise.resolve({})),
}))

jest.mock("@medusajs/js-sdk", () => ({
  FetchError: class FetchError extends Error {},
}))

import { listBCReturns } from "@/lib/data/business-central"
import { sdk } from "@/lib/config"

describe("listBCReturns", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // TC-1: happy path — defaults are sent when no params are given.
  it("requests /store/bc-returns with default limit and offset", async () => {
    ;(sdk.client.fetch as jest.Mock).mockResolvedValueOnce({
      returns: [],
      count: 0,
      offset: 0,
      limit: 20,
    })

    const result = await listBCReturns()

    expect(sdk.client.fetch).toHaveBeenCalledWith("/store/bc-returns", {
      method: "GET",
      headers: {},
      query: { limit: 20, offset: 0 },
      credentials: "include",
    })
    expect(result).toEqual({ returns: [], count: 0, offset: 0, limit: 20 })
  })

  // TC-2: edge case — optional filters are only included when provided.
  it("omits status, date_from, date_to and search from the query when not provided", async () => {
    ;(sdk.client.fetch as jest.Mock).mockResolvedValueOnce({
      returns: [],
      count: 0,
      offset: 0,
      limit: 20,
    })

    await listBCReturns({ limit: 10, offset: 5 })

    expect(sdk.client.fetch).toHaveBeenCalledWith(
      "/store/bc-returns",
      expect.objectContaining({
        query: { limit: 10, offset: 5 },
      })
    )
  })

  // TC-3: integration/wiring — all optional filters are forwarded when provided.
  it("forwards status, date range and search filters when provided", async () => {
    ;(sdk.client.fetch as jest.Mock).mockResolvedValueOnce({
      returns: [],
      count: 0,
      offset: 0,
      limit: 20,
    })

    await listBCReturns({
      status: "Open",
      date_from: "2026-01-01",
      date_to: "2026-12-31",
      search: "RET-1",
    })

    expect(sdk.client.fetch).toHaveBeenCalledWith(
      "/store/bc-returns",
      expect.objectContaining({
        query: {
          limit: 20,
          offset: 0,
          status: "Open",
          date_from: "2026-01-01",
          date_to: "2026-12-31",
          search: "RET-1",
        },
      })
    )
  })
})
