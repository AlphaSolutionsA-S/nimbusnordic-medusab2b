/**
 * @jest-environment node
 */
jest.mock("server-only", () => ({}))
const mockBackendFetch = jest.fn()
jest.mock("@medusajs/js-sdk", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ client: { fetch: mockBackendFetch } })),
}))

import { NextRequest } from "next/server"

type RouteModule = typeof import("@/app/api/translations/missing/route")

const ORIGIN = "http://localhost:8000"
const REPORT_SECRET = "report-secret-value"
let POST: RouteModule["POST"]

const report = { kind: "key", locale: "da", key: "Cart.missing", page_path: "/dk/cart" }

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${ORIGIN}/api/translations/missing`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

function streamingRequest(bytes: number) {
  const chunk = new TextEncoder().encode("x".repeat(1024))
  let sent = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bytes) {
        controller.close()
        return
      }
      sent += chunk.byteLength
      controller.enqueue(chunk)
    },
  })
  return new NextRequest(`${ORIGIN}/api/translations/missing`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body,
    duplex: "half",
  } as ConstructorParameters<typeof NextRequest>[1] & { duplex: "half" })
}

beforeEach(() => {
  jest.resetModules()
  mockBackendFetch.mockReset()
  mockBackendFetch.mockResolvedValue({ accepted: 1, ignored: 0 })
  jest.spyOn(console, "warn").mockImplementation(() => undefined)
  process.env.TRANSLATION_REPORT_SECRET = REPORT_SECRET
  delete process.env.TRANSLATION_REPORT_CLIENT_IP_HEADER
  POST = require("@/app/api/translations/missing/route").POST
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("POST /api/translations/missing", () => {
  it("accepts a valid same-origin batch and forwards it with the server-only secret", async () => {
    const response = await POST(request({ reports: [report] }))
    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ accepted: 1 })
    expect(mockBackendFetch).toHaveBeenCalledWith(
      "/internal/ui-translations/missing-keys",
      expect.objectContaining({
        method: "POST",
        headers: { authorization: `Bearer ${REPORT_SECRET}` },
        body: { reports: [report] },
      })
    )
  })

  it("TC-3: deduplicates repeated reports", async () => {
    await POST(request({ reports: [report, report] }))
    const second = await POST(request({ reports: [report] }))
    expect(await second.json()).toEqual({ accepted: 0 })
    expect(mockBackendFetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["a forged origin", request({ reports: [report] }, { origin: "https://evil.example" }), 403],
    ["a cross-site fetch", request({ reports: [report] }, { "sec-fetch-site": "cross-site" }), 403],
    ["a non-JSON content type", request({ reports: [report] }, { "content-type": "text/plain" }), 415],
    ["an unsupported locale", request({ reports: [{ ...report, locale: "xx" }] }), 400],
    ["an excess batch", request({ reports: Array.from({ length: 51 }, (_, i) => ({ ...report, key: `K.k${i}` })) }), 400],
    ["interpolation values", request({ reports: [{ ...report, values: { name: "Jane" } }] }), 400],
    ["malformed JSON", request("{"), 400],
  ])("TC-4: rejects %s before forwarding", async (_name, built, status) => {
    const response = await POST(built)
    expect(response.status).toBe(status)
    expect(mockBackendFetch).not.toHaveBeenCalled()
  })

  it("TC-4: stops reading an oversized chunked body", async () => {
    const response = await POST(streamingRequest(64 * 1024))
    expect(response.status).toBe(413)
    expect(mockBackendFetch).not.toHaveBeenCalled()
  })

  it("TC-4: enforces the process-wide rate limit", async () => {
    const statuses: number[] = []
    for (let i = 0; i < 301; i++) {
      statuses.push((await POST(request({ reports: [{ ...report, key: `Rate.k${i}` }] }))).status)
    }
    expect(statuses.filter((status) => status === 202)).toHaveLength(300)
    expect(statuses[300]).toBe(429)
  })

  it("TC-4: enforces a per-client limit only through a configured trusted header", async () => {
    process.env.TRANSLATION_REPORT_CLIENT_IP_HEADER = "x-real-ip"
    const statuses: number[] = []
    for (let i = 0; i < 31; i++) {
      statuses.push(
        (await POST(request({ reports: [{ ...report, key: `Client.k${i}` }] }, { "x-real-ip": "203.0.113.9" }))).status
      )
    }
    expect(statuses[29]).toBe(202)
    expect(statuses[30]).toBe(429)
    const other = await POST(request({ reports: [report] }, { "x-real-ip": "203.0.113.10" }))
    expect(other.status).toBe(202)
  })

  it("TC-5: a backend outage still returns 202 and logs without recursion", async () => {
    mockBackendFetch.mockRejectedValue(Object.assign(new Error("down"), { status: 503 }))
    const response = await POST(request({ reports: [report] }))
    expect(response.status).toBe(202)
    expect(console.warn).toHaveBeenCalledWith("[ui-translations] missing-key forwarding failed", { status: 503 })
    expect(mockBackendFetch).toHaveBeenCalledTimes(1)
  })

  it("TC-6: sanitizes sensitive paths before logging and forwarding", async () => {
    await POST(
      request({
        reports: [{ ...report, page_path: "/dk/account/orders/details/order_01HXYZABCDEF?token=secret#x" }],
      })
    )
    const forwarded = mockBackendFetch.mock.calls[0][1].body.reports[0]
    expect(forwarded.page_path).toBe("/dk/account/orders/details/[id]")
    expect(JSON.stringify(jest.mocked(console.warn).mock.calls)).not.toContain("secret")
    expect(JSON.stringify(jest.mocked(console.warn).mock.calls)).not.toContain("order_01HXYZABCDEF")
  })
})
