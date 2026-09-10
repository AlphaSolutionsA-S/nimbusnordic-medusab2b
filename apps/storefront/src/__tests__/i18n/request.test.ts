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

// `requestLocale` here is a real locale (e.g. "da"), not a country code — it
// comes from the `X-NEXT-INTL-LOCALE` header that middleware.ts sets via
// `getLocaleForCountry(countryCode)`. This file no longer re-maps a country
// code, since `requestLocale` was found (NIMBUS-169 visual QA) to not
// reliably carry the country code at all via `setRequestLocale` alone in
// this Next.js/next-intl version combination — every non-English locale was
// silently rendering English messages. See middleware.ts and this file's own
// comment for the full explanation.
describe("i18n/request", () => {
  it("resolves messages for a known locale (TC-2)", async () => {
    const params: GetRequestConfigParams = {
      requestLocale: Promise.resolve("da"),
    }

    const result = await getRequestConfigForRequest(params)

    expect(result.locale).toBe("da")
    expect(result.messages).toHaveProperty("Common.welcome")
  })

  it("falls back to the default locale for an unrecognized value (TC-3)", async () => {
    const params: GetRequestConfigParams = {
      requestLocale: Promise.resolve("us"),
    }

    const result = await getRequestConfigForRequest(params)

    expect(result.locale).toBe(DEFAULT_LOCALE)
    expect(result.messages).toHaveProperty("Common.welcome")
  })
})
