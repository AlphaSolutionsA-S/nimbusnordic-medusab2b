import { ArrowUpRightMini } from "@medusajs/icons"
import { Text } from "@medusajs/ui"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

// Outside the [countryCode] segment there is no NextIntlClientProvider, so
// only server-side getTranslations is used here. Without a locale header
// src/i18n/request.ts resolves DEFAULT_LOCALE ("en").
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
      <p className="text-small-regular text-ui-fg-base">{t("pageMessage")}</p>
      <Link className="flex gap-x-1 items-center group" href="/">
        <Text className="text-ui-fg-interactive">{t("goToFrontpageLabel")}</Text>
        <ArrowUpRightMini
          className="group-hover:rotate-45 ease-in-out duration-150"
          color="var(--fg-interactive)"
        />
      </Link>
    </div>
  )
}
