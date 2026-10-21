import { setRequestLocale } from "next-intl/server"

import { getCountryLanguageForCountry } from "@/lib/data/country-languages"
import { getRuntimeMessages } from "@/lib/data/ui-translations"
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
  // Same request-memoized snapshot as src/i18n/request.ts, so the server config and the client
  // provider always carry the same language for this country.
  const { locale } = await getCountryLanguageForCountry(countryCode)

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
