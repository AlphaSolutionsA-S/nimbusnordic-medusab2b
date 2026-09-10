import { getProductsById } from "@/lib/data/products"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@medusajs/ui"

import InteractiveLink from "@/modules/common/components/interactive-link"
import ProductPreview from "@/modules/products/components/product-preview"
import { getTranslations } from "next-intl/server"

export default async function ProductRail({
  collection,
  region,
}: {
  collection: HttpTypes.StoreCollection
  region: HttpTypes.StoreRegion
}) {
  const t = await getTranslations("Home.productRail")
  const { products } = collection

  if (!products) {
    return null
  }

  const productsWithPrices = await getProductsById({
    ids: products.map((p) => p.id!),
    regionId: region.id,
  })

  return (
    <div className="content-container py-16 small:py-28">
      <div className="mb-10 flex items-end justify-between border-b border-zinc-300 pb-4">
        <Text className="text-xl tracking-[-0.03em] small:text-2xl">
          {collection.title}
        </Text>
        <InteractiveLink href={`/collections/${collection.handle}`}>
          {t("viewAllLabel")}
        </InteractiveLink>
      </div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-6 xsmall:grid-cols-2 small:grid-cols-4">
        {productsWithPrices &&
          productsWithPrices.map((product) => (
            <li key={product.id}>
              <ProductPreview product={product} region={region} isFeatured />
            </li>
          ))}
      </ul>
    </div>
  )
}
