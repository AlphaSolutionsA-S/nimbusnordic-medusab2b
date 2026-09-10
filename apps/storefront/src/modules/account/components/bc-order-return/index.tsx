"use client"

import { type ReactNode, useState } from "react"
import { FetchError } from "@medusajs/js-sdk"
import { Button, Container, Heading, Input, Select, Text } from "@medusajs/ui"
import { useTranslations } from "next-intl"
import { createBCReturn } from "@/lib/data/business-central"
import type {
  BCOrderDetail,
  BCReturnLineInput,
  BCReturnOrder,
  BCReturnReason,
} from "@/types/bc-order"

type BcOrderReturnProps = {
  order: BCOrderDetail
  reasons: BCReturnReason[]
  children: ReactNode
}

type LineDraft = {
  quantity: number
  reasonCode: string
}

type ReturnDraft = Record<number, LineDraft>

const BcOrderReturn = ({ order, reasons, children }: BcOrderReturnProps) => {
  const t = useTranslations("Account.bcOrderReturn")
  const eligibleLines = order.lines.filter(
    (line) => line.lineType === "Item" && line.quantity > 0
  )
  const [isReturnFlow, setIsReturnFlow] = useState(false)
  const [draft, setDraft] = useState<ReturnDraft>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<BCReturnOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const formattedUnitPrice = (amount: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: order.currencyCode,
    }).format(amount)
  const renderAddress = (address: string[]) =>
    address.length > 0
      ? address.map((line) => <div key={line}>{line}</div>)
      : "-"

  const updateDraft = (
    sequence: number,
    update: (line: LineDraft) => LineDraft
  ) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [sequence]: update(
        currentDraft[sequence] ?? { quantity: 0, reasonCode: "" }
      ),
    }))
  }

  const onQuantityChange = (sequence: number, value: string, maximum: number) => {
    const parsedValue = Number(value)
    const quantity = Number.isFinite(parsedValue)
      ? Math.min(Math.max(parsedValue, 0), maximum)
      : 0

    updateDraft(sequence, (line) => ({ ...line, quantity }))
  }

  const onReasonChange = (sequence: number, reasonCode: string) => {
    updateDraft(sequence, (line) => ({ ...line, reasonCode }))
  }

  const closeReturnFlow = () => {
    setIsReturnFlow(false)
    setDraft({})
    setError(null)
    setResult(null)
  }

  const selectedLines = (): BCReturnLineInput[] =>
    Object.entries(draft)
      .map(([sourceLineNo, line]) => ({
        source_line_no: Number(sourceLineNo),
        quantity: line.quantity,
        return_reason_code: line.reasonCode,
      }))
      .filter((line) => line.quantity > 0)

  const lines = selectedLines()
  const canSubmit =
    !submitting &&
    lines.length > 0 &&
    lines.every((line) => line.return_reason_code.length > 0)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSubmit) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const returnOrder = await createBCReturn(order.id, { lines })
      setResult(returnOrder)
    } catch (error) {
      if (error instanceof FetchError && error.status === 404) {
        setError(t("orderUnavailableError"))
      } else if (error instanceof FetchError && error.status === 503) {
        setError(t("returnUnconfirmedError"))
      } else {
        setError(t("genericReturnError"))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isReturnFlow) {
    return (
      <>
        {children}
        {eligibleLines.length > 0 && (
          <Container data-testid="bc-order-return">
            <Button type="button" onClick={() => setIsReturnFlow(true)}>
              {t("requestReturnLabel")}
            </Button>
          </Container>
        )}
      </>
    )
  }

  if (result) {
    return (
      <Container className="flex flex-col gap-y-2" data-testid="bc-order-return">
        <Heading level="h2">{t("returnRequestedHeading")}</Heading>
        <Text>
          {t("returnCreatedMessage", {
            number: result.number,
            status: result.status,
          })}
        </Text>
        <div>
          <Button type="button" onClick={closeReturnFlow}>
            {t("backToOrderDetailsLabel")}
          </Button>
        </div>
      </Container>
    )
  }

  return (
    <Container className="flex flex-col gap-y-4" data-testid="bc-order-return">
      <Heading level="h2">{t("requestReturnLabel")}</Heading>
      <div className="grid grid-cols-1 gap-x-12 gap-y-6 border-y border-ui-border-base py-4 text-small-regular small:grid-cols-2">
        <div className="small:col-span-2">
          <Text className="text-ui-fg-subtle">{t("orderNumberLabel")}</Text>
          <Text>#{order.number}</Text>
        </div>
        <dl>
          <dt className="mb-1 text-ui-fg-subtle">{t("billToAddressLabel")}</dt>
          <dd>{renderAddress(order.billToAddress)}</dd>
        </dl>
        <dl>
          <dt className="mb-1 text-ui-fg-subtle">{t("shipToAddressLabel")}</dt>
          <dd>{renderAddress(order.shipToAddress)}</dd>
        </dl>
      </div>
      <form className="flex flex-col gap-y-4" onSubmit={onSubmit}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-small-regular">
            <thead className="border-b border-ui-border-base text-ui-fg-subtle">
              <tr>
                <th className="pb-2 pr-4 font-normal">{t("itemColumnLabel")}</th>
                <th className="pb-2 pr-4 font-normal">
                  {t("orderedQuantityColumnLabel")}
                </th>
                <th className="pb-2 pr-4 font-normal">
                  {t("unitPriceColumnLabel")}
                </th>
                <th className="pb-2 pr-4 font-normal">
                  {t("returnQuantityColumnLabel")}
                </th>
                <th className="pb-2 font-normal">{t("returnReasonColumnLabel")}</th>
              </tr>
            </thead>
            <tbody>
              {eligibleLines.map((line) => {
                const lineDraft = draft[line.sequence]

                return (
                  <tr key={line.id} className="border-b border-ui-border-base">
                    <td className="py-3 pr-4">
                      {line.itemDisplayName ||
                        line.description ||
                        line.itemNumber ||
                        t("itemFallbackLabel")}
                    </td>
                    <td className="py-3 pr-4">{line.quantity}</td>
                    <td className="py-3 pr-4">{formattedUnitPrice(line.unitPrice)}</td>
                    <td className="py-3 pr-4">
                      <Input
                        type="number"
                        min="0"
                        max={line.quantity}
                        step="any"
                        value={lineDraft?.quantity ?? 0}
                        onChange={(event) =>
                          onQuantityChange(
                            line.sequence,
                            event.target.value,
                            line.quantity
                          )
                        }
                        aria-label={t("returnQuantityAriaLabel", {
                          item:
                            line.description ||
                            line.itemNumber ||
                            t("itemLowercaseFallbackLabel"),
                        })}
                      />
                    </td>
                    <td className="py-3">
                      <Select
                        value={lineDraft?.reasonCode ?? ""}
                        onValueChange={(reasonCode) =>
                          onReasonChange(line.sequence, reasonCode)
                        }
                      >
                        <Select.Trigger>
                          <Select.Value placeholder={t("selectReasonPlaceholder")} />
                        </Select.Trigger>
                        <Select.Content>
                          {reasons.map((reason) => (
                            <Select.Item key={reason.id} value={reason.id}>
                              {reason.description}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {error && <Text className="text-ui-fg-error">{error}</Text>}
        <div className="flex gap-x-2">
          <Button type="button" onClick={closeReturnFlow} disabled={submitting}>
            {t("cancelLabel")}
          </Button>
          <Button type="submit" disabled={!canSubmit} isLoading={submitting}>
            {t("submitReturnRequestLabel")}
          </Button>
        </div>
      </form>
    </Container>
  )
}

export default BcOrderReturn
