/**
 * @jest-environment node
 */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/config", () => ({ sdk: { client: { fetch: jest.fn() } } }))
jest.mock("next/cache", () => ({ revalidateTag: jest.fn(), unstable_cache: jest.fn() }))

import { revalidateTag } from "next/cache"
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

beforeEach(() => {
  jest.resetModules()
  jest.mocked(revalidateTag).mockClear()
  process.env.REVALIDATE_SECRET = SECRET
  POST = require("@/app/api/translations/revalidate/route").POST
})

afterAll(() => {
  delete process.env.REVALIDATE_SECRET
})

describe("POST /api/translations/revalidate", () => {
  it("invalidates only the selected locale's tag", async () => {
    const response = await POST(request({ locale: "da", version: 2, is_active: true }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ revalidated: true })
    const nextCache = require("next/cache")
    expect(nextCache.revalidateTag).toHaveBeenCalledTimes(1)
    expect(nextCache.revalidateTag).toHaveBeenCalledWith("ui-translations:da")
  })

  it.each([
    ["no secret header", null],
    ["a wrong secret", "Bearer wrong-secret-value-of-some-len"],
    ["a non-bearer scheme", `Basic ${SECRET}`],
  ])("TC-1: rejects %s without invalidating", async (_name, authorization) => {
    const response = await POST(request({ locale: "da", version: 2, is_active: true }, authorization))
    expect(response.status).toBe(401)
    expect(require("next/cache").revalidateTag).not.toHaveBeenCalled()
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
    expect(require("next/cache").revalidateTag).not.toHaveBeenCalled()
  })

  it("rejects bodies over 2 KiB", async () => {
    const response = await POST(request({ locale: "da", version: 2, is_active: true, pad: "x".repeat(3000) }))
    expect(response.status).toBe(413)
  })

  it("TC-1: an old callback cannot overwrite a newer activation decision", async () => {
    expect((await POST(request({ locale: "da", version: 5, is_active: false }))).status).toBe(200)
    const stale = await POST(request({ locale: "da", version: 4, is_active: true }))
    expect(await stale.json()).toEqual({ revalidated: false, reason: "outdated" })
    expect(require("next/cache").revalidateTag).toHaveBeenCalledTimes(1)
  })
})
