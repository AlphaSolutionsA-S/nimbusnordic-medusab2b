import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@medusajs/ui"
import { getTranslations } from "next-intl/server"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
}

const OrderDetails = async ({ order }: OrderDetailsProps) => {
  const t = await getTranslations("Order.orderDetails")
  const createdAt = new Date(order.created_at)

  return (
    <>
      <Heading level="h3" className="mb-2">
        {t("heading")}
      </Heading>

      <div className="text-sm text-ui-fg-subtle overflow-auto">
        <div className="flex justify-between">
          <Text>{t("orderNumberLabel")}</Text>
          <Text>#{order.display_id}</Text>
        </div>

        <div className="flex justify-between mb-2">
          <Text>{t("orderDateLabel")}</Text>
          <Text>
            {" "}
            {createdAt.getDate()}-{createdAt.getMonth()}-
            {createdAt.getFullYear()}
          </Text>
        </div>

        <Text>
          {t.rich("confirmationSentMessage", {
            email: () => (
              <span className="font-semibold">{order.email}</span>
            ),
          })}
        </Text>
      </div>
    </>
  )
}

export default OrderDetails
