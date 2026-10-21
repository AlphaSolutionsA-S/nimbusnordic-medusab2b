/**
 * @jest-environment node
 */
import type { GetRequestConfigParams } from "next-intl/server"

import type { RuntimeMessages } from "@/types/ui-translations"

// `getRequestConfig` from `next-intl/server` is normally an identity wrapper,
// but resolving the module in a non-RSC test environment yields a stub that
// throws on call. Mocking it to identity lets this test exercise the real
// locale-resolution logic in `request.ts` regardless of module resolution.
jest.mock("next-intl/server", () => ({
  getRequestConfig: (fn: unknown) => fn,
}))
jest.mock("server-only", () => ({}))
// The real country-language loader runs against this publication; only the transport is mocked.
jest.mock("@/lib/config", () => ({ sdk: { client: { fetch: jest.fn() } } }))

// Runtime messages come from the backend loader only; it is the single source mocked here.
const mockRuntime: Record<string, RuntimeMessages> = {
  da: { locale: "da", messages: { Common: { welcome: "Velkommen" } }, availability: "available", version: 3 },
  en: { locale: "en", messages: { Common: { welcome: "Welcome" } }, availability: "available", version: 1 },
  nl: { locale: "nl", messages: { Common: { welcome: "Welkom" } }, availability: "available", version: 1 },
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
  headers: jest.fn(),
}))

import { headers } from "next/headers"

import getRequestConfigForRequest from "@/i18n/request"
import { sdk } from "@/lib/config"
import { getRuntimeMessages } from "@/lib/data/ui-translations"
import {
  reportMissingTranslation,
  reportTranslationFormattingError,
} from "@/lib/i18n/missing-key-server"

const publication = {
  default_locale: "en",
  countries: [
    { country_code: "dk", locale: "da", source: "explicit" },
    { country_code: "gb", locale: "en", source: "default" },
    { country_code: "nl", locale: "nl", source: "explicit" },
    { country_code: "se", locale: "sv", source: "explicit" },
  ],
}

const missing = () => Object.assign(new Error("missing"), { code: "MISSING_MESSAGE" })

function requestHeaders(values: Record<string, string>) {
  jest.mocked(headers).mockResolvedValue(new Headers(values) as never)
}

describe("i18n/request", () => {
  async function resolve(requestLocale?: string) {
    const params: GetRequestConfigParams = { requestLocale: Promise.resolve(requestLocale) }
    return getRequestConfigForRequest(params)
  }

  beforeEach(() => {
    jest.mocked(reportMissingTranslation).mockClear()
    jest.mocked(sdk.client.fetch).mockResolvedValue(publication)
    requestHeaders({ "x-storefront-pathname": "/dk/cart", "x-storefront-country": "dk" })
  })

  it("resolves the URL country's published language and its database messages", async () => {
    const result = await resolve()

    expect(result.locale).toBe("da")
    expect(result.messages).toEqual(mockRuntime.da.messages)
    expect(getRuntimeMessages).toHaveBeenCalledWith("da")
    expect(reportMissingTranslation).not.toHaveBeenCalled()
  })

  it("serves a ninth published language with no code change", async () => {
    requestHeaders({ "x-storefront-pathname": "/nl", "x-storefront-country": "nl" })

    const result = await resolve()

    expect(result.locale).toBe("nl")
    expect(result.messages).toEqual(mockRuntime.nl.messages)
  })

  it("ignores a forged locale: next-intl's requestLocale is never the language", async () => {
    const result = await resolve("de")

    expect(result.locale).toBe("da")
  })

  it.each([
    ["no country context", { "x-storefront-pathname": "/" }],
    ["an unpublished country", { "x-storefront-country": "us" }],
    ["a malformed country", { "x-storefront-country": "dk/../se" }],
  ])("falls back to the published default for %s", async (_name, values) => {
    requestHeaders(values)

    const result = await resolve("da")

    expect(result.locale).toBe("en")
    expect(result.messages).toEqual(mockRuntime.en.messages)
  })

  it("renders raw keys through the shared fallback, including root 404/metadata outside the provider (TC-6)", async () => {
    requestHeaders({})
    const result = await resolve()

    expect(
      result.getMessageFallback?.({ namespace: "Common.notFound", key: "headingLabel", error: missing() } as never)
    ).toBe("Common.notFound.headingLabel")
    expect(() => result.onError?.(missing() as never)).not.toThrow()
  })

  it("serves an empty document with raw keys and one locale event for an unavailable locale (TC-2)", async () => {
    requestHeaders({ "x-storefront-pathname": "/se/cart", "x-storefront-country": "se" })
    const result = await resolve()

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
      page_path: "/se/cart",
    })
  })

  it("reports a neutral path when the middleware pathname header is absent", async () => {
    requestHeaders({ "x-storefront-country": "se" })
    await resolve()

    expect(reportMissingTranslation).toHaveBeenCalledWith({
      kind: "locale_unavailable",
      locale: "sv",
      page_path: "/unknown",
    })
  })

  it("reports an individual missing key with the middleware route context (Task 07 TC-3)", async () => {
    const result = await resolve()

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
