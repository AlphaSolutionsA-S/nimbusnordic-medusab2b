import type { ComponentProps } from "react"
import type { NextIntlClientProvider } from "next-intl"

type ProviderProps = ComponentProps<typeof NextIntlClientProvider>

// IntlErrorCode.MISSING_MESSAGE; compared as a string so this module has no runtime next-intl import.
const MISSING_MESSAGE = "MISSING_MESSAGE"

/**
 * Browser-safe next-intl error handlers shared by the server request config and the client provider.
 * Every failure renders the full raw key (namespace.key) instead of throwing. Missing keys are
 * reported individually only while the locale's document is available; when the whole locale is
 * unavailable, the caller reports that once instead of one entry per key.
 */
export function makeTranslationErrorHandlers(input: {
  available: boolean
  onMissing: (key: string) => void
  onFormattingError: (code: string) => void
}): Required<Pick<ProviderProps, "onError" | "getMessageFallback">> {
  return {
    onError(error) {
      if (String(error.code) === MISSING_MESSAGE) {
        // Reported from getMessageFallback, which receives the exact namespace and key.
        return
      }
      // Only the error code: never the message text or interpolation values.
      input.onFormattingError(String(error.code))
    },
    getMessageFallback({ namespace, key, error }) {
      const fullKey = [namespace, key].filter(Boolean).join(".")
      if (String(error.code) === MISSING_MESSAGE && input.available) {
        input.onMissing(fullKey)
      }
      return fullKey
    },
  }
}
