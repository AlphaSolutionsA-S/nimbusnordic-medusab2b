import { headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import { getRuntimeMessages } from "@/lib/data/ui-translations"
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/lib/i18n/country-language-map"
import {
  reportMissingTranslation,
  reportTranslationFormattingError,
} from "@/lib/i18n/missing-key-server"
import { makeTranslationErrorHandlers } from "@/lib/i18n/translation-errors"

// Set (and overwritten) by middleware.ts from the request URL; paths that bypass the middleware,
// such as the root 404, report a neutral placeholder. Sanitized before logging or forwarding.
const PATHNAME_HEADER = "x-storefront-pathname"

async function currentPagePath(): Promise<string> {
  try {
    return (await headers()).get(PATHNAME_HEADER) || "/unknown"
  } catch {
    return "/unknown"
  }
}

// This project doesn't use next-intl's own `[locale]` routing — the locale is
// derived from the existing `/{countryCode}/...` segment instead. Rather than
// `setRequestLocale` (see src/app/[countryCode]/layout.tsx, which still
// calls it defensively), the value actually used here comes from the
// `X-NEXT-INTL-LOCALE` request header that middleware.ts sets from the URL's
// country code (via getLocaleForCountry) on every request — the documented
// mechanism next-intl provides for apps that supply a custom-resolved locale
// instead of using its own middleware. `setRequestLocale` alone was found
// during NIMBUS-169 visual QA to not reliably propagate to `requestLocale`
// here in this Next.js/next-intl version combination: every non-English
// locale was silently rendering English messages (translations exist and
// are correct in `messages/*.json`, they just were never being loaded).
//
// `requestLocale` is therefore already a real locale (e.g. "de", "da"), not
// a country code — do not run it through `getLocaleForCountry` again (most
// locales coincide with their country code, but "da"/"dk" and "sv"/"se"
// don't, and would silently fall back to the default locale if re-mapped).
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale =
    requested && (SUPPORTED_LOCALES as readonly string[]).includes(requested)
      ? (requested as (typeof SUPPORTED_LOCALES)[number])
      : DEFAULT_LOCALE

  // Messages come only from the backend database (NIMBUS-175): no messages/*.json and no other
  // language as a fallback. An unavailable locale renders raw keys.
  const runtime = await getRuntimeMessages(locale)
  const pagePath = await currentPagePath()
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
