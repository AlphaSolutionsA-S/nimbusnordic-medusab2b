import {
  markFirstSeen,
  MAX_REPORT_BATCH,
  reportDedupKey,
  sanitizeTranslationPagePath,
} from "@/lib/i18n/missing-key-validation"
import type { MissingReport } from "@/types/ui-translations"

// Browser-side missing-text telemetry. Enqueueing never touches the network or React state, so it
// is safe to call while rendering; batches go to the same-origin storefront route only.
export const MISSING_FLUSH_DELAY_MS = 2000
const ENDPOINT = "/api/translations/missing"

const queue: MissingReport[] = []
const seen = new Map<string, number>()
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false

function schedule(): void {
  if (!listening) {
    listening = true
    window.addEventListener("pagehide", () => void flushMissingTranslations())
  }
  if (!timer) {
    timer = setTimeout(() => void flushMissingTranslations(), MISSING_FLUSH_DELAY_MS)
  }
}

export function enqueueMissingTranslation(report: MissingReport): void {
  if (typeof window === "undefined") {
    return
  }
  if (!markFirstSeen(seen, reportDedupKey(report), Date.now())) {
    return
  }
  if (queue.length >= MAX_REPORT_BATCH) {
    return
  }
  queue.push({ ...report, page_path: sanitizeTranslationPagePath(report.page_path) })
  schedule()
}

/** Best effort: one attempt per batch, no retries, failures swallowed at this telemetry boundary. */
export async function flushMissingTranslations(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (!queue.length) {
    return
  }
  const reports = queue.splice(0, MAX_REPORT_BATCH)
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reports }),
      credentials: "same-origin",
      keepalive: true,
    })
  } catch {
    // Reporting must never break the page or report about itself.
  }
}
