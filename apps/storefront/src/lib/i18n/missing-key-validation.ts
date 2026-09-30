import { z } from "zod"

import { SUPPORTED_LOCALES } from "@/lib/i18n/country-language-map"
import type { MissingReport } from "@/types/ui-translations"

// Browser/server-neutral bounds for missing-text reports (NIMBUS-175 CONTRACTS.md).
export const MAX_REPORT_BATCH = 50
export const MAX_REPORT_BODY_BYTES = 32 * 1024
export const MAX_REPORT_PATH_LENGTH = 512
export const MAX_KEY_LENGTH = 512
export const REPORT_DEDUP_MS = 5 * 60 * 1000
export const REPORT_DEDUP_MAX = 1000

const MAX_KEY_DEPTH = 12
const MAX_SEGMENT_LENGTH = 128
const SEGMENT_PATTERN = /^[A-Za-z0-9_$-]+$/
const RESERVED_SEGMENTS = new Set(["__proto__", "prototype", "constructor", "__locale_unavailable__"])

export function isValidMessageKey(key: string): boolean {
  if (!key || key.length > MAX_KEY_LENGTH) {
    return false
  }
  const segments = key.split(".")
  return (
    segments.length <= MAX_KEY_DEPTH &&
    segments.every(
      (segment) =>
        segment.length <= MAX_SEGMENT_LENGTH &&
        SEGMENT_PATTERN.test(segment) &&
        !RESERVED_SEGMENTS.has(segment)
    )
  )
}

const localeSchema = z.enum(SUPPORTED_LOCALES)
const pagePathSchema = z.string().min(1).max(MAX_REPORT_PATH_LENGTH).startsWith("/")

export const missingReportSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("key"),
      locale: localeSchema,
      page_path: pagePathSchema,
      key: z.string().refine(isValidMessageKey, "Invalid message key"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("locale_unavailable"),
      locale: localeSchema,
      page_path: pagePathSchema,
    })
    .strict(),
])

export const missingReportBatchSchema = z
  .object({ reports: z.array(missingReportSchema).min(1).max(MAX_REPORT_BATCH) })
  .strict()

// Segments after these words are identifiers of a customer's own records.
const IDENTIFIER_PARENTS = new Set([
  "orders",
  "details",
  "quotes",
  "bcorders",
  "bcreturns",
  "confirmed",
  "returns",
  "approvals",
  "addresses",
  "companies",
  "employees",
])
const SAFE_SEGMENT = /^[A-Za-z0-9._~-]{1,64}$/
const UNKNOWN_PATH = "/unknown"

function maskSegment(segment: string, previous: string | undefined): string {
  if (!SAFE_SEGMENT.test(segment)) {
    return "[segment]"
  }
  if (previous && IDENTIFIER_PARENTS.has(previous) && /\d|_/.test(segment)) {
    return "[id]"
  }
  // Medusa-style IDs (order_01H…), UUIDs and other long values containing digits.
  if (/^[a-z]+_[0-9A-Za-z]{6,}$/.test(segment) || (/\d/.test(segment) && segment.length >= 8)) {
    return "[id]"
  }
  return segment
}

/**
 * Normalizes a page path to a bounded local route template: no query string or fragment, no
 * absolute URLs, and customer/order/quote identifiers replaced by placeholders.
 */
export function sanitizeTranslationPagePath(path: string): string {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    return UNKNOWN_PATH
  }
  const withoutQuery = path.split(/[?#]/)[0]
  const segments = withoutQuery.split("/").filter(Boolean).slice(0, MAX_KEY_DEPTH)
  const masked = segments.map((segment, index) => {
    let decoded: string
    try {
      decoded = decodeURIComponent(segment)
    } catch {
      return "[segment]"
    }
    if (index === 0) {
      return /^[a-z]{2}$/.test(decoded) ? decoded : maskSegment(decoded, undefined)
    }
    return maskSegment(decoded, segments[index - 1])
  })
  const result = `/${masked.join("/")}`
  return result.length > MAX_REPORT_PATH_LENGTH ? result.slice(0, MAX_REPORT_PATH_LENGTH) : result
}

export function reportDedupKey(report: MissingReport): string {
  return `${report.locale}\u0000${report.kind === "key" ? report.key : "\u0000locale"}`
}

/** Records a key in a bounded, expiring dedup map; returns false when it was seen recently. */
export function markFirstSeen(seen: Map<string, number>, key: string, now: number): boolean {
  const last = seen.get(key)
  if (last !== undefined && now - last < REPORT_DEDUP_MS) {
    return false
  }
  if (seen.size >= REPORT_DEDUP_MAX) {
    for (const [entry, at] of seen) {
      if (now - at >= REPORT_DEDUP_MS) {
        seen.delete(entry)
      }
    }
    while (seen.size >= REPORT_DEDUP_MAX) {
      const oldest = seen.keys().next().value
      if (oldest === undefined) {
        break
      }
      seen.delete(oldest)
    }
  }
  seen.delete(key)
  seen.set(key, now)
  return true
}
