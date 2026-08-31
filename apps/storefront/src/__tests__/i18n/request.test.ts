import type { GetRequestConfigParams } from "next-intl/server"

import { DEFAULT_LOCALE } from "@/lib/i18n/country-language-map"

// `getRequestConfig` from `next-intl/server` is normally an identity wrapper,
// but resolving the module in a non-RSC test environment yields a stub that
// throws on call. Mocking it to identity lets this test exercise the real
// locale-resolution logic in `request.ts` regardless of module resolution.
jest.mock("next-intl/server", () => ({
  getRequestConfig: (fn: unknown) => fn,
}))

import getRequestConfigForRequest from "@/i18n/request"

describe("i18n/request", () => {
  it("resolves messages for a known country (TC-2)", async () => {
    const params: GetRequestConfigParams = {
      requestLocale: Promise.resolve("dk"),
    }

    const result = await getRequestConfigForRequest(params)

    expect(result.locale).toBe("da")
    expect(result.messages).toHaveProperty("Common.welcome")
  })

  it("falls back to the default locale for an unmapped country (TC-3)", async () => {
    const params: GetRequestConfigParams = {
      requestLocale: Promise.resolve("us"),
    }

    const result = await getRequestConfigForRequest(params)

    expect(result.locale).toBe(DEFAULT_LOCALE)
    expect(result.messages).toHaveProperty("Common.welcome")
  })
})
