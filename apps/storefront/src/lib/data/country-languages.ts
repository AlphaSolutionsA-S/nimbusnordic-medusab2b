import "server-only"

import { unstable_rethrow } from "next/navigation"
import { cache } from "react"

import { sdk } from "@/lib/config"
import {
  type CountryLanguageAvailability,
  type CountryLanguagePublication,
  type CountryLanguageSnapshot,
  legacyCountryLanguageSnapshot,
  localeForCountry,
  parseCountryLanguagePublication,
} from "@/lib/i18n/country-language-map"
import { errorStatus } from "@/lib/util/error-status"

// Freshness and outage bounds (NIMBUS-176): a healthy change reaches every worker within five
// minutes. A success is reused for at most 240 s; then the next request waits for one bounded read.
const COUNTRY_LANGUAGES_MAX_AGE_MS = 240_000
const COUNTRY_LANGUAGES_READ_TIMEOUT_MS = 3_000
const COUNTRY_LANGUAGES_RETRY_MS = 10_000

// Process-local on purpose, without the Next data cache: a restarted worker always reads the
// backend again, and a failure is never stored as a result. Not shared between workers.
let lastGood: { publication: CountryLanguagePublication; at: number } | null = null
let retryAt = 0
let inFlight: Promise<CountryLanguagePublication> | null = null

async function readPublication(): Promise<CountryLanguagePublication> {
  const response = await sdk.client.fetch<unknown>("/store/country-languages", {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(COUNTRY_LANGUAGES_READ_TIMEOUT_MS),
  })
  const publication = parseCountryLanguagePublication(response)
  if (!publication) {
    throw new Error("invalid_country_language_response")
  }
  return publication
}

function sharedRead(): Promise<CountryLanguagePublication> {
  inFlight ??= readPublication().finally(() => {
    inFlight = null
  })
  return inFlight
}

function fallback(): CountryLanguageSnapshot {
  return lastGood ? { ...lastGood.publication, availability: "stale" } : legacyCountryLanguageSnapshot()
}

/** Per-request memoized, so request config, layouts, metadata and actions share one verdict. */
export const getCountryLanguageSnapshot = cache(async (): Promise<CountryLanguageSnapshot> => {
  const now = Date.now()
  if (lastGood && now - lastGood.at < COUNTRY_LANGUAGES_MAX_AGE_MS) {
    return { ...lastGood.publication, availability: "available" }
  }
  if (now < retryAt) {
    return fallback()
  }
  try {
    const publication = await sharedRead()
    lastGood = { publication, at: Date.now() }
    return { ...publication, availability: "available" }
  } catch (error) {
    // Next signals control flow by throwing (the no-store read during static generation throws
    // DynamicServerError); it must reach Next, not become a legacy fallback.
    unstable_rethrow(error)
    retryAt = Date.now() + COUNTRY_LANGUAGES_RETRY_MS
    // Structured and secret-free: no URL, headers or response body.
    console.warn("[country-languages] load failed", {
      status: errorStatus(error) ?? null,
      fallback: lastGood ? "stale" : "legacy",
    })
    return fallback()
  }
})

export interface CountryLanguageVerdict {
  locale: string
  availability: CountryLanguageAvailability
}

/** The request's language for a URL country; a missing or unpublished country gets the default. */
export const getCountryLanguageForCountry = cache(
  async (countryCode: string | null | undefined): Promise<CountryLanguageVerdict> => {
    const snapshot = await getCountryLanguageSnapshot()
    return { locale: localeForCountry(snapshot, countryCode), availability: snapshot.availability }
  }
)
