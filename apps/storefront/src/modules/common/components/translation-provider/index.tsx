"use client"

import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"

import { makeTranslationErrorHandlers } from "@/lib/i18n/translation-errors"
import type { MessageDocument } from "@/types/ui-translations"

export interface TranslationProviderProps {
  locale: string
  messages: MessageDocument
  available: boolean
  children: ReactNode
}

// The error callbacks are functions, so they are created here on the client rather than passed
// from a Server Component.
export default function TranslationProvider({
  locale,
  messages,
  available,
  children,
}: TranslationProviderProps) {
  const handlers = makeTranslationErrorHandlers({
    available,
    onMissing: () => undefined,
    onFormattingError: () => undefined,
  })

  return (
    <NextIntlClientProvider locale={locale} messages={messages} {...handlers}>
      {children}
    </NextIntlClientProvider>
  )
}
