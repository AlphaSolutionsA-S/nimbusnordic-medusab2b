import { Text } from "@medusajs/ui"
import { useLocale, useTranslations } from "next-intl"
import { getFormattingLocale } from "@/lib/i18n/formatting-locale"
import type { BCOrderLine } from "@/types/bc-order"

type BcOrderLineFulfillmentProps = {
  line: BCOrderLine
  showReservations?: boolean
}

// BC uses 2099-01-01 as a placeholder for an unknown shipment date.
const UNKNOWN_SHIPMENT_DATE = "2099-01-01"

const BcOrderLineFulfillment = ({
  line,
  showReservations = false,
}: BcOrderLineFulfillmentProps) => {
  const t = useTranslations("Account.bcOrderLineFulfillment")
  const locale = useLocale()
  const dateFormatter = new Intl.DateTimeFormat(getFormattingLocale(locale), {
    dateStyle: "medium",
    timeZone: "UTC",
  })
  const formatDate = (date: string) => dateFormatter.format(new Date(date))
  const unshippedQuantity = Math.max(0, line.quantity - line.shippedQuantity)
  const reservedQuantity = Math.min(
    unshippedQuantity,
    line.reservations.reduce((sum, reservation) => sum + reservation.quantity, 0)
  )
  const awaitingQuantity = unshippedQuantity - reservedQuantity

  const shippedLabel =
    line.shippedQuantity >= line.quantity
      ? t("fullyShippedLabel")
      : line.shippedQuantity === 0
        ? t("notShippedLabel")
        : t("partiallyShippedLabel", {
            shipped: line.shippedQuantity,
            ordered: line.quantity,
          })

  const summary = [
    shippedLabel,
    showReservations && reservedQuantity > 0
      ? t("reservedLabel", { quantity: reservedQuantity })
      : null,
    showReservations && reservedQuantity > 0 && awaitingQuantity > 0
      ? t("awaitingLabel", { quantity: awaitingQuantity })
      : null,
  ]
    .filter(Boolean)
    .join(" · ")

  if (!showReservations || line.reservations.length === 0) {
    return <Text className="text-ui-fg-subtle">{summary}</Text>
  }

  return (
    <details>
      <summary className="cursor-pointer text-ui-fg-subtle">{summary}</summary>
      <ul className="mt-2 flex flex-col gap-y-1">
        {line.reservations.map((reservation) => (
          <li key={reservation.id} className="text-ui-fg-subtle">
            {[
              t("reservationQuantityLabel", { quantity: reservation.quantity }),
              reservation.reservedFrom
                ? t("reservationFromLabel", { source: reservation.reservedFrom })
                : null,
              reservation.locationCode
                ? t("reservationLocationLabel", { location: reservation.locationCode })
                : null,
              reservation.expectedReceiptDate
                ? t("reservationExpectedLabel", {
                    date: formatDate(reservation.expectedReceiptDate),
                  })
                : null,
              reservation.shipmentDate &&
              reservation.shipmentDate !== UNKNOWN_SHIPMENT_DATE
                ? t("reservationShipsLabel", {
                    date: formatDate(reservation.shipmentDate),
                  })
                : null,
              reservation.freightType
                ? t("reservationFreightLabel", { freightType: reservation.freightType })
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </li>
        ))}
      </ul>
    </details>
  )
}

export default BcOrderLineFulfillment
