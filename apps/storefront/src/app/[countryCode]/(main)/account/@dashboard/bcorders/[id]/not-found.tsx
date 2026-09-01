import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { getTranslations } from "next-intl/server"

export default async function NotFound() {
  // Reuses the identical "Back to BC orders" link label already extracted
  // for `@/modules/account/templates/bc-order-detail-template`.
  const tBcOrderDetailTemplate = await getTranslations(
    "Account.bcOrderDetailTemplate"
  )
  const t = await getTranslations("Account.bcOrderNotFound")

  return (
    <div
      className="w-full flex flex-col items-center gap-y-4 py-8"
      data-testid="bc-order-detail-not-found"
    >
      <h1 className="text-large-semi">{t("headingLabel")}</h1>
      <p className="text-base-regular text-neutral-500">{t("message")}</p>
      <LocalizedClientLink
        href="/account/bcorders"
        className="text-small-regular text-ui-fg-base underline"
      >
        {tBcOrderDetailTemplate("backToBcOrdersLabel")}
      </LocalizedClientLink>
    </div>
  )
}