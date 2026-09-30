import "server-only"

import { cache } from "react"
import { unstable_cache } from "next/cache"

import { sdk } from "@/lib/config"
import type {
  MessageDocument,
  RuntimeMessages,
  TranslationDocument,
} from "@/types/ui-translations"

// UI texts come only from the backend database (NIMBUS-175). There is deliberately no fallback to
// messages/*.json or to another language: on failure we serve the last good copy this process has
// seen, otherwise an empty document so next-intl renders raw keys.

export const TRANSLATION_REVALIDATE_SECONDS = 300
// A hung backend must fail fast so the last-good copy (or raw keys) is served instead.
const READ_TIMEOUT_MS = 3000
// After this long without being refreshed, a snapshot or refresh watermark no longer blocks a
// lower version, so a restored or reseeded database with lower versions is picked up.
const VERSION_GUARD_TTL_MS = 2 * TRANSLATION_REVALIDATE_SECONDS * 1000
const SNAPSHOT_MAX_LOCALES = 64
const SNAPSHOT_MAX_BYTES = 32 * 1024 * 1024
const MAX_DEPTH = 12
const INACTIVE_CODE = "translation_inactive"

export function translationCacheTag(locale: string): string {
  return `ui-translations:${locale}`
}

type CachedRead =
  | { state: "active"; translation: TranslationDocument }
  | { state: "inactive"; locale: string }

interface Snapshot {
  version: number
  messages: MessageDocument
  bytes: number
  at: number
}

interface Watermark {
  version: number
  is_active: boolean
  at: number
}

// Process-local state. It does not survive restarts or deployments and is not shared between
// workers; the Next data cache and the timed refresh are what converge other processes.
const snapshots = new Map<string, Snapshot>()
const watermarks = new Map<string, Watermark>()
const generations = new Map<string, number>()
let snapshotBytes = 0

function blocksLowerVersion(entry: { at: number } | undefined): boolean {
  return entry !== undefined && Date.now() - entry.at < VERSION_GUARD_TTL_MS
}

function canonicalLocale(locale: string): string {
  try {
    const [canonical] = Intl.getCanonicalLocales(locale)
    return canonical ?? locale
  } catch {
    return locale
  }
}

function isMessageDocument(value: unknown, depth = 1): value is MessageDocument {
  if (typeof value !== "object" || value === null || Array.isArray(value) || depth > MAX_DEPTH) {
    return false
  }
  return Object.keys(value).every((key) => {
    const child = (value as Record<string, unknown>)[key]
    return typeof child === "string" || isMessageDocument(child, depth + 1)
  })
}

function isActiveDocument(value: unknown, locale: string): value is TranslationDocument {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const candidate = value as Partial<TranslationDocument>
  return (
    candidate.locale === locale &&
    candidate.is_active === true &&
    typeof candidate.version === "number" &&
    Number.isInteger(candidate.version) &&
    candidate.version > 0 &&
    isMessageDocument(candidate.messages)
  )
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status
    return typeof status === "number" ? status : undefined
  }
  return undefined
}

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

async function readRuntimeDocument(locale: string): Promise<CachedRead> {
  try {
    const { translation } = await sdk.client.fetch<{ translation: unknown }>(
      `/store/ui-translations/${encodeURIComponent(locale)}`,
      { method: "GET", cache: "no-store", signal: AbortSignal.timeout(READ_TIMEOUT_MS) }
    )
    if (!isActiveDocument(translation, locale)) {
      throw new Error("invalid_translation_response")
    }
    return { state: "active", translation }
  } catch (error) {
    // The SDK keeps only status and message, so the backend puts the stable code in message.
    if (errorStatus(error) === 404 && errorMessage(error) === INACTIVE_CODE) {
      return { state: "inactive", locale }
    }
    // Everything else must throw: a failure may never become a successful cache entry.
    throw error
  }
}

function cachedRead(locale: string): Promise<CachedRead> {
  return unstable_cache(readRuntimeDocument, ["ui-translations", locale], {
    revalidate: TRANSLATION_REVALIDATE_SECONDS,
    tags: [translationCacheTag(locale)],
  })(locale)
}

function dropSnapshot(locale: string): void {
  const existing = snapshots.get(locale)
  if (existing) {
    snapshotBytes -= existing.bytes
    snapshots.delete(locale)
  }
}

function storeSnapshot(locale: string, translation: TranslationDocument): void {
  const existing = snapshots.get(locale)
  if (existing && existing.version > translation.version && blocksLowerVersion(existing)) {
    return
  }
  const bytes = Buffer.byteLength(JSON.stringify(translation.messages))
  if (bytes > SNAPSHOT_MAX_BYTES) {
    return
  }
  dropSnapshot(locale)
  while (
    snapshots.size >= SNAPSHOT_MAX_LOCALES ||
    (snapshots.size > 0 && snapshotBytes + bytes > SNAPSHOT_MAX_BYTES)
  ) {
    const oldest = snapshots.keys().next().value
    if (oldest === undefined) {
      break
    }
    dropSnapshot(oldest)
  }
  snapshots.set(locale, {
    version: translation.version,
    messages: translation.messages,
    bytes,
    at: Date.now(),
  })
  snapshotBytes += bytes
}

function signalledInactive(locale: string, version: number): boolean {
  const mark = watermarks.get(locale)
  return Boolean(mark && !mark.is_active && mark.version >= version && blocksLowerVersion(mark))
}

function unavailable(locale: string, availability: "unavailable" | "inactive"): RuntimeMessages {
  return { locale, messages: {}, availability, version: null }
}

function logLoadFailure(locale: string, error: unknown): void {
  // Structured and secret-free: no URLs, headers or response bodies.
  console.warn("[ui-translations] load failed", {
    locale,
    status: errorStatus(error) ?? null,
    reason: errorStatus(error) ? errorMessage(error) : "network_or_invalid_response",
  })
}

/** Per-request memoized so request config, layout, metadata and 404 pages share one read. */
export const getRuntimeMessages = cache(async (requested: string): Promise<RuntimeMessages> => {
  const locale = canonicalLocale(requested)
  const generation = generations.get(locale) ?? 0
  let read: CachedRead
  try {
    read = await cachedRead(locale)
  } catch (error) {
    logLoadFailure(locale, error)
    const snapshot = snapshots.get(locale)
    if (snapshot && !signalledInactive(locale, snapshot.version)) {
      return { locale, messages: snapshot.messages, availability: "available", version: snapshot.version }
    }
    return unavailable(locale, "unavailable")
  }

  if (read.state === "inactive") {
    // A confirmed deactivation discards the last-good copy: the language is intentionally off.
    if ((generations.get(locale) ?? 0) === generation) {
      dropSnapshot(locale)
    }
    return unavailable(locale, "inactive")
  }

  const { translation } = read
  if (signalledInactive(locale, translation.version)) {
    return unavailable(locale, "inactive")
  }
  const snapshot = snapshots.get(locale)
  if (snapshot && snapshot.version > translation.version && blocksLowerVersion(snapshot)) {
    // An older cached or in-flight result never replaces a newer copy this process already has.
    return { locale, messages: snapshot.messages, availability: "available", version: snapshot.version }
  }
  if ((generations.get(locale) ?? 0) === generation) {
    storeSnapshot(locale, translation)
  }
  return {
    locale,
    messages: translation.messages,
    availability: "available",
    version: translation.version,
  }
})

/**
 * Records a refresh signal from the backend. Returns false for an outdated (or duplicate) callback,
 * which must then not invalidate anything. A confirmed deactivation clears the last-good copy.
 */
export function recordTranslationRefresh(input: {
  locale: string
  version: number
  is_active: boolean
}): boolean {
  const locale = canonicalLocale(input.locale)
  const current = watermarks.get(locale)
  if (current && current.version >= input.version && blocksLowerVersion(current)) {
    return false
  }
  watermarks.set(locale, { version: input.version, is_active: input.is_active, at: Date.now() })
  generations.set(locale, (generations.get(locale) ?? 0) + 1)
  if (!input.is_active) {
    dropSnapshot(locale)
  }
  return true
}
