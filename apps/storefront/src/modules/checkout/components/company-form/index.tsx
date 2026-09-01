"use client"

import { getCartApprovalStatus } from "@/lib/util/get-cart-approval-status"
import Divider from "@/modules/common/components/divider"
import Radio from "@/modules/common/components/radio"
import { B2BCart } from "@/types"
import { RadioGroup } from "@headlessui/react"
import { clx } from "@medusajs/ui"
import { useTranslations } from "next-intl"
import { useState } from "react"

const CompanyForm = ({ cart }: { cart: B2BCart }) => {
  const t = useTranslations("Checkout.companyForm")
  const [selectedOption, setSelectedOption] = useState("company")

  const { isPendingAdminApproval, isPendingSalesManagerApproval } =
    getCartApprovalStatus(cart)

  const isPendingApproval =
    isPendingAdminApproval || isPendingSalesManagerApproval

  if (!cart?.company) {
    return null
  }

  return (
    <div>
      <RadioGroup
        value={selectedOption}
        onChange={(value) => {
          !isPendingApproval && setSelectedOption(value)
        }}
        className="flex flex-col gap-y-2"
      >
        <RadioGroup.Option value="company">
          <div
            className={clx(
              "flex items-center gap-x-4 text-sm text-neutral-600 cursor-pointer",
              isPendingApproval && "opacity-50 cursor-default"
            )}
          >
            <Radio
              checked={selectedOption === "company"}
              data-testid="company-form-company-radio"
              disabled={isPendingApproval}
            />
            <span>
              {t("orderOnBehalfOf", { companyName: cart?.company.name })}
            </span>
          </div>
        </RadioGroup.Option>
        <Divider />
        <RadioGroup.Option value="custom">
          <div
            className={clx(
              "flex items-center gap-x-4 text-sm text-neutral-600 cursor-pointer",
              isPendingApproval && "opacity-50 cursor-default"
            )}
            onClick={() => {
              !isPendingApproval && setSelectedOption("custom")
            }}
          >
            <Radio
              checked={selectedOption === "custom"}
              data-testid="company-form-custom-radio"
              disabled={isPendingApproval}
            />
            <span>{t("customCheckoutLabel")}</span>
          </div>
        </RadioGroup.Option>
      </RadioGroup>
    </div>
  )
}

export default CompanyForm
