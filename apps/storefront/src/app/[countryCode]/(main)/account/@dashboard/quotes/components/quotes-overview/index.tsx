"use client"

import QuoteCard from "@/modules/account/components/quote-card"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { StoreQuoteResponse } from "@/types/quote"
import { Button } from "@medusajs/ui"
import { useTranslations } from "next-intl"

const QuotesOverview = ({
  quotes,
}: {
  quotes: StoreQuoteResponse["quote"][]
}) => {
  const t = useTranslations("Account.quotesOverview")
  // Reuses the identical "Nothing to see here" empty-state heading and
  // "Continue shopping" label already extracted for
  // `@/modules/account/components/pending-customer-approvals` and
  // `@/modules/account/components/order-overview` respectively.
  const tPendingApprovals = useTranslations("Account.pendingCustomerApprovals")
  const tOrderOverview = useTranslations("Account.orderOverview")

  if (quotes?.length) {
    return (
      <div className="flex flex-col gap-y-2 w-full">
        {quotes.map((quote) => (
          <div key={quote.id}>
            <QuoteCard quote={quote} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col items-center gap-y-4">
      <h2 className="text-large-semi">{tPendingApprovals("emptyHeading")}</h2>
      <p className="text-base-regular">{t("emptyMessage")}</p>

      <div className="mt-4">
        <LocalizedClientLink href="/" passHref>
          <Button data-testid="continue-shopping-button">
            {tOrderOverview("continueShoppingLabel")}
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default QuotesOverview
