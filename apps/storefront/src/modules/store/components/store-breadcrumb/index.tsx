import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { getTranslations } from "next-intl/server"

const StoreBreadcrumbItem = ({
  title,
  handle,
}: {
  title: string
  handle?: string
}) => {
  return (
    <li className="text-neutral-500">
      <LocalizedClientLink
        className="hover:text-neutral-900"
        href={handle ? `${handle}` : "/store"}
      >
        {title}
      </LocalizedClientLink>
    </li>
  )
}

const StoreBreadcrumb = async () => {
  const t = await getTranslations("Catalog.breadcrumb")

  return (
    <ul className="flex items-center gap-x-3 text-sm">
      <StoreBreadcrumbItem title={t("productsLabel")} key="base" />
      <span className="text-neutral-500">{">"}</span>
      <StoreBreadcrumbItem title={t("allProductsLabel")} handle="/store" />
    </ul>
  )
}

export default StoreBreadcrumb
