import { getFormattingLocale } from "@/lib/i18n/formatting-locale"
import CalendarIcon from "@/modules/common/icons/calendar"
import DocumentIcon from "@/modules/common/icons/document"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import type { BCReturnListItem } from "@/types/bc-order"
import { Container } from "@medusajs/ui"
import { getLocale, getTranslations } from "next-intl/server"

type BcReturnCardProps = {
  item: BCReturnListItem
}

const STATE_BADGE_CLASSES = {
  open: "bg-neutral-100 text-neutral-700",
  processed: "bg-green-100 text-green-800",
} as const

const formatBCDate = (value: string, locale: string) => {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString(getFormattingLocale(locale), {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      })
}

const BcReturnCard = async ({ item }: BcReturnCardProps) => {
  const t = await getTranslations("Account.bcReturnCard")
  const tState = await getTranslations("Account.bcReturnState")
  const locale = await getLocale()
  // The state badge already says "Open"; the raw BC status is only added when it says more.
  const showBCStatus =
    item.state === "open" && item.status !== "" && item.status !== "Open"
  const standaloneReceipt =
    item.source === "posted_receipt" ? item.receipts[0] : undefined
  const groupedReceipts = item.source === "return_order" ? item.receipts : []

  return (
    <Container className="bg-white flex flex-col p-4 rounded-md gap-y-3">
      <div className="flex small:flex-row flex-col small:justify-between small:items-center gap-y-2 items-start">
        <div className="flex gap-x-4 items-center pl-3">
          <div className="flex pr-2 text-small-regular items-center">
            <CalendarIcon className="inline-block mr-1" />
            <span data-testid="bc-return-date">
              {formatBCDate(item.documentDate, locale)}
            </span>
          </div>

          <div className="flex items-center text-small-regular">
            <DocumentIcon className="inline-block mr-1" />
            <span data-testid="bc-return-number">#{item.number}</span>
          </div>
        </div>

        <div className="flex gap-x-4 small:divide-x divide-gray-200 small:justify-normal justify-between w-full small:w-auto">
          <div className="flex items-center gap-x-2 text-small-regular text-ui-fg-base">
            <span
              className={`px-2 text-xs font-medium rounded-full ${STATE_BADGE_CLASSES[item.state]}`}
              data-testid="bc-return-state"
            >
              {tState(item.state)}
            </span>
            {showBCStatus && (
              <span
                className="px-2 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full"
                data-testid="bc-return-status"
              >
                {item.status}
              </span>
            )}
          </div>

          <div className="flex items-center pl-4">
            <span
              className="text-small-regular text-ui-fg-base"
              data-testid="bc-return-item-count"
            >
              {t("itemCountLabel", { count: item.itemCount })}
            </span>
          </div>

          <LocalizedClientLink
            href={`/account/returns/${encodeURIComponent(item.number)}`}
            className="flex items-center pl-4 text-small-regular text-ui-fg-base underline"
            data-testid="bc-return-details-link"
          >
            {t("detailsLabel")}
          </LocalizedClientLink>
        </div>
      </div>

      {standaloneReceipt?.externalDocumentNumber ? (
        <p className="pl-3 text-small-regular text-ui-fg-subtle">
          {t("externalRefLabel")}{" "}
          <span data-testid="bc-return-external-ref">
            {standaloneReceipt.externalDocumentNumber}
          </span>
        </p>
      ) : null}

      {groupedReceipts.length > 0 && (
        <ul
          className="pl-3 flex flex-col gap-y-1 text-small-regular text-ui-fg-subtle"
          data-testid="bc-return-receipts"
        >
          {groupedReceipts.map((receipt) => (
            <li key={receipt.number} data-testid="bc-return-receipt">
              <span data-testid="bc-return-receipt-number">
                {t("receiptLabel")} #{receipt.number}
              </span>
              <span>
                {" · "}
                {t("receivedLabel")}{" "}
                <span data-testid="bc-return-receipt-date">
                  {formatBCDate(receipt.receivedDate, locale)}
                </span>
              </span>
              {receipt.externalDocumentNumber ? (
                <span>
                  {" · "}
                  {t("externalRefLabel")}{" "}
                  <span data-testid="bc-return-receipt-external-ref">
                    {receipt.externalDocumentNumber}
                  </span>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Container>
  )
}

export default BcReturnCard
