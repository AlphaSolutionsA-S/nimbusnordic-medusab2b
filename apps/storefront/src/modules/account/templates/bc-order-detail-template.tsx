import { Container, Heading } from "@medusajs/ui"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import type { BCOrderDetail } from "@/types/bc-order"

type BcOrderDetailTemplateProps = {
  order: BCOrderDetail
}

const BcOrderDetailTemplate = ({ order }: BcOrderDetailTemplateProps) => {
  const formattedAmount = (amount: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: order.currencyCode,
    }).format(amount)

  const renderAddress = (address: string[]) =>
    address.length > 0 ? address.map((line) => <div key={line}>{line}</div>) : "-"

  return (
    <div className="flex flex-col gap-y-4" data-testid="bc-order-detail">
      <LocalizedClientLink
        href="/account/bcorders"
        className="text-small-regular text-ui-fg-subtle hover:text-ui-fg-base"
      >
        Back to BC orders
      </LocalizedClientLink>

      <Container className="flex flex-col gap-y-4">
        <div>
          <Heading level="h1">Order #{order.number}</Heading>
          <p className="text-small-regular text-ui-fg-subtle mt-1">
            {new Date(order.orderDate).toLocaleDateString("en-GB")}
          </p>
        </div>

        <div className="grid grid-cols-1 small:grid-cols-2 gap-x-12 gap-y-6 text-small-regular">
          <dl>
            <dt className="text-ui-fg-subtle mb-1">Bill-to address</dt>
            <dd className="text-ui-fg-base">{renderAddress(order.billToAddress)}</dd>
          </dl>
          <dl>
            <dt className="text-ui-fg-subtle mb-1">Ship-to address</dt>
            <dd className="text-ui-fg-base">{renderAddress(order.shipToAddress)}</dd>
          </dl>
        </div>

        <dl className="grid grid-cols-1 small:grid-cols-2 gap-x-12 gap-y-3 border-t border-ui-border-base pt-4 text-small-regular">
          <div>
            <dt className="text-ui-fg-subtle">Customer</dt>
            <dd className="text-ui-fg-base">{order.customerName}</dd>
          </div>
          <div>
            <dt className="text-ui-fg-subtle">Status</dt>
            <dd className="text-ui-fg-base">{order.status}</dd>
          </div>
          <div>
            <dt className="text-ui-fg-subtle">Currency</dt>
            <dd className="text-ui-fg-base">{order.currencyCode}</dd>
          </div>
          <div>
            <dt className="text-ui-fg-subtle">Total excluding tax</dt>
            <dd className="text-ui-fg-base">
              {formattedAmount(order.totalAmountExcludingTax)}
            </dd>
          </div>
          <div>
            <dt className="text-ui-fg-subtle">Total including tax</dt>
            <dd className="text-ui-fg-base">
              {formattedAmount(order.totalAmountIncludingTax)}
            </dd>
          </div>
        </dl>
      </Container>

      <Container>
        <Heading level="h2" className="mb-4">
          Items
        </Heading>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-small-regular">
            <thead className="border-b border-ui-border-base text-ui-fg-subtle">
              <tr>
                <th className="pb-2 pr-4 font-normal">Description</th>
                <th className="pb-2 pr-4 font-normal">Quantity</th>
                <th className="pb-2 pr-4 font-normal">Unit price</th>
                <th className="pb-2 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => {
                if (line.lineType === "Comment") {
                  return (
                    <tr key={line.id} className="border-b border-ui-border-base">
                      <td className="py-3 text-ui-fg-subtle" colSpan={4}>
                        {line.description}
                      </td>
                    </tr>
                  )
                }

                const description =
                  line.lineType === "Item"
                    ? [line.itemDisplayName, line.description].filter(Boolean).join(" ")
                    : line.description

                return (
                  <tr key={line.id} className="border-b border-ui-border-base">
                    <td className="py-3 pr-4 text-ui-fg-base">
                      {description || line.itemNumber || "Item"}
                    </td>
                    <td className="py-3 pr-4 text-ui-fg-base">{line.quantity}</td>
                    <td className="py-3 pr-4 text-ui-fg-base">
                      {formattedAmount(line.unitPrice)}
                    </td>
                    <td className="py-3 text-right text-ui-fg-base">
                      {formattedAmount(line.lineAmount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t border-ui-border-strong">
              <tr>
                <th className="pt-3 pr-4 text-right font-medium text-ui-fg-base" colSpan={3}>
                  Total excluding tax
                </th>
                <td className="pt-3 text-right font-medium text-ui-fg-base">
                  {formattedAmount(order.totalAmountExcludingTax)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Container>
    </div>
  )
}

export default BcOrderDetailTemplate