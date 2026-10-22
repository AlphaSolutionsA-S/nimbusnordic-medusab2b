jest.mock("@/lib/config", () => ({
  sdk: { client: { fetch: jest.fn() } },
}))

jest.mock("@/lib/data/cookies", () => ({
  getAuthHeaders: jest.fn(async () => ({ authorization: "Bearer token" })),
  getCacheOptions: jest.fn(async () => ({ tags: ["approvals-cache"] })),
  getCacheTag: jest.fn(async () => "approvals"),
}))

jest.mock("@/lib/data/cart", () => ({
  retrieveCart: jest.fn(),
}))

jest.mock("next/cache", () => ({
  revalidateTag: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}))

import { sdk } from "@/lib/config"
import { listApprovals } from "@/lib/data/approvals"

const mockFetch = jest.mocked(sdk.client.fetch)

describe("listApprovals", () => {
  it("lists approvals with no-store so no response is reused across accounts", async () => {
    mockFetch.mockResolvedValueOnce({ carts_with_approvals: [] })

    await listApprovals()

    expect(mockFetch).toHaveBeenCalledWith(
      "/store/approvals",
      expect.objectContaining({ cache: "no-store" })
    )
    expect(mockFetch.mock.calls[0][1]).not.toHaveProperty("next")
  })
})
