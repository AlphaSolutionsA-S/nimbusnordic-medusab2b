import CalendarIcon from "@/modules/common/icons/calendar"
import DocumentIcon from "@/modules/common/icons/document"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import type { BCReturnListItem } from "@/types/bc-order"
import { Container } from "@medusajs/ui"
import { getTranslations } from "next-intl/server"

type BcReturnCardProps = {
  item: BCReturnListItem
}

const BcReturnCard = async ({ item }: BcReturnCardProps) => {
  const t = await getTranslations("Account.bcReturnCard")
  const documentDate = new Date(item.documentDate)

  return (
    <Container className="bg-white flex small:flex-row flex-col p-4 rounded-md small:justify-between small:items-center gap-y-2 items-start">
      <div className="flex gap-x-4 items-center pl-3">
        <div className="flex pr-2 text-small-regular items-center">
          <CalendarIcon className="inline-block mr-1" />
          <span data-testid="bc-return-date">
            {documentDate.toLocaleDateString("en-GB", {
              year: "numeric",
              month: "numeric",
              day: "numeric",
            })}
          </span>
        </div>

        <div className="flex items-center text-small-regular">
          <DocumentIcon className="inline-block mr-1" />
          <span data-testid="bc-return-number">#{item.number}</span>
        </div>
      </div>

      <div className="flex gap-x-4 small:divide-x divide-gray-200 small:justify-normal justify-between w-full small:w-auto">
        <div className="flex items-center text-small-regular text-ui-fg-base">
          <span
            className="px-2 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full"
            data-testid="bc-return-status"
          >
            {item.status}
          </span>
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
    </Container>
  )
}

export default BcReturnCard
