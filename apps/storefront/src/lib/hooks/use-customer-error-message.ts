import { useTranslations } from "next-intl"

import {
  getCustomerErrorKey,
  logCustomerError,
} from "@/lib/util/customer-error"

// Converts any caught error into a translated, customer-safe message and logs
// the raw message for diagnostics. Use in event handlers / catch callbacks.
export function useCustomerErrorMessage(): (
  error: unknown,
  context: string
) => string {
  const t = useTranslations("Common.errors")

  return (error, context) => {
    logCustomerError(context, error)
    return t(getCustomerErrorKey(error))
  }
}
