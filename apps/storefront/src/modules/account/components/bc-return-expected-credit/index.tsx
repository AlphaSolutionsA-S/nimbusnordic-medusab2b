import { Heading } from "@medusajs/ui"
import { useTranslations } from "next-intl"
import { convertToLocale } from "@/lib/util/money"
import type { BCReturnExpectedCredit } from "@/types/bc-order"

type BcReturnExpectedCreditProps = {
  expectedCredit: BCReturnExpectedCredit
}

const BcReturnExpectedCredit = ({ expectedCredit }: BcReturnExpectedCreditProps) => {
  const t = useTranslations("Account.bcReturnExpectedCredit")
  const formatAmount = (amount: number) =>
    convertToLocale({ amount, currency_code: expectedCredit.currencyCode })

  return (
    <div className="flex flex-col gap-y-3" data-testid="bc-return-expected-credit">
      <Heading level="h2">{t("heading")}</Heading>
      <dl className="grid grid-cols-1 small:grid-cols-2 gap-x-12 gap-y-3 text-small-regular">
        {expectedCredit.amountExcludingTax !== null && (
          <div>
            <dt className="text-ui-fg-subtle">{t("excludingTaxLabel")}</dt>
            <dd
              className="text-ui-fg-base"
              data-testid="bc-return-expected-credit-excluding-tax"
            >
              {formatAmount(expectedCredit.amountExcludingTax)}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-ui-fg-subtle">{t("includingTaxLabel")}</dt>
          <dd
            className="text-ui-fg-base font-medium"
            data-testid="bc-return-expected-credit-including-tax"
          >
            {formatAmount(expectedCredit.amountIncludingTax)}
          </dd>
        </div>
      </dl>
      <p
        className="text-small-regular text-ui-fg-subtle"
        data-testid="bc-return-expected-credit-disclaimer"
      >
        {t("disclaimer")}
      </p>
    </div>
  )
}

export default BcReturnExpectedCredit
