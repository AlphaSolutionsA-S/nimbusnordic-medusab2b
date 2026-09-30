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
jest.mock("@/lib/i18n/missing-key-server", () => ({
  reportMissingTranslation: jest.fn(),
  reportTranslationFormattingError: jest.fn(),
}))
jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Headers({ "x-storefront-pathname": "/dk/cart" })),
}))

import getRequestConfigForRequest from "@/i18n/request"
import { getRuntimeMessages } from "@/lib/data/ui-translations"
import {
  reportMissingTranslation,
  reportTranslationFormattingError,
} from "@/lib/i18n/missing-key-server"

const missing = () => Object.assign(new Error("missing"), { code: "MISSING_MESSAGE" })

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

  beforeEach(() => {
    jest.mocked(reportMissingTranslation).mockClear()
  })

  it("resolves database messages for a known locale (TC-2)", async () => {
    const result = await resolve("da")

    expect(result.locale).toBe("da")
    expect(result.messages).toEqual(mockRuntime.da.messages)
    expect(getRuntimeMessages).toHaveBeenCalledWith("da")
    expect(reportMissingTranslation).not.toHaveBeenCalled()
  })

  it("falls back to the default locale for an unrecognized value (TC-3)", async () => {
    const result = await resolve("us")

    expect(result.locale).toBe(DEFAULT_LOCALE)
    expect(result.messages).toEqual(mockRuntime.en.messages)
  })

  it("renders raw keys through the shared fallback, including root 404/metadata outside the provider (TC-6)", async () => {
    const result = await resolve(undefined)

    expect(
      result.getMessageFallback?.({ namespace: "Common.notFound", key: "headingLabel", error: missing() } as never)
    ).toBe("Common.notFound.headingLabel")
    expect(() => result.onError?.(missing() as never)).not.toThrow()
  })

  it("serves an empty document with raw keys and one locale event for an unavailable locale (TC-2)", async () => {
    const result = await resolve("sv")

    expect(result.messages).toEqual({})
    for (const key of ["welcome", "title", "other"]) {
      expect(result.getMessageFallback?.({ namespace: "Common", key, error: missing() } as never)).toBe(
        "Common." + key
      )
    }
    expect(reportMissingTranslation).toHaveBeenCalledTimes(1)
    expect(reportMissingTranslation).toHaveBeenCalledWith({
      kind: "locale_unavailable",
      locale: "sv",
      page_path: "/dk/cart",
    })
  })

  it("reports a neutral path when the middleware pathname header is absent", async () => {
    jest.mocked(require("next/headers").headers).mockResolvedValueOnce(new Headers())
    await resolve("sv")

    expect(reportMissingTranslation).toHaveBeenCalledWith({
      kind: "locale_unavailable",
      locale: "sv",
      page_path: "/unknown",
    })
  })

  it("reports an individual missing key with the middleware route context (Task 07 TC-3)", async () => {
    const result = await resolve("da")

    result.getMessageFallback?.({ namespace: "Order", key: "status.shipped", error: missing() } as never)
    expect(reportMissingTranslation).toHaveBeenCalledWith({
      kind: "key",
      locale: "da",
      key: "Order.status.shipped",
      page_path: "/dk/cart",
    })
    result.onError?.(Object.assign(new Error("{amount} failed"), { code: "FORMATTING_ERROR" }) as never)
    expect(reportTranslationFormattingError).toHaveBeenCalledWith("FORMATTING_ERROR")
  })
})
