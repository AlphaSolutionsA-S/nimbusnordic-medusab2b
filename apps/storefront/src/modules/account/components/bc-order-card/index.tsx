import { getFormattingLocale } from "@/lib/i18n/formatting-locale"
import { convertToLocale } from "@/lib/util/money"
import CalendarIcon from "@/modules/common/icons/calendar"
import DocumentIcon from "@/modules/common/icons/document"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import type { BCOrder } from "@/types/bc-order"
import { Container } from "@medusajs/ui"
import { getLocale, getTranslations } from "next-intl/server"

type BcOrderCardProps = {
  order: BCOrder
}

const BcOrderCard = async ({ order }: BcOrderCardProps) => {
  const t = await getTranslations("Account.bcOrderCard")
  const locale = await getLocale()
  const orderDate = new Date(order.orderDate)

  const formattedAmount = convertToLocale({
    amount: order.totalAmountIncludingTax,
    currency_code: order.currencyCode,
    locale,
  })

  return (
    <Container className="bg-white flex small:flex-row flex-col p-4 rounded-md small:justify-between small:items-center gap-y-2 items-start">
      <div className="flex gap-x-4 items-center pl-3">
        <div className="flex pr-2 text-small-regular items-center">
          <CalendarIcon className="inline-block mr-1" />
          <span data-testid="bc-order-date">
            {orderDate.toLocaleDateString(getFormattingLocale(locale), {
              year: "numeric",
              month: "numeric",
              day: "numeric",
            })}
          </span>
        </div>

        <div className="flex items-center text-small-regular">
          <DocumentIcon className="inline-block mr-1" />
          <span data-testid="bc-order-number">#{order.number}</span>
        </div>
      </div>

      <div className="flex gap-x-4 small:divide-x divide-gray-200 small:justify-normal justify-between w-full small:w-auto">
        <div className="flex items-center text-small-regular text-ui-fg-base">
          <span
            className="px-2 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full"
            data-testid="bc-order-status"
          >
            {order.status}
          </span>
        </div>

        <div className="flex items-center pl-4">
          <span
            className="text-small-regular text-ui-fg-base"
            data-testid="bc-order-amount"
          >
            {formattedAmount}
          </span>
        </div>

        <LocalizedClientLink
          href={`/account/bcorders/${encodeURIComponent(order.number)}`}
          className="flex items-center pl-4 text-small-regular text-ui-fg-base underline"
          data-testid="bc-order-details-link"
        >
          {t("detailsLabel")}
        </LocalizedClientLink>
      </div>
    </Container>
  )
}

export default BcOrderCard
