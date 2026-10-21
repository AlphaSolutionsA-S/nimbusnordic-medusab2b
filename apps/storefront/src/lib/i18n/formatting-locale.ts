import { MAX_LOCALE_LENGTH } from "./country-language-map"

// The tags the eight original languages were formatted with before languages became configurable
// (NIMBUS-176); kept so existing dates and numbers do not change. Intl formats Norwegian (Bokmål)
// under "nb", while the storefront's language for Norway is "no".
const LEGACY_FORMATTING_TAGS: ReadonlyMap<string, string> = new Map([
  ["da", "da-DK"],
  ["en", "en-GB"],
  ["sv", "sv-SE"],
  ["no", "nb-NO"],
  ["pl", "pl-PL"],
  ["it", "it-IT"],
  ["fr", "fr-FR"],
  ["de", "de-DE"],
])

const DEFAULT_FORMATTING_TAG = "en-GB"

function canonicalTag(locale: string): string | null {
  if (!locale || locale.length > MAX_LOCALE_LENGTH) {
    return null
  }
  try {
    const canonical = Intl.getCanonicalLocales(locale)
    return canonical.length === 1 ? canonical[0] : null
  } catch {
    return null
  }
}

/**
 * The BCP 47 tag used for number and date formatting of a storefront language. The original eight
 * keep their tags; any other valid tag is used as is (Intl falls back on hosts without its data),
 * and a malformed one gets en-GB. Currency is not part of it: it comes from the region.
 */
export function getFormattingLocale(locale: string): string {
  const canonical = canonicalTag(locale)
  if (!canonical) {
    return DEFAULT_FORMATTING_TAG
  }
  return LEGACY_FORMATTING_TAGS.get(canonical) ?? canonical
}
