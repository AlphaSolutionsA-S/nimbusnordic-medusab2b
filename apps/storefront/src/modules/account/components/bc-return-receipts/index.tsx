import { Heading } from "@medusajs/ui"
import { useLocale, useTranslations } from "next-intl"
import { getFormattingLocale } from "@/lib/i18n/formatting-locale"
import type { BCPostedReturnReceipt } from "@/types/bc-order"

type BcReturnReceiptsProps = {
  receipts: BCPostedReturnReceipt[]
}

const BcReturnReceipts = ({ receipts }: BcReturnReceiptsProps) => {
  const t = useTranslations("Account.bcReturnReceipts")
  // Column and item labels are shared with the return order lines table (NIMBUS-141).
  const tLines = useTranslations("Account.bcReturnLines")
  const locale = useLocale()

  return (
    <div className="flex flex-col gap-y-6" data-testid="bc-return-receipts">
      <Heading level="h2">{t("heading")}</Heading>
      {receipts.map((receipt) => {
        const receivedDate = new Date(receipt.receivedDate)

        return (
          <section
            key={receipt.number}
            className="flex flex-col gap-y-3"
            data-testid="bc-return-receipt"
          >
            <Heading level="h3" data-testid="bc-return-receipt-number">
              {t("receiptNumberHeading", { number: receipt.number })}
            </Heading>
            <dl className="grid grid-cols-1 small:grid-cols-2 gap-x-12 gap-y-3 text-small-regular">
              <div>
                <dt className="text-ui-fg-subtle">{t("receivedDateLabel")}</dt>
                <dd className="text-ui-fg-base" data-testid="bc-return-receipt-date">
                  {Number.isNaN(receivedDate.getTime())
                    ? "-"
                    : receivedDate.toLocaleDateString(getFormattingLocale(locale))}
                </dd>
              </div>
              {receipt.externalDocumentNumber ? (
                <div>
                  <dt className="text-ui-fg-subtle">{t("externalRefLabel")}</dt>
                  <dd
                    className="text-ui-fg-base"
                    data-testid="bc-return-receipt-external-ref"
                  >
                    {receipt.externalDocumentNumber}
                  </dd>
                </div>
              ) : null}
            </dl>

            {receipt.lines.length === 0 ? (
              <p
                className="text-base-regular text-ui-fg-subtle"
                data-testid="bc-return-receipt-lines-empty"
              >
                {t("emptyLinesMessage")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-small-regular">
                  <thead className="border-b border-ui-border-base text-ui-fg-subtle">
                    <tr>
                      <th className="pb-2 pr-4 font-normal">{tLines("itemColumnLabel")}</th>
                      <th className="pb-2 pr-4 font-normal">{tLines("unitColumnLabel")}</th>
                      <th className="pb-2 pr-4 font-normal">{t("quantityColumnLabel")}</th>
                      <th className="pb-2 font-normal">{tLines("reasonColumnLabel")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.lines.map((line) => (
                      <tr
                        key={line.lineNumber}
                        className="border-b border-ui-border-base"
                        data-testid="bc-return-receipt-line"
                      >
                        <td className="py-3 pr-4 text-ui-fg-base">
                          <div>{line.description || line.itemNumber}</div>
                          {line.itemNumber && (
                            <div
                              className="text-ui-fg-subtle"
                              data-testid="bc-return-line-item-number"
                            >
                              {tLines("itemNumberLabel", { number: line.itemNumber })}
                              {line.variantCode
                                ? ` · ${tLines("variantLabel", { variant: line.variantCode })}`
                                : ""}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-ui-fg-base">{line.unitOfMeasureCode}</td>
                        <td
                          className="py-3 pr-4 text-ui-fg-base"
                          data-testid="bc-return-receipt-line-quantity"
                        >
                          {line.quantity}
                        </td>
                        <td
                          className="py-3 text-ui-fg-base"
                          data-testid="bc-return-receipt-line-reason"
                        >
                          {line.returnReasonCode || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

export default BcReturnReceipts
