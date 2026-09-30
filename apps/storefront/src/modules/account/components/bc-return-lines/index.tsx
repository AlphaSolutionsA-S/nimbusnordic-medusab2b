import { Heading } from "@medusajs/ui"
import { useTranslations } from "next-intl"
import type { BCReturnDetailLine } from "@/types/bc-order"

type BcReturnLinesProps = {
  lines: BCReturnDetailLine[]
}

const BcReturnLines = ({ lines }: BcReturnLinesProps) => {
  const t = useTranslations("Account.bcReturnLines")

  return (
    <div data-testid="bc-return-lines">
      <Heading level="h2" className="mb-4">
        {t("itemsHeading")}
      </Heading>
      {lines.length === 0 ? (
        <p
          className="text-base-regular text-ui-fg-subtle"
          data-testid="bc-return-lines-empty"
        >
          {t("emptyMessage")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-small-regular">
            <thead className="border-b border-ui-border-base text-ui-fg-subtle">
              <tr>
                <th className="pb-2 pr-4 font-normal">{t("itemColumnLabel")}</th>
                <th className="pb-2 pr-4 font-normal">{t("unitColumnLabel")}</th>
                <th className="pb-2 pr-4 font-normal">
                  {t("requestedQuantityColumnLabel")}
                </th>
                <th className="pb-2 pr-4 font-normal">
                  {t("receivedQuantityColumnLabel")}
                </th>
                <th className="pb-2 font-normal">{t("reasonColumnLabel")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr
                  key={line.id}
                  className="border-b border-ui-border-base"
                  data-testid="bc-return-line"
                >
                  <td className="py-3 pr-4 text-ui-fg-base">
                    <div>{line.description || line.itemNumber}</div>
                    {line.itemNumber && (
                      <div
                        className="text-ui-fg-subtle"
                        data-testid="bc-return-line-item-number"
                      >
                        {t("itemNumberLabel", { number: line.itemNumber })}
                        {line.variantCode
                          ? ` · ${t("variantLabel", { variant: line.variantCode })}`
                          : ""}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-ui-fg-base">
                    {line.unitOfMeasureCode}
                  </td>
                  <td
                    className="py-3 pr-4 text-ui-fg-base"
                    data-testid="bc-return-line-quantity"
                  >
                    {line.quantity}
                  </td>
                  <td
                    className="py-3 pr-4 text-ui-fg-base"
                    data-testid="bc-return-line-received"
                  >
                    {line.quantityReceived}
                  </td>
                  <td
                    className="py-3 text-ui-fg-base"
                    data-testid="bc-return-line-reason"
                  >
                    {line.returnReasonCode || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default BcReturnLines
