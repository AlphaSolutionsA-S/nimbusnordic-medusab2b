import "server-only"

import Medusa from "@medusajs/js-sdk"
import { after } from "next/server"

import {
  markFirstSeen,
  MAX_REPORT_BATCH,
  missingReportSchema,
  reportDedupKey,
  sanitizeTranslationPagePath,
} from "@/lib/i18n/missing-key-validation"
import type { MissingReport } from "@/types/ui-translations"

const FORWARD_TIMEOUT_MS = 3000
const REPORT_ENDPOINT = "/internal/ui-translations/missing-keys"
const LOG_WINDOW_MS = 60 * 1000
const MAX_LOGS_PER_WINDOW = 60

const seen = new Map<string, number>()
const formattingSeen = new Map<string, number>()
let pending: MissingReport[] = []
let scheduled = false
let reportClient: Medusa | null = null
const logWindow = { start: 0, count: 0, suppressed: 0 }

// Separate from the public storefront SDK: debug is off so the report secret never appears in
// request diagnostics, and this module is server-only so the secret never reaches a browser bundle.
function client(): Medusa {
  reportClient ??= new Medusa({
    baseUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000",
    debug: false,
  })
  return reportClient
}

/** At most MAX_LOGS_PER_WINDOW lines per minute; the next window first logs how many were dropped. */
function logMissingMessage(report: MissingReport, now: number): void {
  if (now - logWindow.start >= LOG_WINDOW_MS) {
    if (logWindow.suppressed > 0) {
      console.warn("[ui-translations] missing message logs suppressed", {
        count: logWindow.suppressed,
      })
    }
    logWindow.start = now
    logWindow.count = 0
    logWindow.suppressed = 0
  }
  if (logWindow.count >= MAX_LOGS_PER_WINDOW) {
    logWindow.suppressed += 1
    return
  }
  logWindow.count += 1
  console.warn("[ui-translations] missing message", {
    locale: report.locale,
    kind: report.kind,
    key: report.kind === "key" ? report.key : null,
    page_path: report.page_path,
  })
}

/** Sanitizes, validates and deduplicates reports, logging each accepted one once (rate-limited). */
export function acceptMissingReports(reports: readonly MissingReport[]): MissingReport[] {
  const accepted: MissingReport[] = []
  const now = Date.now()
  for (const report of reports) {
    const parsed = missingReportSchema.safeParse({
      ...report,
      page_path: sanitizeTranslationPagePath(report.page_path),
    })
    if (!parsed.success || !markFirstSeen(seen, reportDedupKey(parsed.data), now)) {
      continue
    }
    logMissingMessage(parsed.data, now)
    accepted.push(parsed.data)
  }
  return accepted
}

export async function forwardMissingTranslations(reports: MissingReport[]): Promise<void> {
  if (!reports.length) {
    return
  }
  const secret = process.env.TRANSLATION_REPORT_SECRET
  if (!secret) {
    console.warn("[ui-translations] missing-key forwarding skipped", { reason: "not_configured" })
    return
  }
  for (let start = 0; start < reports.length; start += MAX_REPORT_BATCH) {
    try {
      await client().client.fetch(REPORT_ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${secret}` },
        body: { reports: reports.slice(start, start + MAX_REPORT_BATCH) },
        signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      })
    } catch (error) {
      // Logged without the payload; never re-reported through this system.
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? (error as { status: unknown }).status
          : null
      console.warn("[ui-translations] missing-key forwarding failed", { status })
    }
  }
}

/** Server-render hook: logs once and forwards after the response, within the request lifetime. */
export function reportMissingTranslation(report: MissingReport): void {
  // Capacity first: a report dropped here must not be marked as seen and suppressed for the window.
  if (pending.length >= MAX_REPORT_BATCH) {
    return
  }
  const accepted = acceptMissingReports([report])
  if (!accepted.length) {
    return
  }
  pending.push(...accepted)
  if (scheduled) {
    return
  }
  scheduled = true
  try {
    after(async () => {
      scheduled = false
      const batch = pending
      pending = []
      await forwardMissingTranslations(batch)
    })
  } catch {
    // Outside a request scope (for example during a build): the log line is the report.
    scheduled = false
    pending = []
  }
}

/** Formatting problems are logged by error code only, at most once per code per dedup window. */
export function reportTranslationFormattingError(code: string): void {
  if (markFirstSeen(formattingSeen, code, Date.now())) {
    console.warn("[ui-translations] message formatting failed", { code })
  }
}
