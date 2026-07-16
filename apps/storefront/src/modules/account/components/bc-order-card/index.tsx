import CalendarIcon from "@/modules/common/icons/calendar"
import DocumentIcon from "@/modules/common/icons/document"
import type { BCOrder } from "@/types/bc-order"
import { Container } from "@medusajs/ui"

type BcOrderCardProps = {
  order: BCOrder
}

const BcOrderCard = ({ order }: BcOrderCardProps) => {
  const orderDate = new Date(order.orderDate)

  const formattedAmount = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: order.currencyCode,
  }).format(order.totalAmountIncludingTax)

  return (
    <Container className="bg-white flex small:flex-row flex-col p-4 rounded-md small:justify-between small:items-center gap-y-2 items-start">
      <div className="flex gap-x-4 items-center pl-3">
        <div className="flex pr-2 text-small-regular items-center">
          <CalendarIcon className="inline-block mr-1" />
          <span data-testid="bc-order-date">
            {orderDate.toLocaleDateString("en-GB", {
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
      </div>
    </Container>
  )
}

export default BcOrderCard
