import { convertToLocale } from "@/lib/util/money"
import { clx } from "@medusajs/ui"
import { useLocale } from "next-intl"

export const formatAmount = (
  amount: number,
  currency_code: string,
  locale: string
) => {
  return convertToLocale({ amount, currency_code, locale })
}

type AmountCellProps = {
  currencyCode: string
  amount?: number | null
  originalAmount?: number | null
  align?: "left" | "right"
  className?: string
}

export const AmountCell = ({
  currencyCode,
  amount,
  originalAmount,
  align = "left",
  className,
}: AmountCellProps) => {
  const locale = useLocale()
  const formatted = formatAmount(amount!, currencyCode, locale)
  const originalAmountPresent = typeof originalAmount === "number"
  const originalAmountDiffers = originalAmount !== amount
  const shouldShowAmountDiff = originalAmountPresent && originalAmountDiffers

  return (
    <div
      className={clx(
        "flex h-full w-full items-center overflow-hidden",
        {
          "flex-col": shouldShowAmountDiff,
          "justify-start text-left": align === "left",
          "justify-end text-right": align === "right",
        },
        className
      )}
    >
      {shouldShowAmountDiff ? (
        <>
          <span className="truncate line-through text-xs">
            {formatAmount(originalAmount!, currencyCode, locale)}
          </span>
          <span className="truncate text-blue-400 txt-small">{formatted}</span>
        </>
      ) : (
        <>
          <span className="truncate">{formatted}</span>
        </>
      )}
    </div>
  )
}
