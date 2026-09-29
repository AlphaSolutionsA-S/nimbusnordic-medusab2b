import InteractiveLink from "@/modules/common/components/interactive-link"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Common.notFound")
  const tCart = await getTranslations("Cart.notFound")

  return {
    title: t("headingLabel"),
    description: tCart("cartMessage"),
  }
}

export default async function NotFound() {
  // Reuses the identical heading/link copy already extracted for
  // `@/app/[countryCode]/(main)/not-found`; only the message differs.
  const tCommonNotFound = await getTranslations("Common.notFound")
  const t = await getTranslations("Cart.notFound")

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">
        {tCommonNotFound("headingLabel")}
      </h1>
      <p className="text-small-regular text-ui-fg-base">{t("cartMessage")}</p>
      <InteractiveLink href="/">
        {tCommonNotFound("goToFrontpageLabel")}
      </InteractiveLink>
    </div>
  )
}
