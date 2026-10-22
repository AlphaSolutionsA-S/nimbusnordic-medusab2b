/**
 * Unit tests for the runtime translation loader. `next/cache` is replaced by a small in-memory
 * stand-in that, like Next 15, drops tag-invalidated entries and never stores a thrown failure.
 * Real cache/invalidation/outage behaviour is verified separately against a production build.
 *
 * @jest-environment node
 */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/config", () => ({ sdk: { client: { fetch: jest.fn() } } }))
jest.mock("next/cache", () => {
  const entries = new Map<string, { body: string; tags: string[] }>()
  return {
    __entries: entries,
    unstable_cache:
      (fn: (...args: unknown[]) => Promise<unknown>, keyParts: string[], options: { tags: string[] }) =>
      async (...args: unknown[]) => {
        const key = JSON.stringify([keyParts, args])
        const hit = entries.get(key)
        if (hit) {
          return JSON.parse(hit.body)
        }
        const value = await fn(...args)
        entries.set(key, { body: JSON.stringify(value), tags: options.tags })
        return value
      },
    revalidateTag: (tag: string) => {
      for (const [key, entry] of entries) {
        if (entry.tags.includes(tag)) {
          entries.delete(key)
        }
      }
    },
  }
})

type Loader = typeof import("@/lib/data/ui-translations")

const danish = { Common: { welcome: "Velkommen" } }
const danishV2 = { Common: { welcome: "Velkommen igen" } }

function doc(version: number, messages = danish, locale = "da") {
  return { id: "sftr_1", locale, version, is_active: true, updated_at: "2026-09-30T00:00:00.000Z", messages }
}

function sdkError(status: number | undefined, message: string) {
  return Object.assign(new Error(message), status === undefined ? {} : { status })
}

let loader: Loader
let fetchMock: jest.Mock
let revalidateTag: (tag: string) => void

beforeEach(() => {
  jest.resetModules()
  jest.spyOn(console, "warn").mockImplementation(() => undefined)
  fetchMock = require("@/lib/config").sdk.client.fetch
  revalidateTag = require("next/cache").revalidateTag
  loader = require("@/lib/data/ui-translations")
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("getRuntimeMessages", () => {
  it("TC-1: reads the locale from the store API without HTTP caching and caches the result", async () => {
    fetchMock.mockResolvedValue({ translation: doc(1) })
    const first = await loader.getRuntimeMessages("da")
    const second = await loader.getRuntimeMessages("da")
    expect(first).toEqual({ locale: "da", messages: danish, availability: "available", version: 1 })
    expect(second.messages).toEqual(danish)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/store/ui-translations/da", {
      method: "GET",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    })
    expect(loader.translationCacheTag("da")).toBe("ui-translations:da")
  })

  it("TC-2: serves the last good copy after invalidation plus outage, then recovers", async () => {
    fetchMock.mockResolvedValueOnce({ translation: doc(1) })
    await loader.getRuntimeMessages("da")
    revalidateTag("ui-translations:da")
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))
    expect(await loader.getRuntimeMessages("da")).toMatchObject({ messages: danish, availability: "available" })

    fetchMock.mockResolvedValueOnce({ translation: doc(2, danishV2) })
    expect(await loader.getRuntimeMessages("da")).toMatchObject({ messages: danishV2, version: 2 })
    expect(fetchMock.mock.calls.every(([url]) => url === "/store/ui-translations/da")).toBe(true)
  })

  it("TC-2: a hung backend read times out and serves the last good copy, then raw keys", async () => {
    fetchMock.mockResolvedValueOnce({ translation: doc(1) })
    await loader.getRuntimeMessages("da")
    revalidateTag("ui-translations:da")

    const controllers: AbortController[] = []
    const timeout = jest.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController()
      controllers.push(controller)
      return controller.signal
    })
    const hang = (_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError")))
      })
    fetchMock.mockImplementationOnce(hang).mockImplementationOnce(hang)

    const warm = loader.getRuntimeMessages("da")
    const cold = loader.getRuntimeMessages("sv")
    await Promise.resolve()
    expect(timeout).toHaveBeenCalledWith(3000)
    controllers.forEach((controller) => controller.abort())

    expect(await warm).toMatchObject({ messages: danish, availability: "available", version: 1 })
    expect(await cold).toMatchObject({ messages: {}, availability: "unavailable" })
  })

  it("TC-2: renders raw keys on a cold outage and never caches the failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))
    expect(await loader.getRuntimeMessages("sv")).toEqual({
      locale: "sv",
      messages: {},
      availability: "unavailable",
      version: null,
    })
    fetchMock.mockResolvedValueOnce({ translation: doc(1, danish, "sv") })
    expect(await loader.getRuntimeMessages("sv")).toMatchObject({ availability: "available" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(console.warn).toHaveBeenCalledWith("[ui-translations] load failed", expect.objectContaining({ locale: "sv" }))
  })

  it("TC-2: rejects a malformed response without caching it", async () => {
    fetchMock.mockResolvedValueOnce({ translation: { ...doc(1), messages: { Common: ["x"] } } })
    expect((await loader.getRuntimeMessages("da")).availability).toBe("unavailable")
    fetchMock.mockResolvedValueOnce({ translation: doc(1, danish, "de") })
    expect((await loader.getRuntimeMessages("da")).availability).toBe("unavailable")
    fetchMock.mockResolvedValueOnce({ translation: doc(1) })
    expect((await loader.getRuntimeMessages("da")).availability).toBe("available")
  })

  it("TC-3: a confirmed inactive response clears the snapshot; an absent row keeps it", async () => {
    fetchMock.mockResolvedValueOnce({ translation: doc(1) })
    await loader.getRuntimeMessages("da")
    revalidateTag("ui-translations:da")
    fetchMock.mockRejectedValueOnce(sdkError(404, "translation_not_found"))
    expect((await loader.getRuntimeMessages("da")).messages).toEqual(danish)

    fetchMock.mockRejectedValueOnce(sdkError(404, "translation_inactive"))
    expect(await loader.getRuntimeMessages("da")).toMatchObject({ availability: "inactive", messages: {} })
    // The tombstone is a cached result, so the old active copy is not re-read.
    expect(await loader.getRuntimeMessages("da")).toMatchObject({ availability: "inactive" })
    revalidateTag("ui-translations:da")
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))
    expect(await loader.getRuntimeMessages("da")).toMatchObject({ availability: "unavailable", messages: {} })
  })

  it("TC-3: older callbacks and cached reads cannot overwrite a newer inactive watermark", async () => {
    fetchMock.mockResolvedValueOnce({ translation: doc(2) })
    await loader.getRuntimeMessages("da")
    expect(loader.recordTranslationRefresh({ locale: "da", version: 3, is_active: false })).toBe(true)
    expect(loader.recordTranslationRefresh({ locale: "da", version: 2, is_active: true })).toBe(false)
    expect(loader.recordTranslationRefresh({ locale: "da", version: 3, is_active: true })).toBe(false)
    // The cached v2 active entry (not yet invalidated) must not be served over the v3 deactivation.
    expect(await loader.getRuntimeMessages("da")).toMatchObject({ availability: "inactive" })
    revalidateTag("ui-translations:da")
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))
    expect((await loader.getRuntimeMessages("da")).availability).toBe("unavailable")

    expect(loader.recordTranslationRefresh({ locale: "da", version: 4, is_active: true })).toBe(true)
    fetchMock.mockResolvedValueOnce({ translation: doc(4, danishV2) })
    expect(await loader.getRuntimeMessages("da")).toMatchObject({ availability: "available", version: 4 })
  })

  it("TC-3: an older result never replaces a newer snapshot", async () => {
    fetchMock.mockResolvedValueOnce({ translation: doc(5, danishV2) })
    await loader.getRuntimeMessages("da")
    revalidateTag("ui-translations:da")
    fetchMock.mockResolvedValueOnce({ translation: doc(4) })
    expect(await loader.getRuntimeMessages("da")).toMatchObject({ version: 5, messages: danishV2 })
  })

  it("a snapshot and watermark stop blocking lower versions after the TTL (DB restore)", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000)
    fetchMock.mockResolvedValueOnce({ translation: doc(5, danishV2) })
    await loader.getRuntimeMessages("da")
    expect(loader.recordTranslationRefresh({ locale: "da", version: 6, is_active: true })).toBe(true)

    // Within the TTL the restored lower versions are still blocked.
    now.mockReturnValue(1_000_000 + 599_999)
    expect(loader.recordTranslationRefresh({ locale: "da", version: 2, is_active: true })).toBe(false)
    revalidateTag("ui-translations:da")
    fetchMock.mockResolvedValueOnce({ translation: doc(2) })
    expect(await loader.getRuntimeMessages("da")).toMatchObject({ version: 5, messages: danishV2 })

    // After 2 x the revalidate period the restored database wins.
    now.mockReturnValue(1_000_000 + 600_000)
    expect(loader.recordTranslationRefresh({ locale: "da", version: 2, is_active: true })).toBe(true)
    revalidateTag("ui-translations:da")
    fetchMock.mockResolvedValueOnce({ translation: doc(2) })
    expect(await loader.getRuntimeMessages("da")).toMatchObject({ version: 2, messages: danish })
    // The restored copy is now the last good copy for an outage.
    revalidateTag("ui-translations:da")
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"))
    expect(await loader.getRuntimeMessages("da")).toMatchObject({ version: 2, messages: danish })
  })

  it("keeps an explicitly active empty document as a legitimate success", async () => {
    fetchMock.mockResolvedValueOnce({ translation: doc(1, {} as typeof danish) })
    expect(await loader.getRuntimeMessages("da")).toMatchObject({ availability: "available", messages: {} })
  })
})

export {}
