"use client"

import { submitPromotionForm, type PromotionFormState } from "@/lib/data/cart"
import { getCartApprovalStatus } from "@/lib/util/get-cart-approval-status"
import { convertToLocale } from "@/lib/util/money"
import Trash from "@/modules/common/icons/trash"
import { B2BCart } from "@/types"
import { ChevronDownMini, ChevronUpMini } from "@medusajs/icons"
import { Badge, Heading, Input, Text } from "@medusajs/ui"
import { useLocale, useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import React, { useActionState } from "react"
import ErrorMessage from "../error-message"
import { SubmitButton } from "../submit-button"

type PromotionCodeProps = {
  cart: B2BCart
}

const PromotionCode: React.FC<PromotionCodeProps> = ({ cart }) => {
  const t = useTranslations("Checkout.promotionCode")
  const locale = useLocale()
  const [isOpen, setIsOpen] = React.useState(false)
  const [code, setCode] = React.useState("")
  const pathname = usePathname()

  const isCheckout = pathname.includes("/checkout")

  const { promotions = [] } = cart

  const { isPendingAdminApproval, isPendingSalesManagerApproval } =
    getCartApprovalStatus(cart)

  const isPendingApproval =
    isPendingAdminApproval || isPendingSalesManagerApproval

  const manualCodes = promotions.flatMap((promotion) =>
    !promotion.is_automatic && promotion.code ? [promotion.code] : []
  )

  const [state, formAction] = useActionState(
    async (currentState: PromotionFormState, formData: FormData) => {
      const result = await submitPromotionForm(currentState, formData)
      if (result?.success && !formData.has("remove_code")) {
        setCode("")
      }
      return result
    },
    null
  )

  const errorMessage = state?.success === false ? t("applyErrorMessage") : null
  const isFormOpen = !isCheckout && !isPendingApproval && isOpen
  const appliedCodeInputs = manualCodes.map((appliedCode) => (
    <input
      key={appliedCode}
      type="hidden"
      name="applied_code"
      value={appliedCode}
    />
  ))

  return (
    <div className="w-full bg-white flex flex-col">
      <div className="txt-medium">
        {!isCheckout && !isPendingApproval && (
          <form action={formAction} className="w-full mb-5">
            {appliedCodeInputs}
            <button
              onClick={() => setIsOpen(!isOpen)}
              type="button"
              className="flex gap-x-1 my-2 items-center txt-medium text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="add-discount-button"
            >
              {t("enterPromotionCodeLabel")}{" "}
              {isOpen ? <ChevronUpMini /> : <ChevronDownMini />}
            </button>

            {isOpen && (
              <>
                <div className="grid grid-cols-[1fr_auto] w-full gap-x-2">
                  <Input
                    className="w-full"
                    id="promotion-input"
                    name="code"
                    type="text"
                    autoFocus={false}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    data-testid="discount-input"
                  />
                  <SubmitButton
                    className="w-fit h-8"
                    variant="secondary"
                    data-testid="discount-apply-button"
                  >
                    {t("applyLabel")}
                  </SubmitButton>
                </div>

                <ErrorMessage
                  error={errorMessage}
                  data-testid="discount-error-message"
                />
              </>
            )}
          </form>
        )}

        {!isFormOpen && (
          <ErrorMessage
            error={errorMessage}
            data-testid="discount-error-message"
          />
        )}

        {promotions.length > 0 && (
          <div className="w-full flex items-center">
            <div className="flex flex-col w-full">
              <Heading className="txt-medium mb-2">
                {promotions.length > 1
                  ? t("promotionAppliedOther")
                  : t("promotionAppliedOne")}
              </Heading>

              {promotions.map((promotion) => {
                return (
                  <div
                    key={promotion.id}
                    className="flex items-center justify-between w-full max-w-full mb-2"
                    data-testid="discount-row"
                  >
                    <Text className="flex gap-x-1 items-baseline txt-small-plus w-4/5 pr-1">
                      <span className="truncate" data-testid="discount-code">
                        <Badge
                          color={promotion.is_automatic ? "green" : "blue"}
                          size="small"
                        >
                          {promotion.code}
                        </Badge>{" "}
                        (
                        {promotion.application_method?.value !== undefined &&
                          promotion.application_method.currency_code !==
                            undefined && (
                            <>
                              {promotion.application_method.type ===
                              "percentage"
                                ? `${promotion.application_method.value}%`
                                : convertToLocale({
                                    amount: promotion.application_method.value,
                                    currency_code:
                                      promotion.application_method
                                        .currency_code,
                                    locale,
                                  })}
                            </>
                          )}
                        )
                      </span>
                    </Text>
                    {!promotion.is_automatic &&
                      !isCheckout &&
                      promotion.code && (
                        <form action={formAction}>
                          {appliedCodeInputs}
                          <input
                            type="hidden"
                            name="remove_code"
                            value={promotion.code}
                          />
                          <button
                            type="submit"
                            className="flex items-center"
                            data-testid="remove-discount-button"
                          >
                            <Trash size={14} />
                            <span className="sr-only">
                              {t("removeDiscountSrLabel")}
                            </span>
                          </button>
                        </form>
                      )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PromotionCode
