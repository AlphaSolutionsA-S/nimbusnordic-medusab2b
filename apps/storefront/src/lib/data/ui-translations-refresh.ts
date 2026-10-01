"use server"

import "server-only"

import { revalidateTag } from "next/cache"

import { translationCacheTag } from "@/lib/data/ui-translations"
import { getLocaleForCountry } from "@/lib/i18n/country-language-map"

// Anyone can call a server action, so each locale is invalidated at most once per window per
// process. That bounds the extra backend reads to one per locale per window.
const REFRESH_WINDOW_MS = 10_000
const lastRefresh = new Map<string, number>()

/**
 * Called by the language switcher before it navigates, so the page in the new language reads
 * the newest texts from the backend instead of a copy that is up to 300 s old.
 */
export async function refreshUiTranslationsForCountry(countryCode: string): Promise<void> {
  // Unknown input maps to a supported locale, so only the 8 known cache tags can be touched.
  const locale = getLocaleForCountry(String(countryCode))
  const now = Date.now()
  if (now - (lastRefresh.get(locale) ?? 0) < REFRESH_WINDOW_MS) {
    return
  }
  lastRefresh.set(locale, now)
  revalidateTag(translationCacheTag(locale))
}
