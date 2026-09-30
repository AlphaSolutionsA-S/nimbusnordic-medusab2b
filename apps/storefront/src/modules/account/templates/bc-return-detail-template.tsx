import { Container, Heading } from "@medusajs/ui"
import { useLocale, useTranslations } from "next-intl"
import BcReturnExpectedCredit from "@/modules/account/components/bc-return-expected-credit"
import BcReturnLines from "@/modules/account/components/bc-return-lines"
import BcReturnReceipts from "@/modules/account/components/bc-return-receipts"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { getFormattingLocale } from "@/lib/i18n/formatting-locale"
import type { BCReturnDetail } from "@/types/bc-order"

type BcReturnDetailTemplateProps = {
  bcReturn: BCReturnDetail
}

const STATE_BADGE_CLASSES = {
  open: "bg-neutral-100 text-neutral-700",
  processed: "bg-green-100 text-green-800",
} as const

const BcReturnDetailTemplate = ({ bcReturn }: BcReturnDetailTemplateProps) => {
  const t = useTranslations("Account.bcReturnDetailTemplate")
  const tState = useTranslations("Account.bcReturnState")
  const locale = useLocale()
  const documentDate = new Date(bcReturn.documentDate)
  const isOpen = bcReturn.state === "open"
  // Same rule as the list card: the state badge already says "Open".
  const showBCStatus = isOpen && bcReturn.status !== "" && bcReturn.status !== "Open"

  return (
    <div className="flex flex-col gap-y-4" data-testid="bc-return-detail">
      <LocalizedClientLink
        href="/account/returns"
        className="text-small-regular text-ui-fg-subtle hover:text-ui-fg-base"
        data-testid="bc-return-back-link"
      >
        {t("backToReturnsLabel")}
      </LocalizedClientLink>

      <Container className="flex flex-col gap-y-4">
        <Heading level="h1">
          {bcReturn.source === "posted_receipt"
            ? t("receiptNumberHeading", { number: bcReturn.number })
            : t("returnNumberHeading", { number: bcReturn.number })}
        </Heading>
        <dl className="grid grid-cols-1 small:grid-cols-2 gap-x-12 gap-y-3 text-small-regular">
          {isOpen && (
            <div>
              <dt className="text-ui-fg-subtle">{t("requestedDateLabel")}</dt>
              <dd className="text-ui-fg-base" data-testid="bc-return-document-date">
                {Number.isNaN(documentDate.getTime())
                  ? "-"
                  : documentDate.toLocaleDateString(getFormattingLocale(locale))}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-ui-fg-subtle">{t("statusLabel")}</dt>
            <dd className="flex gap-x-2">
              <span
                className={`px-2 text-xs font-medium rounded-full ${STATE_BADGE_CLASSES[bcReturn.state]}`}
                data-testid="bc-return-state"
              >
                {tState(bcReturn.state)}
              </span>
              {showBCStatus && (
                <span
                  className="px-2 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full"
                  data-testid="bc-return-status"
                >
                  {bcReturn.status}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </Container>

      {isOpen && (
        <Container>
          <BcReturnLines lines={bcReturn.lines} />
        </Container>
      )}

      {isOpen && bcReturn.expectedCredit && (
        <Container>
          <BcReturnExpectedCredit expectedCredit={bcReturn.expectedCredit} />
        </Container>
      )}

      {bcReturn.receipts.length > 0 && (
        <Container>
          <BcReturnReceipts receipts={bcReturn.receipts} />
        </Container>
      )}
    </div>
  )
}

export default BcReturnDetailTemplate
