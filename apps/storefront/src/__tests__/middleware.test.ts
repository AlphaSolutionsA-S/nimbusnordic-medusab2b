/**
 * @jest-environment node
 */
import { NextRequest } from "next/server"

const originalEnv = process.env

describe("getCountryCode", () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  // TC-1: Fallback resolves to gb when env var is unset
  it("resolves to the gb default when NEXT_PUBLIC_DEFAULT_REGION is unset", async () => {
    delete process.env.NEXT_PUBLIC_DEFAULT_REGION

    const { getCountryCode } = await import("@/middleware")

    const request = new NextRequest("https://example.com/")
    const regionMap = new Map([["gb", 1]])

    const countryCode = await getCountryCode(request, regionMap)

    expect(countryCode).toBe("gb")
  })

  // TC-2: Explicit env var still overrides the new default
  it("resolves to the explicitly configured default region", async () => {
    process.env.NEXT_PUBLIC_DEFAULT_REGION = "dk"

    const { getCountryCode } = await import("@/middleware")

    const request = new NextRequest("https://example.com/")
    const regionMap = new Map([["dk", 1]])

    const countryCode = await getCountryCode(request, regionMap)

    expect(countryCode).toBe("dk")
  })
})

describe("middleware request headers (NIMBUS-175)", () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv, NEXT_PUBLIC_MEDUSA_BACKEND_URL: "http://backend.test" }
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ regions: [{ id: "reg_dk", countries: [{ iso_2: "dk" }] }] }),
    })) as unknown as typeof fetch
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("overwrites the storefront pathname header from the URL, without the query string", async () => {
    const { middleware } = await import("@/middleware")
    const request = new NextRequest("https://example.com/dk/cart?token=secret", {
      headers: { cookie: "_medusa_cache_id=abc", "x-storefront-pathname": "/forged" },
    })

    const response = await middleware(request)

    expect(response.headers.get("x-middleware-request-x-storefront-pathname")).toBe("/dk/cart")
    expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe("da")
  })

  it("overwrites a forged pathname header on the static-asset branch too", async () => {
    const { middleware } = await import("@/middleware")
    const request = new NextRequest("https://example.com/robots.txt", {
      headers: { cookie: "_medusa_cache_id=abc", "x-storefront-pathname": "/forged" },
    })

    const response = await middleware(request)

    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.headers.get("x-middleware-request-x-storefront-pathname")).toBe("/robots.txt")
  })
})
