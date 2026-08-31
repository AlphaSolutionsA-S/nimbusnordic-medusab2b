import { NextIntlClientProvider } from "next-intl"
import { getMessages, setRequestLocale } from "next-intl/server"

import { getLocaleForCountry } from "@/lib/i18n/country-language-map"

export default async function CountryLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const locale = getLocaleForCountry(countryCode)

  // Caches the country code for this request so `src/i18n/request.ts` (which
  // does the country -> locale lookup) resolves the same value below when
  // `getMessages()` reads the request config. Must run before any other
  // next-intl API is used in this request.
  setRequestLocale(countryCode)

  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
