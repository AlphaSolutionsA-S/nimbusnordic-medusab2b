"use client"

import { StatusBadge } from "@medusajs/ui"
import { useTranslations } from "next-intl"

const StatusTitleKeys: Record<string, string> = {
  accepted: "acceptedLabel",
  customer_rejected: "customerRejectedLabel",
  merchant_rejected: "merchantRejectedLabel",
  pending_merchant: "pendingMerchantLabel",
  pending_customer: "pendingCustomerLabel",
}

const StatusColors: Record<string, "green" | "orange" | "red" | "blue"> = {
  accepted: "green",
  customer_rejected: "red",
  merchant_rejected: "red",
  pending_merchant: "orange",
  pending_customer: "orange",
}

export default function QuoteStatusBadge({ status }: { status: string }) {
  const t = useTranslations("Account.quoteStatusBadge")

  return (
    <StatusBadge color={StatusColors[status]}>
      {t(StatusTitleKeys[status])}
    </StatusBadge>
  )
}
