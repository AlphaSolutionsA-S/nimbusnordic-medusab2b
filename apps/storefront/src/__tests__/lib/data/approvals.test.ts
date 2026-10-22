jest.mock("@/lib/config", () => ({
  sdk: { client: { fetch: jest.fn() } },
}))

jest.mock("@/lib/data/cookies", () => ({
  getAuthHeaders: jest.fn(async () => ({ authorization: "Bearer token" })),
  getCacheOptions: jest.fn(async () => ({ tags: ["approvals-cache"] })),
  getCacheTag: jest.fn(async (tag: string) => tag),
}))

jest.mock("@/lib/data/cart", () => ({
  retrieveCart: jest.fn(),
}))

jest.mock("next/cache", () => ({
  revalidateTag: jest.fn(),
  updateTag: jest.fn(),
}))

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}))

import { sdk } from "@/lib/config"
import { listApprovals, updateApproval } from "@/lib/data/approvals"
import { ApprovalStatusType } from "@/types/approval"
import { revalidateTag, updateTag } from "next/cache"

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

describe("updateApproval", () => {
  it("expires approvals and carts at once after the decision", async () => {
    mockFetch.mockResolvedValueOnce({ approval: { id: "appr_1" } })

    await updateApproval("appr_1", ApprovalStatusType.APPROVED)

    expect(jest.mocked(updateTag).mock.calls).toEqual([
      ["approvals"],
      ["carts"],
    ])
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
