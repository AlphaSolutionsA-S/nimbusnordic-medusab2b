import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import { getTranslations } from "next-intl/server"

type ItemUnitPriceProps = {
  item: HttpTypes.StoreOrderLineItem
  style?: "default" | "tight"
}

// NOTE: this component is not imported/used anywhere in the app (verified via
// repo-wide search). Left in place per this project's dead-code policy
// (flagged, not removed).
const ItemUnitPrice = async ({ item, style = "default" }: ItemUnitPriceProps) => {
  const t = await getTranslations("Order.item")
  const hasReducedPrice = !!item.compare_at_unit_price
  return (
    <div className="flex flex-col text-ui-fg-muted justify-center h-full">
      {hasReducedPrice && (
        <p>
          {style === "default" && (
            <span className="text-ui-fg-muted">{t("originalLabel")}</span>
          )}
          <span
            className="line-through"
            data-testid="product-unit-original-price"
          >
            {item.compare_at_unit_price}
          </span>
        </p>
      )}
      <span
        className={clx("text-base-regular", {
          "text-ui-fg-interactive": hasReducedPrice,
        })}
        data-testid="product-unit-price"
      >
        {item.unit_price}
      </span>
    </div>
  )
}

export default ItemUnitPrice
