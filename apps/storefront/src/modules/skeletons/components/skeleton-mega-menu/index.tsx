import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { useTranslations } from "next-intl"

export default function SkeletonMegaMenu() {
  const t = useTranslations("Layout.megaMenu")

  return (
    <LocalizedClientLink
      className="hover:text-ui-fg-base hover:bg-neutral-100 rounded-full px-3 py-2"
      href="/store"
    >
      {t("productsLabel")}
    </LocalizedClientLink>
  )
}
