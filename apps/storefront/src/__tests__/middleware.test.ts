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
