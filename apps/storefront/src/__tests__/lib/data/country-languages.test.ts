/**
 * Runtime country-language loader: freshness, outage fallback and response validation.
 * Each test loads a fresh module, which stands in for a fresh (restarted) worker process.
 *
 * @jest-environment node
 */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/config", () => ({ sdk: { client: { fetch: jest.fn() } } }))

type Loader = typeof import("@/lib/data/country-languages")

const publication = {
  default_locale: "en",
  countries: [
    { country_code: "dk", locale: "da", source: "explicit" },
    { country_code: "nl", locale: "nl", source: "explicit" },
    { country_code: "us", locale: "en", source: "default" },
  ],
}
const updated = {
  default_locale: "en",
  countries: [{ country_code: "dk", locale: "en", source: "explicit" }],
}

let loader: Loader
let fetchMock: jest.Mock
let now: jest.SpyInstance<number, []>

function freshWorker(): Loader {
  jest.resetModules()
  fetchMock = require("@/lib/config").sdk.client.fetch
  return require("@/lib/data/country-languages")
}

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined)
  now = jest.spyOn(Date, "now").mockReturnValue(1_000_000)
  loader = freshWorker()
})

afterEach(() => {
  jest.restoreAllMocks()
})

function at(ms: number) {
  now.mockReturnValue(1_000_000 + ms)
}

describe("getCountryLanguageSnapshot", () => {
  it("reads the public publication with no HTTP caching and a 3 s timeout", async () => {
    const timeout = jest.spyOn(AbortSignal, "timeout")
    fetchMock.mockResolvedValueOnce(publication)

    const snapshot = await loader.getCountryLanguageSnapshot()

    expect(snapshot).toEqual({ ...publication, availability: "available" })
    expect(fetchMock).toHaveBeenCalledWith("/store/country-languages", {
      method: "GET",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    })
    expect(timeout).toHaveBeenCalledWith(3000)
  })

  it("makes no backend request while fresh and reads again exactly at 240 s", async () => {
    fetchMock.mockResolvedValueOnce(publication).mockResolvedValueOnce(updated)
    await loader.getCountryLanguageSnapshot()

    at(239_999)
    for (let page = 0; page < 5; page++) {
      expect((await loader.getCountryLanguageSnapshot()).countries).toEqual(publication.countries)
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)

    at(240_000)
    expect(await loader.getCountryLanguageSnapshot()).toEqual({ ...updated, availability: "available" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("shares one in-flight read between overlapping requests", async () => {
    let resolve: (value: unknown) => void = () => undefined
    fetchMock.mockReturnValueOnce(new Promise((done) => (resolve = done)))

    const reads = [
      loader.getCountryLanguageSnapshot(),
      loader.getCountryLanguageSnapshot(),
      loader.getCountryLanguageSnapshot(),
    ]
    resolve(publication)

    const snapshots = await Promise.all(reads)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    snapshots.forEach((snapshot) => expect(snapshot.availability).toBe("available"))
  })

  it("serves the last good publication as stale after a failed refresh", async () => {
    fetchMock.mockResolvedValueOnce(publication)
    await loader.getCountryLanguageSnapshot()

    at(240_000)
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("Country languages are not available"), { status: 503 }))
    expect(await loader.getCountryLanguageSnapshot()).toEqual({ ...publication, availability: "stale" })
    expect(console.warn).toHaveBeenCalledWith("[country-languages] load failed", {
      status: 503,
      fallback: "stale",
    })
  })

  it("times out a hung read and falls back", async () => {
    const controllers: AbortController[] = []
    jest.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController()
      controllers.push(controller)
      return controller.signal
    })
    fetchMock.mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError")))
        })
    )

    const pending = loader.getCountryLanguageSnapshot()
    await Promise.resolve()
    controllers.forEach((controller) => controller.abort())

    expect((await pending).availability).toBe("legacy")
  })

  it("uses the approved legacy map on a cold outage, never an empty success", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))

    const snapshot = await loader.getCountryLanguageSnapshot()

    expect(snapshot.availability).toBe("legacy")
    expect(snapshot.default_locale).toBe("en")
    expect(snapshot.countries).toEqual(
      expect.arrayContaining([
        { country_code: "dk", locale: "da", source: "explicit" },
        { country_code: "se", locale: "sv", source: "explicit" },
      ])
    )
    expect(snapshot.countries).toHaveLength(8)
  })

  it("backs off for 10 s after a failure, then recovers on the next request", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))
    await loader.getCountryLanguageSnapshot()

    at(9_999)
    expect((await loader.getCountryLanguageSnapshot()).availability).toBe("legacy")
    expect(fetchMock).toHaveBeenCalledTimes(1)

    at(10_000)
    fetchMock.mockResolvedValueOnce(publication)
    expect(await loader.getCountryLanguageSnapshot()).toEqual({ ...publication, availability: "available" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("recovers from a failed refresh well within five minutes of the change", async () => {
    fetchMock.mockResolvedValueOnce(publication)
    await loader.getCountryLanguageSnapshot()

    // The Admin saves just after this read; the refresh at 240 s fails once.
    at(240_000)
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))
    expect((await loader.getCountryLanguageSnapshot()).availability).toBe("stale")

    at(250_000)
    fetchMock.mockResolvedValueOnce(updated)
    // 250 s after the change: inside the five-minute bound.
    expect(await loader.getCountryLanguageSnapshot()).toEqual({ ...updated, availability: "available" })
  })

  it("keeps nothing across a restart: a new worker in an outage uses the legacy map", async () => {
    fetchMock.mockResolvedValueOnce(publication)
    expect((await loader.getCountryLanguageSnapshot()).availability).toBe("available")

    const restarted = freshWorker()
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))
    const snapshot = await restarted.getCountryLanguageSnapshot()

    expect(snapshot.availability).toBe("legacy")
    expect(snapshot.countries.some((entry) => entry.country_code === "nl")).toBe(false)
  })

  it.each([
    ["a non-object body", "nope"],
    ["a missing default", { countries: publication.countries }],
    ["an extra top-level field", { ...publication, version: 4 }],
    ["a non-canonical locale", { ...publication, countries: [{ country_code: "dk", locale: "DA", source: "explicit" }] }],
    ["a malformed locale", { ...publication, countries: [{ country_code: "dk", locale: "en-", source: "explicit" }] }],
    ["an upper-case country", { ...publication, countries: [{ country_code: "DK", locale: "da", source: "explicit" }] }],
    ["an unknown source", { ...publication, countries: [{ country_code: "dk", locale: "da", source: "admin" }] }],
    ["an extra entry field", { ...publication, countries: [{ country_code: "dk", locale: "da", source: "explicit", actor: "x" }] }],
    [
      "a duplicate country",
      {
        ...publication,
        countries: [
          { country_code: "dk", locale: "da", source: "explicit" },
          { country_code: "dk", locale: "en", source: "default" },
        ],
      },
    ],
    [
      "too many countries",
      {
        ...publication,
        countries: Array.from({ length: 677 }, (_, i) => ({
          country_code: `${String.fromCharCode(97 + Math.floor(i / 26) % 26)}${String.fromCharCode(97 + (i % 26))}`,
          locale: "en",
          source: "default",
        })),
      },
    ],
    [
      "an over-long locale tag",
      {
        ...publication,
        countries: [{ country_code: "dk", locale: `en-x-${Array(12).fill("abcdefgh").join("-")}`, source: "explicit" }],
      },
    ],
  ])("rejects %s without caching it", async (_name, body) => {
    fetchMock.mockResolvedValueOnce(body)
    expect((await loader.getCountryLanguageSnapshot()).availability).toBe("legacy")

    at(10_000)
    fetchMock.mockResolvedValueOnce(publication)
    expect((await loader.getCountryLanguageSnapshot()).availability).toBe("available")
  })
})

describe("getCountryLanguageForCountry", () => {
  it("resolves a published ninth language and defaults a missing or unpublished country", async () => {
    fetchMock.mockResolvedValueOnce(publication)

    expect(await loader.getCountryLanguageForCountry("nl")).toEqual({ locale: "nl", availability: "available" })
    expect(await loader.getCountryLanguageForCountry("DK")).toEqual({ locale: "da", availability: "available" })
    expect((await loader.getCountryLanguageForCountry("zz")).locale).toBe("en")
    expect((await loader.getCountryLanguageForCountry(undefined)).locale).toBe("en")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

export {}
