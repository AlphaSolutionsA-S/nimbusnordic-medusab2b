"use client"

import { Text } from "@medusajs/ui"

import { checkSpendingLimit } from "@/lib/util/check-spending-limit"
import PaymentButton from "@/modules/checkout/components/payment-button"
import Button from "@/modules/common/components/button"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { B2BCart, B2BCustomer } from "@/types"
import { ExclamationCircle } from "@medusajs/icons"
import { useTranslations } from "next-intl"

const Review = ({
  cart,
  customer,
}: {
  cart: B2BCart
  customer: B2BCustomer | null
}) => {
  const t = useTranslations("Checkout.review")
  // Reuses the identical spending-limit message already extracted for
  // `@/modules/cart/templates/summary`.
  const tCartSummary = useTranslations("Cart.summary")
  const spendLimitExceeded = customer
    ? checkSpendingLimit(cart, customer)
    : false

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex items-start gap-x-1 w-full">
        <Text className="txt-xsmall text-neutral-500 mb-1">
          {t.rich("agreementText", {
            termsLink: (chunks) => (
              <LocalizedClientLink
                href="/terms-of-sale"
                className="hover:text-neutral-800"
                target="_blank"
              >
                {chunks}
              </LocalizedClientLink>
            ),
            privacyLink: (chunks) => (
              <LocalizedClientLink
                href="/privacy-policy"
                className="hover:text-neutral-800"
                target="_blank"
              >
                {chunks}
              </LocalizedClientLink>
            ),
          })}
        </Text>
      </div>
      {spendLimitExceeded ? (
        <>
          <div className="flex items-center gap-x-2 bg-neutral-100 p-3 rounded-md shadow-borders-base">
            <ExclamationCircle className="text-orange-500 w-fit overflow-visible" />
            <p className="text-neutral-950 text-xs">
              {tCartSummary.rich("spendingLimitMessage", { br: () => <br /> })}
            </p>
          </div>
          <Button className="w-full h-10 rounded-full shadow-none" disabled>
            {t("placeOrderLabel")}
          </Button>
        </>
      ) : (
        <PaymentButton cart={cart} data-testid="submit-order-button" />
      )}
    </div>
  )
}

export default Review
