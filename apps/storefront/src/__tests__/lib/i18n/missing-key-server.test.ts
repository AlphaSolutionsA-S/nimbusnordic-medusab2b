/**
 * @jest-environment node
 */
jest.mock("server-only", () => ({}))
const mockBackendFetch = jest.fn()
const mockMedusa = jest.fn().mockImplementation(() => ({ client: { fetch: mockBackendFetch } }))
jest.mock("@medusajs/js-sdk", () => ({ __esModule: true, default: mockMedusa }))
const mockAfter: Array<() => Promise<void>> = []
jest.mock("next/server", () => ({
  after: jest.fn((callback: () => Promise<void>) => {
    mockAfter.push(callback)
  }),
}))

import { sanitizeTranslationPagePath } from "@/lib/i18n/missing-key-validation"

type ServerModule = typeof import("@/lib/i18n/missing-key-server")

let server: ServerModule

beforeEach(() => {
  jest.resetModules()
  mockAfter.length = 0
  mockBackendFetch.mockReset()
  mockBackendFetch.mockResolvedValue({})
  mockMedusa.mockClear()
  jest.spyOn(console, "warn").mockImplementation(() => undefined)
  process.env.TRANSLATION_REPORT_SECRET = "server-report-secret"
  server = require("@/lib/i18n/missing-key-server")
})

afterEach(() => {
  jest.restoreAllMocks()
})

async function runAfter() {
  for (const callback of mockAfter.splice(0)) {
    await callback()
  }
}

describe("server missing-key reporting", () => {
  it("TC-3: logs once, schedules one after() and forwards a deduplicated batch", async () => {
    server.reportMissingTranslation({ kind: "key", locale: "da", key: "Order.status.shipped", page_path: "/dk/order" })
    server.reportMissingTranslation({ kind: "key", locale: "da", key: "Order.status.shipped", page_path: "/dk/order" })
    server.reportMissingTranslation({ kind: "key", locale: "da", key: "Cart.title", page_path: "/dk/cart" })
    expect(mockAfter).toHaveLength(1)
    expect(console.warn).toHaveBeenCalledTimes(2)
    expect(console.warn).toHaveBeenCalledWith("[ui-translations] missing message", {
      locale: "da",
      kind: "key",
      key: "Order.status.shipped",
      page_path: "/dk/order",
    })

    await runAfter()
    expect(mockBackendFetch).toHaveBeenCalledTimes(1)
    expect(mockBackendFetch.mock.calls[0][1]).toMatchObject({
      headers: { authorization: "Bearer server-report-secret" },
      body: { reports: [expect.objectContaining({ key: "Order.status.shipped" }), expect.objectContaining({ key: "Cart.title" })] },
    })
    expect(mockMedusa).toHaveBeenCalledWith(expect.objectContaining({ debug: false }))
  })

  it("TC-3: reports a whole-locale outage as one typed event", async () => {
    for (let i = 0; i < 5; i++) {
      server.reportMissingTranslation({ kind: "locale_unavailable", locale: "sv", page_path: "/se" })
    }
    await runAfter()
    expect(mockBackendFetch.mock.calls[0][1].body.reports).toEqual([
      { kind: "locale_unavailable", locale: "sv", page_path: "/se" },
    ])
  })

  it("drops invalid keys and unsupported locales", async () => {
    server.reportMissingTranslation({ kind: "key", locale: "da", key: "__proto__.x", page_path: "/" })
    server.reportMissingTranslation({ kind: "key", locale: "xx", key: "Cart.title", page_path: "/" })
    expect(mockAfter).toHaveLength(0)
  })

  it("TC-5: a reporting outage is logged by status only and never re-reported", async () => {
    mockBackendFetch.mockRejectedValue(Object.assign(new Error("boom"), { status: 502 }))
    server.reportMissingTranslation({ kind: "key", locale: "da", key: "Cart.x", page_path: "/dk" })
    await runAfter()
    expect(console.warn).toHaveBeenLastCalledWith("[ui-translations] missing-key forwarding failed", { status: 502 })
    expect(mockAfter).toHaveLength(0)
  })

  it("skips forwarding when the secret is not configured", async () => {
    process.env.TRANSLATION_REPORT_SECRET = ""
    await server.forwardMissingTranslations([{ kind: "key", locale: "da", key: "Cart.x", page_path: "/" }])
    expect(mockBackendFetch).not.toHaveBeenCalled()
  })

  it("does not throw outside a request scope", () => {
    const next = require("next/server")
    jest.mocked(next.after).mockImplementationOnce(() => {
      throw new Error("after() outside request scope")
    })
    expect(() =>
      server.reportMissingTranslation({ kind: "key", locale: "da", key: "Build.x", page_path: "/" })
    ).not.toThrow()
  })

  it("TC-4: a report dropped at queue capacity is not marked as seen", async () => {
    for (let i = 0; i < 51; i++) {
      server.reportMissingTranslation({ kind: "key", locale: "da", key: `Full.k${i}`, page_path: "/dk" })
    }
    expect(console.warn).toHaveBeenCalledTimes(50)
    await runAfter()
    expect(mockBackendFetch.mock.calls[0][1].body.reports).toHaveLength(50)

    server.reportMissingTranslation({ kind: "key", locale: "da", key: "Full.k50", page_path: "/dk" })
    await runAfter()
    expect(mockBackendFetch.mock.calls[1][1].body.reports).toEqual([
      expect.objectContaining({ key: "Full.k50" }),
    ])
  })

  it("TC-4: rate-limits the per-report log line and reports the suppressed count", () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000)
    const reports = Array.from({ length: 50 }, (_, i) => ({
      kind: "key" as const,
      locale: "da" as const,
      key: `Log.k${i}`,
      page_path: "/dk",
    }))
    server.acceptMissingReports(reports)
    const accepted = server.acceptMissingReports(reports.map((r) => ({ ...r, key: `${r.key}b` })))
    expect(accepted).toHaveLength(50)
    expect(console.warn).toHaveBeenCalledTimes(60)

    now.mockReturnValue(1_000_000 + 60_000)
    server.acceptMissingReports([{ kind: "key", locale: "da", key: "Log.next", page_path: "/dk" }])
    expect(console.warn).toHaveBeenCalledWith("[ui-translations] missing message logs suppressed", {
      count: 40,
    })
    expect(console.warn).toHaveBeenLastCalledWith(
      "[ui-translations] missing message",
      expect.objectContaining({ key: "Log.next" })
    )
  })

  it("logs formatting errors once per code", () => {
    server.reportTranslationFormattingError("FORMATTING_ERROR")
    server.reportTranslationFormattingError("FORMATTING_ERROR")
    expect(console.warn).toHaveBeenCalledTimes(1)
  })
})

describe("sanitizeTranslationPagePath (TC-6)", () => {
  it.each([
    ["/dk/cart?token=abc#frag", "/dk/cart"],
    ["/dk/account/orders/details/order_01HXYZABCDEF", "/dk/account/orders/details/[id]"],
    ["/dk/account/quotes/details/quote_01ABCDEFG", "/dk/account/quotes/details/[id]"],
    ["/dk/order/confirmed/order_123456", "/dk/order/confirmed/[id]"],
    ["/dk/products/blue-shirt", "/dk/products/blue-shirt"],
    ["/dk/account/profile/jane@example.com", "/dk/account/profile/[segment]"],
    ["/dk/x/550e8400-e29b-41d4-a716-446655440000", "/dk/x/[id]"],
    ["https://evil.example/path", "/unknown"],
    ["//evil.example/path", "/unknown"],
    ["relative", "/unknown"],
  ])("maps %s to %s", (input, expected) => {
    expect(sanitizeTranslationPagePath(input)).toBe(expected)
  })

  it("bounds the length", () => {
    expect(sanitizeTranslationPagePath("/" + "a/".repeat(400)).length).toBeLessThanOrEqual(512)
  })
})
