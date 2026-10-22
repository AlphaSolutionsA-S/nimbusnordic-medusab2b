/**
 * @jest-environment node
 */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/config", () => ({ sdk: { client: { fetch: jest.fn() } } }))
jest.mock("next/cache", () => ({ unstable_cache: jest.fn(), revalidateTag: jest.fn() }))

import { revalidateTag } from "next/cache"

type Refresh = typeof import("@/lib/data/ui-translations-refresh")

const publication = {
  default_locale: "en",
  countries: [
    { country_code: "de", locale: "de", source: "explicit" },
    { country_code: "dk", locale: "da", source: "explicit" },
    { country_code: "fr", locale: "fr", source: "explicit" },
    { country_code: "gb", locale: "en", source: "default" },
    { country_code: "nl", locale: "nl", source: "explicit" },
    { country_code: "us", locale: "en", source: "default" },
  ],
}

function load(): Refresh {
  let mod: Refresh | undefined
  jest.isolateModules(() => {
    require("@/lib/config").sdk.client.fetch.mockResolvedValue(publication)
    mod = require("@/lib/data/ui-translations-refresh")
  })
  return mod as Refresh
}

describe("refreshUiTranslationsForCountry", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    ;(revalidateTag as jest.Mock).mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("invalidates the cache tag of the country's published language", async () => {
    await load().refreshUiTranslationsForCountry("dk")

    expect(revalidateTag).toHaveBeenCalledTimes(1)
    expect(revalidateTag).toHaveBeenCalledWith("ui-translations:da")
  })

  it("invalidates a ninth published language", async () => {
    await load().refreshUiTranslationsForCountry("nl")

    expect(revalidateTag).toHaveBeenCalledWith("ui-translations:nl")
  })

  it.each([["zz"], ["se"], ["zz/../anything"], ["da"], [""], ["ui-translations:en"]])(
    "invalidates nothing for the unpublished or attacker input %p",
    async (input) => {
      await load().refreshUiTranslationsForCountry(input)

      expect(revalidateTag).not.toHaveBeenCalled()
    }
  )

  it("invalidates a locale at most once per window, also across countries sharing it", async () => {
    const { refreshUiTranslationsForCountry } = load()

    await refreshUiTranslationsForCountry("de")
    await refreshUiTranslationsForCountry("de")
    expect(revalidateTag).toHaveBeenCalledTimes(1)

    await refreshUiTranslationsForCountry("fr")
    expect(revalidateTag).toHaveBeenCalledTimes(2)

    await refreshUiTranslationsForCountry("gb")
    await refreshUiTranslationsForCountry("us")
    expect(revalidateTag).toHaveBeenCalledTimes(3)

    jest.advanceTimersByTime(10_000)
    await refreshUiTranslationsForCountry("de")
    expect(revalidateTag).toHaveBeenCalledTimes(4)
  })

  it("uses the legacy map when no publication has loaded", async () => {
    let mod: Refresh | undefined
    jest.isolateModules(() => {
      require("@/lib/config").sdk.client.fetch.mockRejectedValue(new TypeError("fetch failed"))
      mod = require("@/lib/data/ui-translations-refresh")
    })
    jest.spyOn(console, "warn").mockImplementation(() => undefined)

    await (mod as Refresh).refreshUiTranslationsForCountry("se")
    await (mod as Refresh).refreshUiTranslationsForCountry("nl")

    expect(revalidateTag).toHaveBeenCalledTimes(1)
    expect(revalidateTag).toHaveBeenCalledWith("ui-translations:sv")
  })
})
