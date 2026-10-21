import { headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import { getCountryLanguageForCountry } from "@/lib/data/country-languages"
import { getRuntimeMessages } from "@/lib/data/ui-translations"
import { isCountryCode } from "@/lib/i18n/country-language-map"
import {
  reportMissingTranslation,
  reportTranslationFormattingError,
} from "@/lib/i18n/missing-key-server"
import { makeTranslationErrorHandlers } from "@/lib/i18n/translation-errors"

// Both set (and overwritten) by middleware.ts from the request URL; paths that bypass the
// middleware, such as the root 404, get the published default language and a neutral path.
// The pathname is sanitized before logging or forwarding.
const PATHNAME_HEADER = "x-storefront-pathname"
const COUNTRY_HEADER = "x-storefront-country"

async function requestContext(): Promise<{ pagePath: string; country: string | undefined }> {
  try {
    const requestHeaders = await headers()
    const country = requestHeaders.get(COUNTRY_HEADER)
    return {
      pagePath: requestHeaders.get(PATHNAME_HEADER) || "/unknown",
      country: isCountryCode(country) ? country : undefined,
    }
  } catch {
    return { pagePath: "/unknown", country: undefined }
  }
}

// The project routes by `/{countryCode}/...`, not next-intl's `[locale]` segment. The language is
// the backend's published verdict for the URL country (NIMBUS-176), from the same request-memoized
// snapshot the country layout gives the client provider. `requestLocale` (next-intl's locale header
// or `setRequestLocale`) is deliberately not read: it is never a source of the language.
export default getRequestConfig(async () => {
  const { pagePath, country } = await requestContext()
  const { locale } = await getCountryLanguageForCountry(country)

  // Messages come only from the backend database (NIMBUS-175): no messages/*.json and no other
  // language as a fallback. An unavailable locale renders raw keys.
  const runtime = await getRuntimeMessages(locale)
  const available = runtime.availability === "available"

  if (!available) {
    // One typed event for the whole locale instead of one report per missing key.
    reportMissingTranslation({ kind: "locale_unavailable", locale, page_path: pagePath })
  }

  return {
    locale,
    messages: runtime.messages,
    ...makeTranslationErrorHandlers({
      available,
      onMissing: (key) =>
        reportMissingTranslation({ kind: "key", locale, key, page_path: pagePath }),
      onFormattingError: reportTranslationFormattingError,
    }),
  }
})
