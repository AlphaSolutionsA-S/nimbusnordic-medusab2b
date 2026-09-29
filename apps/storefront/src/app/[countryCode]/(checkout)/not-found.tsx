import InteractiveLink from "@/modules/common/components/interactive-link"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Common.notFound")

  return {
    title: t("headingLabel"),
    description: t("pageMessage"),
  }
}

export default async function NotFound() {
  const t = await getTranslations("Common.notFound")

  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">{t("headingLabel")}</h1>
      <p className="text-small-regular text-ui-fg-base">
        {t("pageMessage")}
      </p>
      <InteractiveLink href="/">{t("goToFrontpageLabel")}</InteractiveLink>
    </div>
  )
}
