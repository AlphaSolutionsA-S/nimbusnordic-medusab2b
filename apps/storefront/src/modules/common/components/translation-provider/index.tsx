"use client"

import { NextIntlClientProvider } from "next-intl"
import { usePathname } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { enqueueMissingTranslation } from "@/lib/i18n/missing-key-client"
import { makeTranslationErrorHandlers } from "@/lib/i18n/translation-errors"
import type { MessageDocument } from "@/types/ui-translations"

export interface TranslationProviderProps {
  locale: string
  messages: MessageDocument
  available: boolean
  children: ReactNode
}

// The error callbacks are functions, so they are created here on the client rather than passed
// from a Server Component. Enqueueing only records the miss; the network call happens later.
export default function TranslationProvider({
  locale,
  messages,
  available,
  children,
}: TranslationProviderProps) {
  const pathname = usePathname() ?? "/unknown"

  useEffect(() => {
    if (!available) {
      enqueueMissingTranslation({ kind: "locale_unavailable", locale, page_path: pathname })
    }
  }, [available, locale, pathname])

  const handlers = makeTranslationErrorHandlers({
    available,
    onMissing: (key) => enqueueMissingTranslation({ kind: "key", locale, key, page_path: pathname }),
    onFormattingError: () => undefined,
  })

  return (
    <NextIntlClientProvider locale={locale} messages={messages} {...handlers}>
      {children}
    </NextIntlClientProvider>
  )
}
