/**
 * @jest-environment node
 */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/config", () => ({ sdk: { client: { fetch: jest.fn() } } }))
jest.mock("next/cache", () => ({ unstable_cache: jest.fn(), revalidateTag: jest.fn() }))

import { revalidateTag } from "next/cache"

type Refresh = typeof import("@/lib/data/ui-translations-refresh")

function load(): Refresh {
  let mod: Refresh | undefined
  jest.isolateModules(() => {
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

  it("invalidates the cache tag of the country's language", async () => {
    await load().refreshUiTranslationsForCountry("dk")

    expect(revalidateTag).toHaveBeenCalledTimes(1)
    expect(revalidateTag).toHaveBeenCalledWith("ui-translations:da")
  })

  it("maps an unknown country to the default locale instead of an arbitrary tag", async () => {
    await load().refreshUiTranslationsForCountry("zz/../anything")

    expect(revalidateTag).toHaveBeenCalledWith("ui-translations:en")
  })

  it("invalidates a locale at most once per window", async () => {
    const { refreshUiTranslationsForCountry } = load()

    await refreshUiTranslationsForCountry("de")
    await refreshUiTranslationsForCountry("de")
    expect(revalidateTag).toHaveBeenCalledTimes(1)

    await refreshUiTranslationsForCountry("fr")
    expect(revalidateTag).toHaveBeenCalledTimes(2)

    jest.advanceTimersByTime(10_000)
    await refreshUiTranslationsForCountry("de")
    expect(revalidateTag).toHaveBeenCalledTimes(3)
  })
})
