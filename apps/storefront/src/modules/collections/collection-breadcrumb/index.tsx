import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { getTranslations } from "next-intl/server"

const CollectionBreadcrumbItem = ({
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
        href={handle ? `/collections/${handle}` : "/store"}
      >
        {title}
      </LocalizedClientLink>
    </li>
  )
}

const CollectionBreadcrumb = async ({
  collection,
}: {
  collection: HttpTypes.StoreCollection
}) => {
  const t = await getTranslations("Catalog.breadcrumb")

  return (
    <ul className="flex items-center gap-x-3 text-sm">
      <CollectionBreadcrumbItem title={t("productsLabel")} key="base" />
      <span className="text-neutral-500">{">"}</span>
      <CollectionBreadcrumbItem
        title={collection.title}
        handle={collection.handle}
        key={collection.id}
      />
    </ul>
  )
}

export default CollectionBreadcrumb
