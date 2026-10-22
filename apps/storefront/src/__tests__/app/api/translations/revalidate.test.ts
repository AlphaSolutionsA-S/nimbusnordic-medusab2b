/**
 * @jest-environment node
 */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/config", () => ({ sdk: { client: { fetch: jest.fn() } } }))
jest.mock("next/cache", () => ({
  revalidateTag: jest.fn(),
  updateTag: jest.fn(),
  unstable_cache: jest.fn(),
}))

import { revalidateTag, updateTag } from "next/cache"
import { NextRequest } from "next/server"

type RouteModule = typeof import("@/app/api/translations/revalidate/route")

const SECRET = "storefront-revalidate-secret"
let POST: RouteModule["POST"]

function request(body: unknown, authorization: string | null = `Bearer ${SECRET}`) {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (authorization) {
    headers.authorization = authorization
  }
  return new NextRequest("http://localhost:8000/api/translations/revalidate", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

// `jest.resetModules` gives each test a fresh `next/cache` mock, so read it per test.
function nextCache(): { revalidateTag: jest.Mock; updateTag: jest.Mock } {
  return require("next/cache")
}

function expectNothingInvalidated() {
  expect(nextCache().revalidateTag).not.toHaveBeenCalled()
  expect(nextCache().updateTag).not.toHaveBeenCalled()
}

beforeEach(() => {
  jest.resetModules()
  jest.mocked(revalidateTag).mockClear()
  jest.mocked(updateTag).mockClear()
  process.env.REVALIDATE_SECRET = SECRET
  POST = require("@/app/api/translations/revalidate/route").POST
})

afterAll(() => {
  delete process.env.REVALIDATE_SECRET
})

describe("POST /api/translations/revalidate", () => {
  it("expires only the selected locale's tag, at once", async () => {
    const response = await POST(request({ locale: "da", version: 2, is_active: true }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ revalidated: true })
    // `updateTag` throws in a route handler; `{ expire: 0 }` is the immediate form there, and
    // any other profile (such as "max") would serve the old text once more.
    expect(nextCache().revalidateTag.mock.calls).toEqual([["ui-translations:da", { expire: 0 }]])
    expect(nextCache().updateTag).not.toHaveBeenCalled()
  })

  it.each([
    ["no secret header", null],
    ["a wrong secret", "Bearer wrong-secret-value-of-some-len"],
    ["a wrong secret of a different length", "Bearer x"],
    ["a longer secret with the right prefix", `Bearer ${SECRET}x`],
    ["a non-bearer scheme", `Basic ${SECRET}`],
  ])("TC-1: rejects %s without invalidating", async (_name, authorization) => {
    const response = await POST(request({ locale: "da", version: 2, is_active: true }, authorization))
    expect(response.status).toBe(401)
    expectNothingInvalidated()
  })

  it("TC-1: fails closed when no secret is configured", async () => {
    process.env.REVALIDATE_SECRET = ""
    const response = await POST(request({ locale: "da", version: 2, is_active: true }, "Bearer "))
    expect(response.status).toBe(401)
  })

  it.each([
    ["an invalid locale", { locale: "en_US", version: 2, is_active: true }],
    ["a non-positive version", { locale: "da", version: 0, is_active: true }],
    ["an extra field", { locale: "da", version: 2, is_active: true, tag: "cart" }],
    ["malformed JSON", "{"],
  ])("TC-1: rejects %s without invalidating", async (_name, body) => {
    const response = await POST(request(body))
    expect(response.status).toBe(400)
    expectNothingInvalidated()
  })

  it("rejects bodies over 2 KiB without invalidating", async () => {
    const response = await POST(request({ locale: "da", version: 2, is_active: true, pad: "x".repeat(3000) }))
    expect(response.status).toBe(413)
    expectNothingInvalidated()
  })

  it("TC-1: an old callback cannot overwrite a newer activation decision", async () => {
    expect((await POST(request({ locale: "da", version: 5, is_active: false }))).status).toBe(200)
    const stale = await POST(request({ locale: "da", version: 4, is_active: true }))
    expect(await stale.json()).toEqual({ revalidated: false, reason: "outdated" })
    expect(nextCache().revalidateTag.mock.calls).toEqual([["ui-translations:da", { expire: 0 }]])
    expect(nextCache().updateTag).not.toHaveBeenCalled()
  })
})
