"use client"

import { convertToLocale } from "@/lib/util/money"
import Divider from "@/modules/common/components/divider"
import { B2BCart, B2BOrder } from "@/types"
import { Text } from "@medusajs/ui"
import { useTranslations } from "next-intl"
import React from "react"

// Reuses the `Cart.cartTotals` translation keys — this component renders the
// identical subtotal/discount/shipping/taxes/total copy as
// `@/modules/cart/components/cart-totals`, just for a cart-or-order value.
const CheckoutTotals: React.FC<{
  cartOrOrder: B2BCart | B2BOrder
}> = ({ cartOrOrder }) => {
  const t = useTranslations("Cart.cartTotals")

  if (!cartOrOrder) return null

  const {
    currency_code,
    total,
    item_subtotal,
    tax_total,
    shipping_total,
    discount_total,
    gift_card_total,
  } = cartOrOrder

  return (
    <div>
      <div className="flex flex-col gap-y-2 txt-medium text-ui-fg-subtle ">
        <div className="flex items-center justify-between">
          <Text className="flex gap-x-1 items-center">
            {t("subtotalLabel")}
          </Text>
          <Text
            data-testid="cart-item-subtotal"
            data-value={item_subtotal || 0}
          >
            {convertToLocale({ amount: item_subtotal ?? 0, currency_code })}
          </Text>
        </div>
        {!!discount_total && (
          <div className="flex items-center justify-between">
            <Text>{t("discountLabel")}</Text>
            <Text
              className="text-ui-fg-interactive"
              data-testid="cart-discount"
              data-value={discount_total || 0}
            >
              -{" "}
              {convertToLocale({ amount: discount_total ?? 0, currency_code })}
            </Text>
          </div>
        )}
        <div className="flex items-center justify-between">
          <Text>{t("shippingLabel")}</Text>
          <Text data-testid="cart-shipping" data-value={shipping_total || 0}>
            {convertToLocale({ amount: shipping_total ?? 0, currency_code })}
          </Text>
        </div>
        <div className="flex justify-between">
          <Text className="flex gap-x-1 items-center ">{t("taxesLabel")}</Text>
          <Text data-testid="cart-taxes" data-value={tax_total || 0}>
            {convertToLocale({ amount: tax_total ?? 0, currency_code })}
          </Text>
        </div>
        {!!gift_card_total && (
          <div className="flex items-center justify-between">
            <Text>{t("giftCardLabel")}</Text>
            <Text
              className="text-ui-fg-interactive"
              data-testid="cart-gift-card-amount"
              data-value={gift_card_total || 0}
            >
              -{" "}
              {convertToLocale({ amount: gift_card_total ?? 0, currency_code })}
            </Text>
          </div>
        )}
      </div>
      <Divider className="my-2" />
      <div className="flex items-center justify-between text-ui-fg-base mb-2 txt-medium ">
        <Text className="font-medium">{t("totalLabel")}</Text>
        <Text
          className="txt-xlarge-plus"
          data-testid="cart-total"
          data-value={total || 0}
        >
          {convertToLocale({ amount: total ?? 0, currency_code })}
        </Text>
      </div>
    </div>
  )
}

export default CheckoutTotals
