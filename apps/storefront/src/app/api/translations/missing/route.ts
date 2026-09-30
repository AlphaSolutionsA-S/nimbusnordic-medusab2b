import { NextRequest, NextResponse } from "next/server"

import { acceptMissingReports, forwardMissingTranslations } from "@/lib/i18n/missing-key-server"
import { MAX_REPORT_BODY_BYTES, missingReportBatchSchema } from "@/lib/i18n/missing-key-validation"
import { readBoundedBody } from "@/lib/util/read-bounded-body"

export const runtime = "nodejs"

const WINDOW_MS = 60 * 1000
const CLIENT_LIMIT = 30
const GLOBAL_LIMIT = 300
const MAX_TRACKED_CLIENTS = 1000

// Process-local limits. They supplement, and do not replace, the backend's database caps.
const globalWindow = { start: 0, count: 0 }
const clientWindows = new Map<string, { start: number; count: number }>()

function withinGlobalLimit(now: number): boolean {
  if (now - globalWindow.start >= WINDOW_MS) {
    globalWindow.start = now
    globalWindow.count = 0
  }
  globalWindow.count += 1
  return globalWindow.count <= GLOBAL_LIMIT
}

/**
 * Per-client limiting only when the deployment names a header its proxy sets and overwrites
 * (TRANSLATION_REPORT_CLIENT_IP_HEADER). Arbitrary forwarded headers are never trusted.
 */
function withinClientLimit(request: NextRequest, now: number): boolean {
  const headerName = process.env.TRANSLATION_REPORT_CLIENT_IP_HEADER
  const clientId = headerName ? request.headers.get(headerName)?.split(",")[0]?.trim() : undefined
  if (!clientId) {
    return true
  }
  let window = clientWindows.get(clientId)
  if (!window || now - window.start >= WINDOW_MS) {
    if (!window && clientWindows.size >= MAX_TRACKED_CLIENTS) {
      for (const [id, entry] of clientWindows) {
        if (now - entry.start >= WINDOW_MS) {
          clientWindows.delete(id)
        }
      }
      if (clientWindows.size >= MAX_TRACKED_CLIENTS) {
        const oldest = clientWindows.keys().next().value
        if (oldest !== undefined) {
          clientWindows.delete(oldest)
        }
      }
    }
    window = { start: now, count: 0 }
    clientWindows.set(clientId, window)
  }
  window.count += 1
  return window.count <= CLIENT_LIMIT
}

function reply(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

/** Public, same-origin browser ingestion of missing-text reports. Bounded at every step. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Defense in depth only; these headers are not authentication.
  const origin = request.headers.get("origin")
  const fetchSite = request.headers.get("sec-fetch-site")
  if ((origin && origin !== request.nextUrl.origin) || (fetchSite && fetchSite !== "same-origin")) {
    return reply(403, { message: "Forbidden" })
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return reply(415, { message: "Unsupported media type" })
  }
  const now = Date.now()
  if (!withinGlobalLimit(now) || !withinClientLimit(request, now)) {
    return reply(429, { message: "Too many requests" })
  }
  try {
    const raw = await readBoundedBody(request, MAX_REPORT_BODY_BYTES)
    if (raw === null) {
      return reply(413, { message: "Payload too large" })
    }
    const parsed = missingReportBatchSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return reply(400, { message: "Invalid reports" })
    }
    const accepted = acceptMissingReports(parsed.data.reports)
    await forwardMissingTranslations(accepted)
    return reply(202, { accepted: accepted.length })
  } catch {
    // Telemetry boundary: malformed JSON or any other failure is dropped with a generic response.
    return reply(400, { message: "Invalid reports" })
  }
}
