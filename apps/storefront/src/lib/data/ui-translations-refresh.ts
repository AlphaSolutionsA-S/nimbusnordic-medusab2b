"use server"

import "server-only"

import { updateTag } from "next/cache"

import { getCountryLanguageSnapshot } from "@/lib/data/country-languages"
import { translationCacheTag } from "@/lib/data/ui-translations"
import { findPublishedCountry } from "@/lib/i18n/country-language-map"

// Anyone can call a server action, so each locale is invalidated at most once per window per
// process. That bounds the extra backend reads to one per locale per window.
const REFRESH_WINDOW_MS = 10_000
const lastRefresh = new Map<string, number>()

/**
 * Called by the language switcher before it navigates, so the page in the new language reads
 * the newest texts from the backend instead of a copy that is up to 300 s old.
 */
export async function refreshUiTranslationsForCountry(countryCode: string): Promise<void> {
  // Only a published country selects a tag, so input can name at most the published languages
  // and can never grow this map or the set of invalidated tags.
  const published = findPublishedCountry(await getCountryLanguageSnapshot(), countryCode)
  if (!published) {
    return
  }
  const { locale } = published
  const now = Date.now()
  if (now - (lastRefresh.get(locale) ?? 0) < REFRESH_WINDOW_MS) {
    return
  }
  lastRefresh.set(locale, now)
  updateTag(translationCacheTag(locale))
}
