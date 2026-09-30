import { setRequestLocale } from "next-intl/server"

import { getRuntimeMessages } from "@/lib/data/ui-translations"
import { getLocaleForCountry } from "@/lib/i18n/country-language-map"
import HtmlLangSync from "@/modules/common/components/html-lang-sync"
import TranslationProvider from "@/modules/common/components/translation-provider"

export default async function CountryLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const locale = getLocaleForCountry(countryCode)

  // Defensive: the value actually used to load messages is the
  // `X-NEXT-INTL-LOCALE` header set by middleware.ts (see src/i18n/request.ts
  // for why) — this call is kept in case some request path reaches this
  // layout without going through the middleware.
  setRequestLocale(locale)

  // Same React-memoized loader as src/i18n/request.ts, so this adds no second backend request.
  const runtime = await getRuntimeMessages(locale)

  return (
    <TranslationProvider
      locale={locale}
      messages={runtime.messages}
      available={runtime.availability === "available"}
    >
      <HtmlLangSync />
      {children}
    </TranslationProvider>
  )
}
