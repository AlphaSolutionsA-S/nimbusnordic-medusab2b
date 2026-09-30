type ClientModule = typeof import("@/lib/i18n/missing-key-client")

let client: ClientModule
let fetchMock: jest.Mock

function key(name: string) {
  return { kind: "key" as const, locale: "da", key: name, page_path: "/dk/cart?secret=1" }
}

function sentReports(call = 0) {
  return JSON.parse(fetchMock.mock.calls[call][1].body).reports
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.resetModules()
  fetchMock = jest.fn().mockResolvedValue({ ok: true })
  global.fetch = fetchMock as unknown as typeof fetch
  client = require("@/lib/i18n/missing-key-client")
})

afterEach(() => {
  jest.useRealTimers()
})

describe("missing-key client queue", () => {
  it("TC-3: batches and deduplicates without any network call during enqueue", async () => {
    client.enqueueMissingTranslation(key("Cart.a"))
    client.enqueueMissingTranslation(key("Cart.a"))
    client.enqueueMissingTranslation(key("Order.status.shipped"))
    expect(fetchMock).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(2000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/translations/missing")
    expect(init).toMatchObject({ method: "POST", keepalive: true, credentials: "same-origin" })
    expect(sentReports()).toEqual([
      { kind: "key", locale: "da", key: "Cart.a", page_path: "/dk/cart" },
      { kind: "key", locale: "da", key: "Order.status.shipped", page_path: "/dk/cart" },
    ])

    client.enqueueMissingTranslation(key("Cart.a"))
    await jest.advanceTimersByTimeAsync(2000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("reports a key again after the dedup window", async () => {
    client.enqueueMissingTranslation(key("Cart.a"))
    await jest.advanceTimersByTimeAsync(2000)
    jest.setSystemTime(Date.now() + 5 * 60 * 1000 + 1)
    client.enqueueMissingTranslation(key("Cart.a"))
    await jest.advanceTimersByTimeAsync(2000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("TC-4: bounds the queue to one batch", async () => {
    for (let i = 0; i < 80; i++) {
      client.enqueueMissingTranslation(key(`Flood.k${i}`))
    }
    await jest.advanceTimersByTimeAsync(2000)
    expect(sentReports()).toHaveLength(50)
  })

  it("flushes on pagehide", async () => {
    client.enqueueMissingTranslation(key("Cart.a"))
    window.dispatchEvent(new Event("pagehide"))
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("TC-5: swallows reporting failures without retrying", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"))
    client.enqueueMissingTranslation(key("Cart.a"))
    await jest.advanceTimersByTimeAsync(2000)
    await jest.advanceTimersByTimeAsync(60000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

export {}
