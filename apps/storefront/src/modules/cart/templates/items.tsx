import { getCartApprovalStatus } from "@/lib/util/get-cart-approval-status"
import { convertToLocale } from "@/lib/util/money"
import ItemFull from "@/modules/cart/components/item-full"
import { B2BCart } from "@/types/global"
import { StoreCartLineItem } from "@medusajs/types"
import { Container, Text } from "@medusajs/ui"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

type ItemsTemplateProps = {
  cart: B2BCart
  showBorders?: boolean
  showTotal?: boolean
}

const ItemsTemplate = ({
  cart,
  showBorders = true,
  showTotal = true,
}: ItemsTemplateProps) => {
  const t = useTranslations("Cart.items")
  const items = cart?.items
  const totalQuantity = useMemo(
    () => cart?.items?.reduce((acc, item) => acc + item.quantity, 0),
    [cart?.items]
  )

  const { isPendingAdminApproval, isPendingSalesManagerApproval } =
    getCartApprovalStatus(cart)

  const isPendingApproval =
    isPendingAdminApproval || isPendingSalesManagerApproval

  return (
    <div className="w-full flex flex-col gap-y-2">
      <div className="flex flex-col gap-y-2 w-full">
        {items &&
          items.map((item: StoreCartLineItem) => {
            return (
              <ItemFull
                disabled={isPendingApproval}
                currencyCode={cart?.currency_code}
                showBorders={showBorders}
                key={item.id}
                item={
                  item as StoreCartLineItem & {
                    metadata?: { note?: string }
                  }
                }
              />
            )
          })}
      </div>
      {showTotal && (
        <Container>
          <div className="flex items-start justify-between h-full self-stretch">
            <Text>{t("totalItemsLabel", { count: totalQuantity ?? 0 })}</Text>
            <Text>
              {convertToLocale({
                amount: cart?.item_total,
                currency_code: cart?.currency_code,
              })}
            </Text>
          </div>
        </Container>
      )}
    </div>
  )
}

export default ItemsTemplate
