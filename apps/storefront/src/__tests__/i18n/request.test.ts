import type { GetRequestConfigParams } from "next-intl/server"

import { DEFAULT_LOCALE } from "@/lib/i18n/country-language-map"
import type { RuntimeMessages } from "@/types/ui-translations"

// `getRequestConfig` from `next-intl/server` is normally an identity wrapper,
// but resolving the module in a non-RSC test environment yields a stub that
// throws on call. Mocking it to identity lets this test exercise the real
// locale-resolution logic in `request.ts` regardless of module resolution.
jest.mock("next-intl/server", () => ({
  getRequestConfig: (fn: unknown) => fn,
}))

// Runtime messages come from the backend loader only; it is the single source mocked here.
const mockRuntime: Record<string, RuntimeMessages> = {
  da: { locale: "da", messages: { Common: { welcome: "Velkommen" } }, availability: "available", version: 3 },
  en: { locale: "en", messages: { Common: { welcome: "Welcome" } }, availability: "available", version: 1 },
  sv: { locale: "sv", messages: {}, availability: "unavailable", version: null },
}
jest.mock("@/lib/data/ui-translations", () => ({
  getRuntimeMessages: jest.fn(async (locale: string) => mockRuntime[locale]),
}))

import getRequestConfigForRequest from "@/i18n/request"
import { getRuntimeMessages } from "@/lib/data/ui-translations"

// `requestLocale` here is a real locale (e.g. "da"), not a country code — it
// comes from the `X-NEXT-INTL-LOCALE` header that middleware.ts sets via
// `getLocaleForCountry(countryCode)`. This file no longer re-maps a country
// code, since `requestLocale` was found (NIMBUS-169 visual QA) to not
// reliably carry the country code at all via `setRequestLocale` alone in
// this Next.js/next-intl version combination — every non-English locale was
// silently rendering English messages. See middleware.ts and this file's own
// comment for the full explanation.
describe("i18n/request", () => {
  async function resolve(locale: string | undefined) {
    const params: GetRequestConfigParams = { requestLocale: Promise.resolve(locale) }
    return getRequestConfigForRequest(params)
  }

  it("resolves database messages for a known locale (TC-2)", async () => {
    const result = await resolve("da")

    expect(result.locale).toBe("da")
    expect(result.messages).toEqual(mockRuntime.da.messages)
    expect(getRuntimeMessages).toHaveBeenCalledWith("da")
  })

  it("falls back to the default locale for an unrecognized value (TC-3)", async () => {
    const result = await resolve("us")

    expect(result.locale).toBe(DEFAULT_LOCALE)
    expect(result.messages).toEqual(mockRuntime.en.messages)
  })

  it("renders raw keys through the shared fallback, including root 404/metadata outside the provider (TC-6)", async () => {
    const result = await resolve(undefined)
    const error = Object.assign(new Error("missing"), { code: "MISSING_MESSAGE" })

    expect(result.getMessageFallback?.({ namespace: "Common.notFound", key: "headingLabel", error } as never)).toBe(
      "Common.notFound.headingLabel"
    )
    expect(() => result.onError?.(error as never)).not.toThrow()
  })

  it("serves an empty document with raw keys for an unavailable locale (TC-2)", async () => {
    const result = await resolve("sv")

    expect(result.messages).toEqual({})
    const error = Object.assign(new Error("missing"), { code: "MISSING_MESSAGE" })
    expect(result.getMessageFallback?.({ namespace: "Common", key: "welcome", error } as never)).toBe(
      "Common.welcome"
    )
  })
})
