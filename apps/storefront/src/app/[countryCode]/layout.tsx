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

  // Defensive: the value actually used to load messages is the
  // `X-NEXT-INTL-LOCALE` header set by middleware.ts (see src/i18n/request.ts
  // for why) — this call is kept in case some request path reaches this
  // layout without going through the middleware.
  setRequestLocale(countryCode)

  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
