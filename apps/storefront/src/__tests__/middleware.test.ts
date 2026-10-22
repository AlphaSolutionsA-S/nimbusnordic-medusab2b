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
  })

  it("forwards the URL country and deletes a forged locale and country context", async () => {
    const { middleware } = await import("@/middleware")
    const request = new NextRequest("https://example.com/dk/cart", {
      headers: {
        cookie: "_medusa_cache_id=abc",
        "x-next-intl-locale": "de",
        "x-storefront-country": "de",
      },
    })

    const response = await middleware(request)

    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.headers.get("x-middleware-request-x-storefront-country")).toBe("dk")
    // Overridden request headers are listed here; a deleted one is absent from the list.
    const overridden = response.headers.get("x-middleware-override-headers")?.split(",") ?? []
    expect(overridden).toContain("x-storefront-pathname")
    expect(overridden).not.toContain("x-next-intl-locale")
    expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBeNull()
  })

  it("forwards no country for a segment that only contains a country code", async () => {
    const { middleware } = await import("@/middleware")
    const request = new NextRequest("https://example.com/dkx/cart", {
      headers: { cookie: "_medusa_cache_id=abc", "x-storefront-country": "dk" },
    })

    const response = await middleware(request)

    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.headers.get("x-middleware-request-x-storefront-country")).toBeNull()
  })

  it.each([
    ["without a cookie cart", "_medusa_cache_id=abc"],
    ["with a cookie cart", "_medusa_cache_id=abc; _medusa_cart_id=cart_own"],
  ])(
    "passes the approval card's checkout link through %s, without redirecting or setting the cart cookie (NIMBUS-202)",
    async (_label, cookie) => {
      const { middleware } = await import("@/middleware")
      const request = new NextRequest(
        "https://example.com/dk/checkout?cartId=cart_colleague&step=payment",
        { headers: { cookie } }
      )

      const response = await middleware(request)

      expect(response.headers.get("x-middleware-next")).toBe("1")
      expect(response.headers.get("location")).toBeNull()
      expect(response.cookies.get("_medusa_cart_id")).toBeUndefined()
    }
  )

  it("overwrites a forged pathname header and drops forged locale context on the static-asset branch too", async () => {
    const { middleware } = await import("@/middleware")
    const request = new NextRequest("https://example.com/robots.txt", {
      headers: {
        cookie: "_medusa_cache_id=abc",
        "x-storefront-pathname": "/forged",
        "x-next-intl-locale": "de",
        "x-storefront-country": "de",
      },
    })

    const response = await middleware(request)

    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.headers.get("x-middleware-request-x-storefront-pathname")).toBe("/robots.txt")
    const overridden = response.headers.get("x-middleware-override-headers")?.split(",") ?? []
    expect(overridden).toContain("x-storefront-pathname")
    expect(overridden).not.toContain("x-next-intl-locale")
    expect(overridden).not.toContain("x-storefront-country")
  })
})
