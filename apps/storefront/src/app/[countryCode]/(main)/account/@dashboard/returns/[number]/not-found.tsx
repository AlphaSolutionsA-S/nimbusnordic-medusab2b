import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { getTranslations } from "next-intl/server"

export default async function NotFound() {
  // Reuses the "Back to returns" label of the detail template.
  const tBcReturnDetailTemplate = await getTranslations(
    "Account.bcReturnDetailTemplate"
  )
  const t = await getTranslations("Account.bcReturnNotFound")

  return (
    <div
      className="w-full flex flex-col items-center gap-y-4 py-8"
      data-testid="bc-return-detail-not-found"
    >
      <h1 className="text-large-semi">{t("headingLabel")}</h1>
      <p className="text-base-regular text-neutral-500">{t("message")}</p>
      <LocalizedClientLink
        href="/account/returns"
        className="text-small-regular text-ui-fg-base underline"
      >
        {tBcReturnDetailTemplate("backToReturnsLabel")}
      </LocalizedClientLink>
    </div>
  )
}
